from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class RawCall(Base, TimestampMixin):
    """ORM model for the raw_calls table — append-only call data from lokamspace."""

    __tablename__ = "raw_calls"
    __table_args__ = (
        Index("idx_raw_calls_call_date", "call_date"),
        Index("idx_raw_calls_lokam_call_id", "lokam_call_id"),
        Index("idx_raw_calls_source_env", "source_env"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lokam_call_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    # Context
    organization_name: Mapped[str | None] = mapped_column(String(150))
    rooftop_name: Mapped[str | None] = mapped_column(String(150))
    campaign_name: Mapped[str | None] = mapped_column(String(150))
    lead_type: Mapped[str | None] = mapped_column(String(50))
    # Call metadata
    call_status: Mapped[str | None] = mapped_column(String(20))
    direction: Mapped[str | None] = mapped_column(String(10))
    duration_sec: Mapped[int | None] = mapped_column(Integer)
    call_date: Mapped[date] = mapped_column(Date, nullable=False)
    # AI outputs
    nps_score: Mapped[int | None] = mapped_column(Integer)
    call_summary: Mapped[str | None] = mapped_column(Text)
    overall_feedback: Mapped[str | None] = mapped_column(Text)
    positive_mentions: Mapped[dict | None] = mapped_column(JSONB)
    detractors: Mapped[dict | None] = mapped_column(JSONB)
    is_incomplete_call: Mapped[bool | None] = mapped_column(Boolean)
    incomplete_reason: Mapped[str | None] = mapped_column(Text)
    is_dnc_request: Mapped[bool | None] = mapped_column(Boolean)
    escalation_needed: Mapped[bool | None] = mapped_column(Boolean)
    # Transcripts & recording
    raw_transcript: Mapped[str | None] = mapped_column(Text)
    formatted_transcript: Mapped[str | None] = mapped_column(Text)
    recording_url: Mapped[str | None] = mapped_column(Text)
    # Structured context
    service_record_json: Mapped[dict | None] = mapped_column(JSONB)
    organization_json: Mapped[dict | None] = mapped_column(JSONB)
    call_metadata: Mapped[dict | None] = mapped_column(JSONB)
    # PII (masked at source)
    customer_name_masked: Mapped[str | None] = mapped_column(String(100))
    customer_phone_masked: Mapped[str | None] = mapped_column(String(20))
    # Sync tracking
    source_env: Mapped[str | None] = mapped_column(String(20))
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), nullable=False
    )

    def __init__(self, *, source_env: str = "prod", **kwargs: Any) -> None:
        """Initialize RawCall with prod as the default source environment."""
        super().__init__(source_env=source_env, **kwargs)
