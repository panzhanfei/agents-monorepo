from __future__ import annotations

import logging
from typing import Literal

import structlog
from structlog.dev import ConsoleRenderer
from structlog.processors import CallsiteParameter, CallsiteParameterAdder

_CALLSITE = CallsiteParameterAdder(
    parameters={
        CallsiteParameter.FILENAME,
        CallsiteParameter.LINENO,
        CallsiteParameter.FUNC_NAME,
    },
)

LogFormat = Literal["json", "pretty", "console"]


def _final_processor(log_format: LogFormat) -> structlog.typing.Processor:
    if log_format == "console":
        return ConsoleRenderer(colors=True)
    if log_format == "pretty":
        return structlog.processors.JSONRenderer(indent=2, ensure_ascii=False)
    return structlog.processors.JSONRenderer()


def configure_logging(level: str = "INFO", *, log_format: LogFormat = "json") -> None:
    numeric = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(level=numeric, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            _CALLSITE,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            _final_processor(log_format),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
