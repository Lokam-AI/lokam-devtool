from datetime import date

from pydantic import BaseModel


class ACSToggleRequest(BaseModel):
    """Schema for toggling ACS on a target lokamspace environment."""

    enabled: bool


class SeedRunRequest(BaseModel):
    """Schema for triggering a seed run on a target lokamspace environment."""

    mode: str = "--check-and-seed"
    organization_name: str
    rooftop_names: list[str]


class SyncRequest(BaseModel):
    """Schema for triggering a manual data sync for a given date."""

    date: date


class SyncResponse(BaseModel):
    """Schema for the sync result summary."""

    date: date
    calls: dict[str, int]
    bugs: dict[str, int]


class ProxyHealthResponse(BaseModel):
    """Schema for the health-check response proxied from lokamspace."""

    env_name: str
    status: str
    detail: str | None = None
