from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any, Literal

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from runner.application.entry_chat import (
    EntryChatConfigError,
    LOGICAL_ROLE_TO_CONFIG_SLOT,
    aiter_sse_entry_error,
    decide_next_slot,
    stream_downstream_reply,
)
from runner.config import get_settings
from runner.infrastructure.node_client import AgentSlotsPayload, NodeApiClient

_log = structlog.get_logger(__name__)

router = APIRouter()

_MAX_MESSAGE_CHARS = 32_000
_MAX_MESSAGES = 80


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., min_length=1, max_length=_MAX_MESSAGE_CHARS)


class EntryChatRequest(BaseModel):
    """浏览器 → 本机 Runner：Router 仅做路由，面向用户的正文由下游槽位流式输出。"""

    model_config = ConfigDict(populate_by_name=True)

    messages: list[ChatMessageIn] = Field(..., min_length=1, max_length=_MAX_MESSAGES)
    project_id: str | None = Field(default=None, alias="projectId", max_length=128)


def _require_node(request: Request) -> NodeApiClient:
    node = getattr(request.app.state, "node_client", None)
    if node is None:
        raise HTTPException(status_code=503, detail="runner node client unavailable")
    return node


async def _fetch_agent_slot(node: NodeApiClient, slot_key: str) -> dict | None:
    try:
        result = await node.fetch_agent_slots(keys=[slot_key])
    except httpx.HTTPStatusError as e:
        _log.warning("entry_chat_slot_http_error", slot=slot_key, status=e.response.status_code)
        raise HTTPException(status_code=502, detail="无法从控制面读取 Agent 槽位") from e
    except Exception as e:
        _log.exception("entry_chat_slot_failed", slot=slot_key)
        raise HTTPException(status_code=502, detail="读取 Agent 槽位失败") from e

    if not isinstance(result, AgentSlotsPayload):
        raise HTTPException(status_code=500, detail="unexpected agent slots response")

    row = result.slots.get(slot_key)
    if row is None:
        return None
    return row


def _estimate_prompt_tokens(messages: list[dict[str, str]]) -> int:
    chars = sum(len(str(m.get("content") or "")) for m in messages)
    return max(1, chars // 4)


async def _sse_stream(
    *,
    node: NodeApiClient,
    router_slot: dict[str, Any],
    messages: list[dict[str, str]],
) -> AsyncIterator[bytes]:
    settings = get_settings()
    budget_total = settings.entry_chat_round_token_budget
    router_overhead = settings.entry_chat_router_overhead_tokens

    try:
        next_slot, reason = await decide_next_slot(router_slot=router_slot, messages=messages)
        config_key = LOGICAL_ROLE_TO_CONFIG_SLOT[next_slot]
        route_payload = json.dumps(
            {"nextSlot": next_slot, "reason": reason, "configSlot": config_key},
            ensure_ascii=False,
        )
        yield f"event: route\ndata: {route_payload}\n\n".encode("utf-8")

        prompt_est = _estimate_prompt_tokens(messages) + router_overhead
        remaining_after_route = max(0, budget_total - prompt_est)
        budget_payload = json.dumps(
            {"remaining": remaining_after_route, "total": budget_total},
            ensure_ascii=False,
        )
        yield f"event: budget\ndata: {budget_payload}\n\n".encode("utf-8")

        target = await _fetch_agent_slot(node, config_key)
        if target is None:
            msg = (
                f"路由为逻辑角色「{next_slot}」，需使用控制面槽位「{config_key}」的模型配置；"
                "该槽位尚未在 Web「Agent 配置」中填写并保存，请先配置后再试。"
            )
            async for chunk in aiter_sse_entry_error(msg):
                yield chunk
            return

        completion_chars = 0
        async for token in stream_downstream_reply(
            target_slot=target,
            logical_role=next_slot,
            config_slot_key=config_key,
            messages=messages,
        ):
            completion_chars += len(token)
            payload = json.dumps({"text": token}, ensure_ascii=False)
            yield f"event: token\ndata: {payload}\n\n".encode("utf-8")

        completion_est = completion_chars // 4 if completion_chars > 0 else 0
        remaining_end = max(0, budget_total - prompt_est - completion_est)
        budget_final = json.dumps(
            {"remaining": remaining_end, "total": budget_total},
            ensure_ascii=False,
        )
        yield f"event: budget\ndata: {budget_final}\n\n".encode("utf-8")
        if remaining_end <= 0:
            yield b"event: budget_exhausted\ndata: {}\n\n"

        done_payload = json.dumps(
            {"budgetRemaining": remaining_end, "budgetTotal": budget_total},
            ensure_ascii=False,
        )
        yield f"event: done\ndata: {done_payload}\n\n".encode("utf-8")
    except EntryChatConfigError as e:
        _log.warning("entry_chat_config", message=str(e))
        async for chunk in aiter_sse_entry_error(str(e)):
            yield chunk
    except Exception as e:
        _log.exception("entry_chat_stream_failed")
        msg = "模型调用失败，请稍后重试。"
        if str(e):
            msg = f"{msg}（{str(e)[:200]}）"
        async for chunk in aiter_sse_entry_error(msg):
            yield chunk


@router.post("/agent/entry/chat")
async def entry_agent_chat(request: Request, body: EntryChatRequest) -> StreamingResponse:
    """
    SSE：事件类型
    - `route`：`data` 为 JSON `{"nextSlot":"逻辑键","reason":"…","configSlot":"凭证槽"}`
    - `budget`：本轮估算剩余额度，`{"remaining":int,"total":int}`（路由后一条、结束后一条）
    - `budget_exhausted`：`remaining` 已用尽（可与前端自动「新会话」联动）
    - `token`：下游 Agent 增量正文，`{"text":"..."}`
    - `done`：结束，`data` 可为 `{"budgetRemaining":int,"budgetTotal":int}`
    - `error`：`data` 为 JSON `{"message":"..."}`
    """

    node = _require_node(request)

    router_row = await _fetch_agent_slot(node, "router")
    if router_row is None:

        async def err_only() -> AsyncIterator[bytes]:
            async for b in aiter_sse_entry_error(
                "尚未配置「router」路由槽位：请在 Web「Agent 配置」中为 router 填写模型（用于一次 JSON 路由）。",
            ):
                yield b

        return StreamingResponse(err_only(), media_type="text/event-stream; charset=utf-8")

    messages = [m.model_dump(mode="json") for m in body.messages]

    return StreamingResponse(
        _sse_stream(node=node, router_slot=router_row, messages=messages),
        media_type="text/event-stream; charset=utf-8",
    )
