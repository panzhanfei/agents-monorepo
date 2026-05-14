from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Literal

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from runner.application.entry_chat import (
    EntryChatConfigError,
    aiter_sse_entry_error,
    stream_entry_reply,
)
from runner.infrastructure.node_client import AgentSlotsPayload, NodeApiClient

_log = structlog.get_logger(__name__)

router = APIRouter()

_MAX_MESSAGE_CHARS = 32_000
_MAX_MESSAGES = 80


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., min_length=1, max_length=_MAX_MESSAGE_CHARS)


class EntryChatRequest(BaseModel):
    """浏览器 → 本机 Runner：入口 Router 对话（槽位 key = `router`）。"""

    model_config = ConfigDict(populate_by_name=True)

    messages: list[ChatMessageIn] = Field(..., min_length=1, max_length=_MAX_MESSAGES)
    project_id: str | None = Field(default=None, alias="projectId", max_length=128)


def _require_node(request: Request) -> NodeApiClient:
    node = getattr(request.app.state, "node_client", None)
    if node is None:
        raise HTTPException(status_code=503, detail="runner node client unavailable")
    return node


async def _load_router_slot(node: NodeApiClient) -> dict | None:
    try:
        result = await node.fetch_agent_slots(keys=["router"])
    except httpx.HTTPStatusError as e:
        _log.warning("entry_chat_slot_http_error", status=e.response.status_code)
        raise HTTPException(status_code=502, detail="无法从控制面读取 Agent 槽位") from e
    except Exception as e:
        _log.exception("entry_chat_slot_failed")
        raise HTTPException(status_code=502, detail="读取 Agent 槽位失败") from e

    if not isinstance(result, AgentSlotsPayload):
        raise HTTPException(status_code=500, detail="unexpected agent slots response")

    row = result.slots.get("router")
    if row is None:
        return None
    return row


async def _sse_stream(*, slot: dict, messages: list[dict[str, str]]) -> AsyncIterator[bytes]:
    try:
        async for token in stream_entry_reply(slot=slot, messages=messages):
            payload = json.dumps({"text": token}, ensure_ascii=False)
            yield f"event: token\ndata: {payload}\n\n".encode("utf-8")
        yield b"event: done\ndata: {}\n\n"
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
    - `token`：`data` 为 JSON `{"text":"..."}` 增量
    - `done`：结束
    - `error`：`data` 为 JSON `{"message":"..."}`
    """

    node = _require_node(request)
    # project_id reserved for later：会话落库 / 控制面关联

    slot = await _load_router_slot(node)
    if slot is None:

        async def err_only() -> AsyncIterator[bytes]:
            async for b in aiter_sse_entry_error(
                "尚未配置「router」入口槽位：请先在 Web「Agent 配置」中填写并保存。",
            ):
                yield b

        return StreamingResponse(err_only(), media_type="text/event-stream; charset=utf-8")

    messages = [m.model_dump(mode="json") for m in body.messages]

    return StreamingResponse(
        _sse_stream(slot=slot, messages=messages),
        media_type="text/event-stream; charset=utf-8",
    )
