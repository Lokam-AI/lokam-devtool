from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SuperConfigCreate(BaseModel):
    """Payload for creating a new super_config option."""

    category: str
    name: str
    display_name: str | None = None
    description: str | None = None
    options: Any | None = None
    sort_order: int = 0


class SuperConfigUpdate(BaseModel):
    """Payload for updating an existing super_config option."""

    name: str | None = None
    display_name: str | None = None
    description: str | None = None
    options: Any | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class SuperConfigRead(BaseModel):
    """Schema for returning a super_config option to API consumers."""

    model_config = {"from_attributes": True}

    id: int
    category: str
    name: str
    display_name: str | None = None
    description: str | None = None
    options: Any | None = None
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
