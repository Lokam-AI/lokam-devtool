from app.core.config import Settings


def test_settings_load_from_env() -> None:
    """Settings correctly reads DB connection values from environment."""
    settings = Settings()
    assert settings.DB_HOST == "localhost"
    assert settings.DB_PORT == 5432
    assert settings.DB_NAME == "devtool_test"
    assert settings.db_url.startswith("postgresql+asyncpg://")
