from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DB_HOST: str
    DB_PORT: int = 5432
    DB_USER: str
    DB_PASSWORD: str
    DB_NAME: str
    SECRET_KEY: str = "insecure-dev-key"
    FERNET_KEY: str = ""
    ENVIRONMENT: str = "development"

    # Playground (lokamspace) env — used to auto-seed the env_config row
    PLAYGROUND_BASE_URL: str = ""
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

MAX_CALLS_PER_USER: int = 15
CALL_TARGETS: dict[str, int] = {"na": 7, "detractor": 2, "promoter": 3, "missed": 3}
FILL_PRIORITY: list[str] = ["na", "promoter", "detractor", "missed"]
