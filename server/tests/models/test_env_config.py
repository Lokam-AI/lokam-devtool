from sqlalchemy import inspect
from app.models.env_config import EnvConfig


def test_env_config_table_name() -> None:
    """EnvConfig model maps to the 'env_configs' table."""
    assert EnvConfig.__tablename__ == "env_configs"


def test_env_config_columns_exist() -> None:
    """EnvConfig model defines all required columns."""
    col_names = {c.key for c in inspect(EnvConfig).mapper.column_attrs}
    expected = {"id", "name", "base_url", "secrets", "is_active", "created_at", "updated_at"}
    assert expected.issubset(col_names)


def test_env_config_defaults() -> None:
    """EnvConfig defaults to active with empty secrets."""
    cfg = EnvConfig(name="dev", base_url="http://localhost:8000")
    assert cfg.is_active is True
    assert cfg.secrets == {}
