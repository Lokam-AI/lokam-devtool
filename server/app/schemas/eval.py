from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

EvalStatus = Literal["pending", "in_progress", "completed"]


class EvalCreate(BaseModel):
    """Schema for creating a new evaluation record during call assignment."""

    call_id: int  # stores lokam_call_id from raw_calls
    assigned_to: int
    call_status: str | None = None
    raw_transcript: str | None = None
    formatted_transcript: str | None = None
    recording_url: str | None = None
    service_record_json: Any | None = None
    organization_json: Any | None = None


class EvalUpdate(BaseModel):
    """Schema for submitting or updating an evaluation."""

    eval_status: EvalStatus | None = None
    has_corrections: bool | None = None
    completed_at: datetime | None = None
    gt_call_summary: str | None = None
    gt_nps_score: int | None = None
    gt_overall_feedback: str | None = None
    gt_positive_mentions: Any | None = None
    gt_detractors: Any | None = None
    gt_is_incomplete_call: bool | None = None
    gt_incomplete_reason: str | None = None
    gt_is_dnc_request: bool | None = None
    gt_escalation_needed: bool | None = None
    scenario_tags: Any | None = None
    scenario_tags_str: str | None = None


class EvalRead(BaseModel):
    """Schema for returning eval data to API consumers."""

    model_config = {"from_attributes": True}

    id: int
    call_id: int
    assigned_to: int
    call_status: str | None = None
    raw_transcript: str | None = None
    formatted_transcript: str | None = None
    recording_url: str | None = None
    service_record_json: Any | None = None
    organization_json: Any | None = None
    eval_status: EvalStatus
    has_corrections: bool
    completed_at: datetime | None = None
    gt_call_summary: str | None = None
    gt_nps_score: int | None = None
    gt_overall_feedback: str | None = None
    gt_positive_mentions: Any | None = None
    gt_detractors: Any | None = None
    gt_is_incomplete_call: bool | None = None
    gt_incomplete_reason: str | None = None
    gt_is_dnc_request: bool | None = None
    gt_escalation_needed: bool | None = None
    scenario_tags: Any | None = None
    scenario_tags_str: str | None = None
    formatted_tags: Any | None = None
    created_at: datetime
    updated_at: datetime
