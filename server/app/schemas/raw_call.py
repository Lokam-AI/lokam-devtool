from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RawCallCreate(BaseModel):
    """Schema for ingesting a raw call from lokamspace."""

    model_config = ConfigDict(populate_by_name=True)

    lokam_call_id: int
    call_date: date
    organization_name: str | None = None
    rooftop_name: str | None = None
    campaign_name: str | None = None
    lead_type: str | None = None
    call_status: str | None = None
    ended_reason: str | None = None
    review_link_sent: bool | None = None
    direction: str | None = None
    duration_sec: int | None = None
    nps_score: int | None = None
    call_summary: str | None = None
    overall_feedback: str | None = Field(default=None, validation_alias="feedback_summary")
    positive_mentions: Any | None = None
    detractors: Any | None = Field(default=None, validation_alias="areas_to_improve")
    is_incomplete_call: bool | None = None
    incomplete_reason: str | None = None
    is_dnc_request: bool | None = None
    escalation_needed: bool | None = None
    raw_transcript: str | None = None
    formatted_transcript: str | None = None
    recording_url: str | None = None
    service_record_json: Any | None = None
    organization_json: Any | None = None
    call_metadata: Any | None = None
    customer_name_masked: str | None = None
    customer_phone_masked: str | None = None
    source_env: str = "prod"


class RawCallRead(RawCallCreate):
    """Schema for returning raw call data to API consumers."""

    model_config = {"from_attributes": True}

    id: int
    synced_at: datetime
    created_at: datetime
    updated_at: datetime
