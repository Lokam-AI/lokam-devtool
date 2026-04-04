from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr

UserRole = Literal["superadmin", "admin", "reviewer"]


class UserCreate(BaseModel):
    """Schema for creating a new user account."""

    email: EmailStr
    password: str
    name: str
    role: UserRole = "reviewer"


class UserUpdate(BaseModel):
    """Schema for updating an existing user account."""

    name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class UserRead(BaseModel):
    """Schema for returning user data to API consumers."""

    model_config = {"from_attributes": True}

    id: int
    email: str
    name: str
    role: UserRole
    is_active: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime
