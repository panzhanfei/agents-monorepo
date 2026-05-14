from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/health")


@router.get("", summary="存活检查")
async def health_ok() -> dict[str, str]:
    return {"status": "ok"}
