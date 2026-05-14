from __future__ import annotations

import os
import sys

import uvicorn

from runner.config.settings import get_settings


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "register":
        from runner.cli.register import run_register

        raise SystemExit(run_register(sys.argv[2:]))

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
