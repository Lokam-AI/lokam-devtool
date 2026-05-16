from sqlalchemy import Boolean, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SuperConfig(Base, TimestampMixin):
    """ORM model for super_configs — generic configurable option taxonomy."""

    __tablename__ = "super_configs"
    __table_args__ = (
        UniqueConstraint("category", "name", name="uq_super_configs_category_name"),
        Index("idx_super_configs_category_active", "category", "is_active"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    options: Mapped[dict | None] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
