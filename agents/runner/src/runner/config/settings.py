from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

RUNNER_DEVICE_CREDENTIALS_FILE = Path.home() / ".agents-runner" / "device.env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="RUNNER_",
        env_file=(".env", str(RUNNER_DEVICE_CREDENTIALS_FILE)),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = 8765
    node_api_base: str = "http://127.0.0.1:4999"
    device_key: str = ""
    device_secret: str = ""
    log_level: str = "INFO"
    #: 控制台日志样式：`json` 单行 JSON；`pretty` 多行缩进 JSON；`console` 彩色键值（本地调试用）
    log_format: Literal["json", "pretty", "console"] = "json"
    #: 浏览器里打开一键绑定页的 origin（与 `apps/web` 的 Vite 端口一致，默认 5001）
    runner_setup_web_origin: str = "http://127.0.0.1:5001"
    #: 允许浏览器跨域调用本机 Runner setup 的 Origin，逗号分隔
    runner_setup_allow_origins: str = "http://127.0.0.1:5001,http://localhost:5001"
    #: 无凭据首次启动时是否尝试打开浏览器
    runner_setup_open_browser: bool = True
    #: 入口对话页「本轮」Token 额度（估算用，约按 4 字符 ≈ 1 token）；耗尽后前端可自动新开会话
    entry_chat_round_token_budget: int = 16_384
    #: 估算时计入 Router 一次决策的预留开销（token）
    entry_chat_router_overhead_tokens: int = 512


@lru_cache
def get_settings() -> Settings:
    return Settings()
