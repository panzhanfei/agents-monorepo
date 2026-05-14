from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from runner.config.settings import get_settings
from runner.infrastructure.logging_config import configure_logging
from runner.infrastructure.node_client import NodeApiClient
from runner.interfaces.routes import health, stream


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    node = NodeApiClient(
        settings.node_api_base,
        device_key=settings.device_key,
        device_secret=settings.device_secret,
    )
    app.state.node_client = node
    yield
    await node.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    application = FastAPI(title="agents-runner", version="0.1.0", lifespan=_lifespan)
    application.include_router(health.router, tags=["health"])
    application.include_router(stream.router, prefix="/v1", tags=["stream"])
    application.state.settings = settings
    return application
