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

    # AWS S3 for image uploads in comment threads
    AWS_S3_BUCKET: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"

    # Lokamspace environment base URLs (defaults wired in; only API keys need to be set)
    APP_BASE_URL: str = "https://api.app.lokam.ai"
    APP_API_KEY: str = ""
    ARENA_BASE_URL: str = "https://api.arena.lokam.ai"
    ARENA_API_KEY: str = ""
    PLAYGROUND_BASE_URL: str = "https://api.playground.lokam.ai"
    PLAYGROUND_API_KEY: str = ""

    # PostHog Feature Flag Management
    POSTHOG_PERSONAL_API_KEY: str = ""  # phx_... from PostHog → Settings → Personal API Keys
    POSTHOG_PROJECT_ID: str = ""        # numeric ID from PostHog project URL
    POSTHOG_HOST: str = "https://us.i.posthog.com"

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

DEFAULT_REVIEWER_CAPACITY: int = 17

# NPS bucket probabilities for Phase 2 — 8 keys summing to 1.0.
# Derived from legacy targets (service: na=7, det=2, pro=3, missed=3; sales: det=1, pro=1)
# normalised over the 17-call pool: each value = legacy_count / 17.
DEFAULT_BUCKET_PROBABILITIES: dict[str, float] = {
    "service_na": 0.4118,
    "service_passive": 0.0,
    "service_detractor": 0.1176,
    "service_promoter": 0.1765,
    "service_missed": 0.1765,
    "sales_na": 0.0,
    "sales_detractor": 0.0588,
    "sales_promoter": 0.0588,
}

# Phase 1 special-type minimum counts — one call of each type guaranteed per day.
DEFAULT_SPECIAL_MINIMUMS: dict[str, int] = {
    "dnc": 1,
    "email_send": 1,
    "lead_escalated": 1,
    "review_link_sent": 1,
    "post_call_sms": 1,
}
