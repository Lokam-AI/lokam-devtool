from typing import Any

from sqlalchemy import Boolean, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class EnvConfig(Base, TimestampMixin):
    """ORM model for the env_configs table — lokamspace environment credentials."""

    __tablename__ = "env_configs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    secrets: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False)

    def __init__(self, *, secrets: dict | None = None, is_active: bool = True, **kwargs: Any) -> None:
        """Initialize EnvConfig as active with empty secrets by default."""
        super().__init__(secrets=secrets if secrets is not None else {}, is_active=is_active, **kwargs)
