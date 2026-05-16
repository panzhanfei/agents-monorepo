from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import urlparse

import litellm
import structlog

_log = structlog.get_logger(__name__)

# -----------------------------------------------------------------------------
# 角色映射：产品上的「逻辑键」→ 控制面里实际存的 agent 槽位（若干逻辑角色可共用同一槽位凭证）
# -----------------------------------------------------------------------------
LOGICAL_ROLE_TO_CONFIG_SLOT: dict[str, str] = {
    "analyst": "analyst",
    "pm_spec": "analyst",
    "architect": "architect",
    "contract_split": "architect",
    "coder_backend": "coder",
    "coder_frontend": "coder",
    "coder_fullstack": "coder",
    "coder_bff": "coder",
    "verify_unit": "verifier",
    "verify_e2e": "verifier",
    "ops": "ops",
}

ROUTABLE_AGENT_SLOTS: frozenset[str] = frozenset(LOGICAL_ROLE_TO_CONFIG_SLOT.keys())

# 旧路由若仍返回「粗粒度」槽位名，这里统一成上面的逻辑键，避免测试与前端对不齐。
_ROUTE_SLOT_ALIASES: dict[str, str] = {
    "coder": "coder_fullstack",
    "reviewer": "verify_unit",
}

# 要求模型先把「当前路由结果」写在第一行，方便对照 router 是否选对；正文从空行后开始。
_FIRST_LINE_NOTE = (
    "【重要·测试核对】回复的第一行必须与下一行**完全一致**（单独一行，一字不改），"
    "用于对照入口路由的 nextSlot 是否选对；从空行之后开始回答用户正文。\n"
)


def _downstream_role_prompt(role_heading: str, duty_body: str) -> str:
    """拼一条下游角色的 system 文案（首行自检 + 标题 + 职责段）。"""
    return f"{_FIRST_LINE_NOTE}【当前角色】{role_heading}\n\n职责：{duty_body}"


# Router 只产出 JSON，不写用户可见正文；具体槽位说明与产品线文档对齐。
ROUTER_ROUTING_SYSTEM = """你是入口路由器（Router），不向最终用户写任何可见正文。

只根据当前对话，判断下一步应由哪一个「下游细分逻辑角色」处理（产品共 11 个，对应脑图 ②～⑫，不含入口 ①）。
输出必须是**且仅是**一个 JSON 对象（不要 markdown、不要代码围栏、不要前后解释），格式：
{"nextSlot":"<逻辑键 snake_case>","reason":"不超过40字的路由原因（中文）"}

nextSlot 只能取以下之一（含序号与职责提示）：
- analyst：② 需求 Analyst（自然语言→结构化需求）
- pm_spec：③ PM Spec（拆 issue、优先级与依赖）
- architect：④ 架构 Architect（系统/模块级方案）
- contract_split：⑤ 契约与拆分（接口契约、任务下发边界）
- coder_backend：⑥ Coding·后端
- coder_frontend：⑦ Coding·前端
- coder_fullstack：⑧ Coding·全栈
- coder_bff：⑨ Coding·BFF
- verify_unit：⑩ Verify·单元测试
- verify_e2e：⑪ Verify·联调/E2E
- ops：⑫ Ops·打包运维

若用户诉求无法明确归类，优先 analyst；若明显是跑测试/流水线，可指向 verify_* 或 ops。"""

