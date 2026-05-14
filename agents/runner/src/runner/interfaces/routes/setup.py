"""本机一键绑定：浏览器将 Node 返回的 device 凭据 POST 回 Runner（仅 127.0.0.1）。"""

from __future__ import annotations

import hmac
import os
from typing import Annotated

import structlog
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from runner.config.settings import RUNNER_DEVICE_CREDENTIALS_FILE

_log = structlog.get_logger(__name__)

router = APIRouter(prefix="/setup", tags=["setup"])


class SetupIngestBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    device_key: str = Field(alias="deviceKey", min_length=1)
    device_secret: str = Field(alias="deviceSecret", min_length=1)
    node_api_base: str | None = Field(None, alias="nodeApiBase")


@router.post("/ingest")
async def setup_ingest(
    body: SetupIngestBody,
    x_runner_setup_token: Annotated[str | None, Header(alias="X-Runner-Setup-Token")] = None,
) -> dict[str, bool]:
    expected = get_pending_setup_token()
    if expected is None or x_runner_setup_token is None:
        raise HTTPException(status_code=403, detail="setup not available")
    if not hmac.compare_digest(x_runner_setup_token, expected):
        raise HTTPException(status_code=403, detail="invalid setup token")

    base = (body.node_api_base or "").strip().rstrip("/")
    if not base:
        raise HTTPException(status_code=400, detail="nodeApiBase required")

    RUNNER_DEVICE_CREDENTIALS_FILE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    lines = [
        "# 由 Web「一键绑定」写入，请勿提交或共享。",
        f"RUNNER_DEVICE_KEY={body.device_key}",
        f"RUNNER_DEVICE_SECRET={body.device_secret}",
        f"RUNNER_NODE_API_BASE={base}",
        "",
    ]
    RUNNER_DEVICE_CREDENTIALS_FILE.write_text("\n".join(lines), encoding="utf-8")
    if os.name != "nt":
        try:
            os.chmod(RUNNER_DEVICE_CREDENTIALS_FILE, 0o600)
        except OSError:
            pass

    clear_setup_token()

    _log.info("runner_device_credentials_ingested", path=str(RUNNER_DEVICE_CREDENTIALS_FILE))
    return {"ok": True}


# 由 api 模块在启动时设置，避免循环 import 时 app.state 尚未就绪
_setup_token_holder: dict[str, str | None] = {"token": None}


def set_setup_token(token: str | None) -> None:
    _setup_token_holder["token"] = token


def clear_setup_token() -> None:
    _setup_token_holder["token"] = None


def get_pending_setup_token() -> str | None:
    return _setup_token_holder["token"]
