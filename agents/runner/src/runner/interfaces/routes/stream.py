from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()


@router.get("/stream/example")
async def stream_example() -> StreamingResponse:
    """SSE 占位：验证 `text/event-stream` 与本机客户端链路（非生产逻辑）。"""

    async def events() -> AsyncIterator[bytes]:
        payload = json.dumps({"event": "ping", "data": "ok"}, ensure_ascii=False)
        yield f"data: {payload}\n\n".encode()
        await asyncio.sleep(0.05)

    return StreamingResponse(events(), media_type="text/event-stream")
