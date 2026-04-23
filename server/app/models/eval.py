from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

VALID_EVAL_STATUSES = ("pending", "in_progress", "completed")
DEFAULT_EVAL_STATUS = "pending"
DEFAULT_HAS_CORRECTIONS = False
HAS_CORRECTIONS_SERVER_DEFAULT = "false"


class Eval(Base, TimestampMixin):
    """ORM model for the evals table — ground-truth reviewer evaluations."""

    __tablename__ = "evals"
    __table_args__ = (
        Index("idx_evals_assigned_to", "assigned_to"),
        Index("idx_evals_eval_status", "eval_status"),
        Index("idx_evals_call_id", "call_id"),
        Index("idx_evals_completed_at", "completed_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    call_id: Mapped[int] = mapped_column(Integer, nullable=False)  # stores lokam_call_id
    # Denormalized context
    call_status: Mapped[str | None] = mapped_column(String(20))
    lead_type: Mapped[str | None] = mapped_column(String(50))
    raw_transcript: Mapped[str | None] = mapped_column(Text)
    formatted_transcript: Mapped[str | None] = mapped_column(Text)
    recording_url: Mapped[str | None] = mapped_column(Text)
    service_record_json: Mapped[dict | None] = mapped_column(JSONB)
    organization_json: Mapped[dict | None] = mapped_column(JSONB)
    formatted_tags: Mapped[dict | None] = mapped_column(JSONB)
    # Ground-truth fields
    gt_call_summary: Mapped[str | None] = mapped_column(Text)
    gt_nps_score: Mapped[int | None] = mapped_column(Integer)
    gt_overall_feedback: Mapped[str | None] = mapped_column(Text)
    gt_positive_mentions: Mapped[dict | None] = mapped_column(JSONB)
    gt_detractors: Mapped[dict | None] = mapped_column(JSONB)
    gt_is_incomplete_call: Mapped[bool | None] = mapped_column(Boolean)
    gt_incomplete_reason: Mapped[str | None] = mapped_column(Text)
    gt_is_dnc_request: Mapped[bool | None] = mapped_column(Boolean)
    gt_escalation_needed: Mapped[bool | None] = mapped_column(Boolean)
    # Scenario tagging
    scenario_tags: Mapped[dict | None] = mapped_column(JSONB)
    scenario_tags_str: Mapped[str | None] = mapped_column(Text)
    # Assignment & status
    assigned_to: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    eval_status: Mapped[str] = mapped_column(String(20), nullable=False)
    has_corrections: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=DEFAULT_HAS_CORRECTIONS,
        server_default=text(HAS_CORRECTIONS_SERVER_DEFAULT),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))

    def __init__(
        self,
        *,
        eval_status: str = DEFAULT_EVAL_STATUS,
        has_corrections: bool = DEFAULT_HAS_CORRECTIONS,
        **kwargs: Any,
    ) -> None:
        """Initialize Eval with pending status and no corrections by default."""
        super().__init__(eval_status=eval_status, has_corrections=has_corrections, **kwargs)
