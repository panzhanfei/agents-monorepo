from __future__ import annotations

import asyncio
import secrets
import webbrowser
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import urlencode

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from runner.config.settings import Settings, get_settings
from runner.infrastructure.logging_config import configure_logging
from runner.infrastructure.node_client import (
    AgentSlotsNotModified,
    AgentSlotsPayload,
    NodeApiClient,
)
from runner.interfaces.routes import entry_chat, health, stream
from runner.interfaces.routes.setup import (
    clear_setup_token,
    router as setup_router,
    set_setup_token,
)

_log = structlog.get_logger(__name__)


def _runner_bind_url(settings: Settings, token: str) -> str:
    web_origin = settings.runner_setup_web_origin.rstrip("/")
    ingest_url = f"http://127.0.0.1:{settings.port}/v1/setup/ingest"
    qs = urlencode({"ingestUrl": ingest_url, "setupToken": token})
    return f"{web_origin}/settings/local-init?{qs}"


def _slots_log_summary(slots: dict[str, dict[str, Any] | None]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for key in sorted(slots.keys()):
        row = slots[key]
        if row is None:
            summary[key] = "unset"
        else:
            summary[key] = {
                "mode": row.get("mode"),
                "model": row.get("model"),
                "base_url": row.get("baseUrl"),
                "hosted_provider": row.get("hostedProvider"),
                "has_api_key": bool(row.get("apiKey")),
            }
    return summary


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    clear_setup_token()

    has_creds = bool(settings.device_key.strip() and settings.device_secret)
    if not has_creds:
        token = secrets.token_urlsafe(24)
        set_setup_token(token)
        bind_url = _runner_bind_url(settings, token)
        _log.warning(
            "runner_local_setup_pending",
            open_browser=settings.runner_setup_open_browser,
            setup_url=bind_url,
        )
        print("\n正在打开浏览器以完成本机环境准备（仅首次）。\n", flush=True)
        if settings.runner_setup_open_browser:
            await asyncio.to_thread(webbrowser.open, bind_url)

    node = NodeApiClient(
        settings.node_api_base,
        device_key=settings.device_key,
        device_secret=settings.device_secret,
    )
    app.state.node_client = node

    if not has_creds:
        _log.warning(
            "node_agent_slots_skipped",
            reason="awaiting first-time local setup — restart after browser completes",
        )
    else:
        try:
            result = await node.fetch_agent_slots()
        except Exception:
            _log.exception("node_agent_slots_bootstrap_failed", base_url=settings.node_api_base)
        else:
            if isinstance(result, AgentSlotsPayload):
                _log.info(
                    "node_agent_slots_bootstrapped",
                    config_revision=result.config_revision,
                    slot_count=len(result.slots),
                    slots=_slots_log_summary(result.slots),
                )
            elif isinstance(result, AgentSlotsNotModified):
                _log.info(
                    "node_agent_slots_bootstrapped",
                    not_modified=True,
                    config_revision=result.config_revision,
                )

    yield
    await node.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level, log_format=settings.log_format)
    application = FastAPI(title="agents-runner", version="0.1.0", lifespan=_lifespan)

    origins = [o.strip() for o in settings.runner_setup_allow_origins.split(",") if o.strip()]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins else ["http://127.0.0.1:5001"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(health.router, tags=["health"])
    application.include_router(setup_router, prefix="/v1")
    application.include_router(stream.router, prefix="/v1", tags=["stream"])
    application.include_router(entry_chat.router, prefix="/v1", tags=["agent"])
    application.state.settings = settings
    return application
