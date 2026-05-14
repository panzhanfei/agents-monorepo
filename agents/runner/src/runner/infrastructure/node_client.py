from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


def _strip_etag(raw: str) -> str:
    s = raw.strip()
    if s.upper().startswith("W/"):
        s = s[2:].strip()
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        s = s[1:-1]
    return s


@dataclass(frozen=True)
class AgentSlotsNotModified:
    """HTTP 304：本地缓存仍有效，可继续沿用上次拉取的 `slots`。"""

    config_revision: str


@dataclass(frozen=True)
class AgentSlotsPayload:
    config_revision: str
    slots: dict[str, dict[str, Any] | None]


AgentSlotsFetchResult = AgentSlotsNotModified | AgentSlotsPayload


class NodeApiClient:
    """Runner → Node（apps/api）HTTP 客户端：任务认领、槽位配置等。"""

    def __init__(
        self,
        base_url: str,
        *,
        device_key: str,
        device_secret: str,
        timeout_s: float = 30.0,
    ) -> None:
        self._device_key = device_key
        self._device_secret = device_secret
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(timeout_s),
        )

    @property
    def client(self) -> httpx.AsyncClient:
        return self._client

    def _runner_headers(self) -> dict[str, str]:
        return {
            "X-Device-Key": self._device_key,
            "X-Device-Secret": self._device_secret,
        }

    async def fetch_agent_slots(
        self,
        *,
        keys: list[str] | None = None,
        if_none_match: str | None = None,
    ) -> AgentSlotsFetchResult:
        """
        GET /v1/runner/agent-slots
        - 不传 keys：返回全部槽位；传 keys 则只拉指定槽位（逗号列表与 API 一致）。
        - if_none_match：上次的 configRevision；未变化时返回 AgentSlotsNotModified（304）。
        """
        headers = self._runner_headers()
        if if_none_match:
            headers["If-None-Match"] = if_none_match
        params: dict[str, str] = {}
        if keys:
            params["keys"] = ",".join(keys)
        resp = await self._client.get(
            "/v1/runner/agent-slots",
            headers=headers,
            params=params or None,
        )
        if resp.status_code == 304:
            etag = resp.headers.get("etag")
            rev = _strip_etag(etag) if etag else (if_none_match or "")
            return AgentSlotsNotModified(config_revision=rev)
        resp.raise_for_status()
        data = resp.json()
        slots_raw = data.get("slots")
        slots: dict[str, dict[str, Any] | None] = {}
        if isinstance(slots_raw, dict):
            for k, v in slots_raw.items():
                if v is None:
                    slots[str(k)] = None
                elif isinstance(v, dict):
                    slots[str(k)] = v
                else:
                    slots[str(k)] = None
        return AgentSlotsPayload(
            config_revision=str(data.get("configRevision", "")),
            slots=slots,
        )

    async def aclose(self) -> None:
        await self._client.aclose()
