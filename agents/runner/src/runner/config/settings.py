from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="RUNNER_",
        env_file=(".env",),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = 8765
    node_api_base: str = "http://127.0.0.1:3000"
    device_key: str = ""
    device_secret: str = ""
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