DOWNSTREAM_AGENT_SYSTEM: dict[str, str] = {
    "analyst": _downstream_role_prompt(
        "② analyst — 需求 Analyst",
        "把用户口语澄清为目标、范围、验收标准与非目标；可追问 1～2 个关键问题。"
        "不执行命令、不修改仓库、不冒充已跑调研。",
    ),
    "pm_spec": _downstream_role_prompt(
        "③ pm_spec — PM 规格与拆解",
        "将需求拆成可执行的 issue/任务粒度，说明优先级、依赖与里程碑建议；"
        "不直接大段写代码。不执行命令、不修改仓库。",
    ),
    "architect": _downstream_role_prompt(
        "④ architect — 架构 Architect",
        "给出模块边界、关键技术与主要风险；保持简洁。不冒充已画定稿架构图文件。",
    ),
    "contract_split": _downstream_role_prompt(
        "⑤ contract_split — 契约与拆分",
        "划定前后端/BFF 边界，产出/对齐接口契约要点与可并行任务切分；不写长业务代码。",
    ),
    "coder_backend": _downstream_role_prompt(
        "⑥ coder_backend — Coding·后端",
        "以后端视角给出实现步骤、接口与数据层注意点；代码仅短示例。不冒充已在用户环境执行命令。",
    ),
    "coder_frontend": _downstream_role_prompt(
        "⑦ coder_frontend — Coding·前端",
        "以前端视角给出页面/状态/接口消费方式；代码仅短示例。不执行用户侧命令。",
    ),
    "coder_fullstack": _downstream_role_prompt(
        "⑧ coder_fullstack — Coding·全栈",
        "跨前后端改动时给出串联方案与接口配合点；代码仅短示例。",
    ),
    "coder_bff": _downstream_role_prompt(
        "⑨ coder_bff — Coding·BFF",
        "从 BFF/聚合层视角说明路由、鉴权与下游调用边界；代码仅短示例。",
    ),
    "verify_unit": _downstream_role_prompt(
        "⑩ verify_unit — Verify·单元测试",
        "给出单测策略、关键用例与断言要点；不冒充已在用户仓库跑通测试。",
    ),
    "verify_e2e": _downstream_role_prompt(
        "⑪ verify_e2e — Verify·联调/E2E",
        "给出联调顺序、e2e 场景与数据准备要点；不冒充已跑通流水线。",
    ),
    "ops": _downstream_role_prompt(
        "⑫ ops — Ops·打包运维",
        "构建、发布、配置与健康巡检类建议；不执行用户侧真实命令。",
    ),
}


def _ensure_http_scheme(url: str) -> str:
    """若没有 scheme，默认补成 http（Ollama 本地常见）或调用方自行传入完整 URL。"""
    s = url.strip()
    if not s.lower().startswith(("http://", "https://")):
        return f"http://{s}"
    return s


def _normalize_ollama_origin(raw: str | None) -> str | None:
    """本地 Ollama：只保留 scheme + host[:port]，供 LiteLLM 的 api_base 使用。"""
    if not raw or not str(raw).strip():
        return None
    s = _ensure_http_scheme(str(raw))
    try:
        u = urlparse(s)
        return f"{u.scheme}://{u.netloc}"
    except Exception:
        return None


def _openai_v1_base(raw: str | None) -> str | None:
    """线上 OpenAI 兼容网关：规范成 ``.../v1`` 后缀（LiteLLM 期望的 REST 根路径）。"""
    fallback = "https://api.openai.com/v1"
    source = (raw or "").strip() or fallback
    try:
        s = source
        if not s.lower().startswith(("http://", "https://")):
            s = f"https://{s}"
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
    """槽位配置不完整或 mode 无法识别时抛出，路由层可转成 400/提示用户。"""


def build_litellm_call_kwargs(
    slot: dict[str, Any], *, slot_key: str = "router"
) -> dict[str, Any]:
    """把「一个槽位」的配置 dict 变成 ``litellm.acompletion`` 所需的 model / api_base / api_key。"""
    mode = slot.get("mode")
    model = (slot.get("model") or "").strip()
    if not model:
        raise EntryChatConfigError(
            f"「{slot_key}」槽位未配置模型名：请在「Agent 配置」中填写 model。"
        )

    # local：走 Ollama，模型名通常要加 ollama/ 前缀（LiteLLM 约定）。
    if mode == "local":
        origin = _normalize_ollama_origin(slot.get("baseUrl"))
        if not origin:
            raise EntryChatConfigError(
                "本地模式需要配置 Base URL（如 http://127.0.0.1:11434）。"
            )
        litellm_model = model if model.startswith("ollama/") else f"ollama/{model}"
        return {
            "model": litellm_model,
            "api_base": origin,
            "api_key": None,
        }

    # hosted：OpenAI 兼容 API，必须带 key，base 规范到 /v1。
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


def _user_assistant_only(raw: list[dict[str, str]]) -> list[dict[str, str]]:
    """只保留 user/assistant，避免把 tool 等角色原样喂给当前这套 Router/下游。"""
    return [m for m in raw if m.get("role") in ("user", "assistant")]


