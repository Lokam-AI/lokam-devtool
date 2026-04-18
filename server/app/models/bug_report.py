from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BugReport(Base):
    """ORM model for the bug_reports table — bug data synced from lokamspace environments."""

    __tablename__ = "bug_reports"
    __table_args__ = (
        UniqueConstraint("external_id", "source_env", name="uq_bug_reports_external_id_env"),
        Index("idx_bug_reports_bug_date", "bug_date"),
        Index("idx_bug_reports_source_env", "source_env"),
        Index("idx_bug_reports_organization_name", "organization_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    external_id: Mapped[int] = mapped_column(Integer, nullable=False)
    call_id: Mapped[int | None] = mapped_column(Integer)
    organization_id: Mapped[str | None] = mapped_column(String(100))
    organization_name: Mapped[str | None] = mapped_column(String(150))
    rooftop_id: Mapped[str | None] = mapped_column(String(100))
    rooftop_name: Mapped[str | None] = mapped_column(String(150))
    bug_types: Mapped[list | None] = mapped_column(JSONB)
    description: Mapped[str | None] = mapped_column(Text)
    submitted_by: Mapped[int | None] = mapped_column(Integer)
    submitted_by_name: Mapped[str | None] = mapped_column(String(150))
    bug_date: Mapped[date] = mapped_column(Date, nullable=False)
    source_env: Mapped[str] = mapped_column(String(50), nullable=False)
    external_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), nullable=False
    )
    assigned_to: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)

    def __init__(self, *, source_env: str = "app", **kwargs: Any) -> None:
        """Initialize BugReport with app as the default source environment."""
        super().__init__(source_env=source_env, **kwargs)
