from __future__ import annotations

import httpx


class NodeApiClient:
    """Runner → Node（apps/api）HTTP 客户端占位；鉴权头与具体路由在对接契约时扩展。"""

    def __init__(self, base_url: str, timeout_s: float = 30.0) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(timeout_s),
        )

    @property
    def client(self) -> httpx.AsyncClient:
        return self._client

    async def aclose(self) -> None:
        await self._client.aclose()
