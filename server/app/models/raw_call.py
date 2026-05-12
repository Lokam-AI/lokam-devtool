from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

CALL_TYPE_ENUM_NAME = "call_type_enum"
CALL_TYPE_SERVICE = "service"
CALL_TYPE_SALES = "sales"
CALL_TYPE_VALUES = (CALL_TYPE_SERVICE, CALL_TYPE_SALES)


class RawCall(Base, TimestampMixin):
    """ORM model for the raw_calls table — append-only call data from lokamspace."""

    __tablename__ = "raw_calls"
    __table_args__ = (
        Index("idx_raw_calls_call_date", "call_date"),
        Index("idx_raw_calls_lokam_call_id", "lokam_call_id"),
        Index("idx_raw_calls_source_env", "source_env"),
        Index("idx_raw_calls_call_type_date", "call_type", "call_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lokam_call_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    # Context
    organization_name: Mapped[str | None] = mapped_column(String(150))
    rooftop_name: Mapped[str | None] = mapped_column(String(150))
    campaign_name: Mapped[str | None] = mapped_column(String(150))
    lead_type: Mapped[str | None] = mapped_column(String(50))
    call_type: Mapped[str] = mapped_column(
        SAEnum(*CALL_TYPE_VALUES, name=CALL_TYPE_ENUM_NAME, create_type=False),
        nullable=False,
        server_default=CALL_TYPE_SERVICE,
    )
    # Call metadata
    call_status: Mapped[str | None] = mapped_column(String(20))
    ended_reason: Mapped[str | None] = mapped_column(String(100))
    review_link_sent: Mapped[bool | None] = mapped_column(Boolean)
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
    # Sales-only AI flag: lokamspace voice agent marks hot leads worth follow-up
    lead_escalated: Mapped[bool | None] = mapped_column(Boolean)
    # Transcripts & recording
    raw_transcript: Mapped[str | None] = mapped_column(Text)
    formatted_transcript: Mapped[str | None] = mapped_column(Text)
    recording_url: Mapped[str | None] = mapped_column(Text)
    vapi_call_id: Mapped[str | None] = mapped_column(String(100))
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
    # Post-call SMS survey
    is_post_call_sms_survey: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    post_call_sms_body: Mapped[str | None] = mapped_column(Text)
    post_call_sms_comments: Mapped[str | None] = mapped_column(Text)
    post_call_sms_status: Mapped[str | None] = mapped_column(String(20))
    post_call_sms_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    post_call_sms_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    post_call_sms_nps: Mapped[int | None] = mapped_column(Integer)

    def __init__(self, *, source_env: str = "prod", call_type: str = CALL_TYPE_SERVICE, **kwargs: Any) -> None:
        """Initialize RawCall with prod env and service call_type as defaults."""
        super().__init__(source_env=source_env, call_type=call_type, **kwargs)
