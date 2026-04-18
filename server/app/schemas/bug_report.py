from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class BugReportRead(BaseModel):
    """Schema for returning a synced bug report to API consumers."""

    model_config = {"from_attributes": True}

    id: int
    external_id: int
    call_id: int | None = None
    organization_id: str | None = None
    organization_name: str | None = None
    rooftop_id: str | None = None
    rooftop_name: str | None = None
    bug_types: Any | None = None
    description: str | None = None
    submitted_by: int | None = None
    submitted_by_name: str | None = None
    bug_date: date
    source_env: str
    external_created_at: datetime | None = None
    synced_at: datetime
    assigned_to: int | None = None
    is_resolved: bool = False