def _completion_text(resp: Any) -> str:
    """非流式响应里抽出第一条 choice 的文本内容（容错：结构不对就空串）。"""
    try:
        choices = getattr(resp, "choices", None)
        if not choices:
            return ""
        msg = getattr(choices[0], "message", None)
        if msg is None:
            return ""
        c = getattr(msg, "content", None)
        return c.strip() if isinstance(c, str) else ""
    except Exception:
        return ""


def _parse_route_payload(text: str) -> tuple[str, str]:
    """从模型返回的字符串里抠 JSON，读 nextSlot + reason；失败则回落到 analyst。"""
    t = text.strip()
    if not t:
        return "analyst", ""
    # 先尝试用正则抓最像 JSON 对象的一段，再 fallback 到首 `{` 与末 `}`。
    fence = re.search(r"\{[^{}]*\}", t, flags=re.DOTALL)
    if fence:
        t = fence.group(0)
    else:
        start = t.find("{")
        end = t.rfind("}")
        if start >= 0 and end > start:
            t = t[start : end + 1]
    try:
        data = json.loads(t)
    except json.JSONDecodeError:
        return "analyst", ""
    ns = data.get("nextSlot") or data.get("next_slot")
    reason = data.get("reason")
    r = reason.strip() if isinstance(reason, str) else ""
    if not isinstance(ns, str):
        return "analyst", r
    key = ns.strip().lower().replace(" ", "_")
    key = _ROUTE_SLOT_ALIASES.get(key, key)
    if key not in ROUTABLE_AGENT_SLOTS:
        return "analyst", r
    return key, r


async def decide_next_slot(
    *,
    router_slot: dict[str, Any],
    messages: list[dict[str, str]],
) -> tuple[str, str]:
    """调用 Router 槽位对应模型，返回 (逻辑角色键, 路由原因)。不流式。"""
    kwargs = build_litellm_call_kwargs(router_slot, slot_key="router")
    ua = _user_assistant_only(messages)
    routing_messages: list[dict[str, str]] = [
        {"role": "system", "content": ROUTER_ROUTING_SYSTEM},
        *ua,
    ]
    call_kw = {**kwargs, "messages": routing_messages, "stream": False}
    call_kw = {k: v for k, v in call_kw.items() if v is not None}
    _log.info("entry_router_invoke", model=kwargs.get("model"))
    resp = await litellm.acompletion(**call_kw)
    raw = _completion_text(resp)
    next_slot, reason = _parse_route_payload(raw)
    _log.info("entry_router_result", next_slot=next_slot, reason_len=len(reason))
    return next_slot, reason


def build_downstream_messages(
    slot_key: str, dialogue: list[dict[str, str]]
) -> list[dict[str, str]]:
    """在对话前插入对应角色的 system，供下游流式调用使用。"""
    system = DOWNSTREAM_AGENT_SYSTEM.get(slot_key)
    if not system:
        raise EntryChatConfigError(f"内部错误：未知下游槽位 {slot_key!r}")
    return [{"role": "system", "content": system}, *_user_assistant_only(dialogue)]


def _chunk_text(chunk: Any) -> str:
    """流式 chunk 里取 delta.content（OpenAI 兼容结构，容错返回空串）。"""
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


async def stream_downstream_reply(
    *,
    target_slot: dict[str, Any],
    logical_role: str,
    config_slot_key: str,
    messages: list[dict[str, str]],
) -> AsyncIterator[str]:
    """按配置调用 LiteLLM 流式接口，逐段 yield 文本（由路由层打成 SSE）。"""
    kwargs = build_litellm_call_kwargs(target_slot, slot_key=config_slot_key)
    merged = build_downstream_messages(logical_role, messages)
    _log.info(
        "downstream_chat_invoke",
        logical_role=logical_role,
        config_slot=config_slot_key,
        model=kwargs.get("model"),
    )
    call_kw = {**kwargs, "messages": merged, "stream": True}
    call_kw = {k: v for k, v in call_kw.items() if v is not None}
    stream = await litellm.acompletion(**call_kw)
    async for chunk in stream:
        text = _chunk_text(chunk)
        if text:
            yield text


async def aiter_sse_entry_error(message: str) -> AsyncIterator[bytes]:
    """把业务错误编码成一条 SSE error 事件（bytes，便于直接 write 进响应体）。"""
    payload = json.dumps({"message": message}, ensure_ascii=False)
    yield f"event: error\ndata: {payload}\n\n".encode("utf-8")
