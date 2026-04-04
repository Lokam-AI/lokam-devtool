from app.core.database import async_engine


def test_engine_url_uses_asyncpg() -> None:
    """Async engine is configured with asyncpg driver."""
    url = str(async_engine.url)
    assert "asyncpg" in url
