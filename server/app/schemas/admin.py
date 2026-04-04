from pydantic import BaseModel


class ACSToggleRequest(BaseModel):
    """Schema for toggling ACS on a target lokamspace environment."""

    enabled: bool


class SeedRunRequest(BaseModel):
    """Schema for triggering a seed run on a target lokamspace environment."""

    confirm: bool = False


class ProxyHealthResponse(BaseModel):
    """Schema for the health-check response proxied from lokamspace."""

    env_name: str
    status: str
    detail: str | None = None
