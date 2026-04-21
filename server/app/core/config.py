from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def _validate_secrets(self) -> "Settings":
        """Raise at startup if any required secret is missing or still set to a known-weak default."""
        if not self.SECRET_KEY:
            raise ValueError("SECRET_KEY must be set")
        if not self.FERNET_KEY:
            raise ValueError("FERNET_KEY must be set")
        return self

    DB_HOST: str
    DB_PORT: int = 5432
    DB_USER: str
    DB_PASSWORD: str
    DB_NAME: str
    SECRET_KEY: str
    FERNET_KEY: str
    SYNC_SECRET: str = ""
    ENVIRONMENT: str = "development"
    # Comma-separated list of allowed CORS origins
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Lokamspace environment base URLs (defaults wired in; only API keys need to be set)
    APP_BASE_URL: str = "https://api.app.lokam.ai"
    APP_API_KEY: str = ""
    ARENA_BASE_URL: str = "https://api.arena.lokam.ai"
    ARENA_API_KEY: str = ""
    PLAYGROUND_BASE_URL: str = "https://api.playground.lokam.ai"
    PLAYGROUND_API_KEY: str = ""

    @property
    def db_url(self) -> str:
        """Return async SQLAlchemy database URL."""
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def db_url_sync(self) -> str:
        """Return sync SQLAlchemy database URL (used by Alembic)."""
        return (
            f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


settings = Settings()

MAX_CALLS_PER_USER: int = 5
CALL_TARGETS: dict[str, int] = {"na": 2, "passive": 0, "detractor": 1, "promoter": 1, "missed": 1}
FILL_PRIORITY: list[str] = ["na", "detractor", "missed", "promoter", "passive"]
