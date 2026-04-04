from datetime import datetime
from typing import Any

from pydantic import BaseModel


class EnvConfigCreate(BaseModel):
    """Schema for registering a new lokamspace environment."""

    name: str
    base_url: str
    secrets: dict[str, Any] = {}
    is_active: bool = True


class EnvConfigUpdate(BaseModel):
    """Schema for updating an environment configuration."""

    base_url: str | None = None
    secrets: dict[str, Any] | None = None
    is_active: bool | None = None


class EnvConfigRead(BaseModel):
    """Schema for returning env config data (secrets excluded)."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    base_url: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
