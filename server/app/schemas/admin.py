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


# --- Feature Flags ---

class FeatureFlagEnvState(BaseModel):
    """State of a single feature flag for a single environment."""

    env: str    # devtool env_name e.g. "playground", "arena", "app"
    enabled: bool


class FeatureFlagItem(BaseModel):
    """A PostHog feature flag with its enabled state across all environments."""

    key: str
    name: str
    environments: list[FeatureFlagEnvState]


class FeatureFlagToggleRequest(BaseModel):
    """Request body for toggling a feature flag on a specific environment."""

    env: str    # devtool env_name — "playground" or "arena" (prod blocked server-side)
    enabled: bool
