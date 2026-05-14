from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import litellm
import structlog

_log = structlog.get_logger(__name__)

ENTRY_SYSTEM_PROMPT = """你是「软件研发智能群体」的入口 Agent（Router）。
职责：用简洁中文理解用户意图，并做粗粒度分类（如：需求澄清、架构/方案、编码实现、测试验证、发布运维等）。
当前阶段只做对话与引导，不直接修改用户仓库，也不冒充已执行具体命令。
回答尽量短而清楚；若信息不足，只追问一至两个关键问题。"""


def _normalize_ollama_origin(raw: str | None) -> str | None:
    if not raw or not str(raw).strip():
        return None
    s = str(raw).strip()
    if not s.lower().startswith(("http://", "https://")):
        s = f"http://{s}"
    try:
        from urllib.parse import urlparse

        u = urlparse(s)
        return f"{u.scheme}://{u.netloc}"
    except Exception:
        return None


def _openai_v1_base(raw: str | None) -> str | None:
    fallback = "https://api.openai.com/v1"
    source = (raw or "").strip() or fallback
    try:
        s = source
        if not s.lower().startswith(("http://", "https://")):
            s = f"https://{s}"
        from urllib.parse import urlparse

        u = urlparse(s)
        path = u.path.rstrip("/")
        if not path.endswith("/v1"):
            if path in ("", "/"):
                path = "/v1"
            else:
                path = f"{path}/v1"
        return f"{u.scheme}://{u.netloc}{path}"
    except Exception:
        return None


class EntryChatConfigError(ValueError):
    pass


def build_litellm_call_kwargs(slot: dict[str, Any]) -> dict[str, Any]:
    """Map runner agent slot (router) to LiteLLM kwargs. Raises EntryChatConfigError."""
    mode = slot.get("mode")
    model = (slot.get("model") or "").strip()
    if not model:
        raise EntryChatConfigError("router 槽位未配置模型名：请在「Agent 配置」中填写 model。")

    if mode == "local":
        origin = _normalize_ollama_origin(slot.get("baseUrl"))
        if not origin:
            raise EntryChatConfigError("本地模式需要配置 Base URL（如 http://127.0.0.1:11434）。")
        litellm_model = model if model.startswith("ollama/") else f"ollama/{model}"
        return {
            "model": litellm_model,
            "api_base": origin,
            "api_key": None,
        }

    if mode == "hosted":
        key = (slot.get("apiKey") or "").strip()
        if not key:
            raise EntryChatConfigError("线上模式需要已保存的 API Key。")
        base = _openai_v1_base(slot.get("baseUrl"))
        if not base:
            raise EntryChatConfigError("Base URL 无效。")
        return {
            "model": model,
            "api_base": base,
            "api_key": key,
        }

    raise EntryChatConfigError(f"未知推理模式：{mode!r}")


def normalize_chat_messages(raw: list[dict[str, str]]) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    if not raw or raw[0].get("role") != "system":
        messages.append({"role": "system", "content": ENTRY_SYSTEM_PROMPT})
    messages.extend(raw)
    return messages


def _chunk_text(chunk: Any) -> str:
    try:
        choices = getattr(chunk, "choices", None)
        if not choices:
            return ""
        c0 = choices[0]
        delta = getattr(c0, "delta", None)
        if delta is None:
            return ""
        content = getattr(delta, "content", None)
        if isinstance(content, str) and content:
            return content
    except Exception:
        return ""
    return ""


async def stream_entry_reply(
    *,
    slot: dict[str, Any],
    messages: list[dict[str, str]],
) -> AsyncIterator[str]:
    kwargs = build_litellm_call_kwargs(slot)
    merged = normalize_chat_messages(messages)
    _log.info("entry_chat_invoke", model=kwargs.get("model"))
    call_kw = {**kwargs, "messages": merged, "stream": True}
    call_kw = {k: v for k, v in call_kw.items() if v is not None}
    stream = await litellm.acompletion(**call_kw)
    async for chunk in stream:
        text = _chunk_text(chunk)
        if text:
            yield text


async def aiter_sse_entry_error(message: str) -> AsyncIterator[bytes]:
    payload = json.dumps({"message": message}, ensure_ascii=False)
    yield f"event: error\ndata: {payload}\n\n".encode("utf-8")
