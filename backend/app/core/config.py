from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Kompas kompetencji API"
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'kompas.db').as_posix()}"
    jwt_secret: str = "dev-only-change-me-please-32-bytes-min"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 8 * 60
    gemini_api_key: str | None = None
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    competency_model_path: Path = BACKEND_DIR / "data" / "competency_model.json"
    seed_demo_data: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
