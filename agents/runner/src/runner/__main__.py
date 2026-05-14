from __future__ import annotations

import os

import uvicorn

from runner.config.settings import get_settings


def main() -> None:
    settings = get_settings()
    reload = os.environ.get("RUNNER_RELOAD", "").lower() in ("1", "true")
    uvicorn.run(
        "runner.interfaces.api:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        reload=reload,
    )


if __name__ == "__main__":
    main()
