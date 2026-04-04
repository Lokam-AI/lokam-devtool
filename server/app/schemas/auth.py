from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Schema for the login request body."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Schema returned after a successful login."""

    access_token: str
    token_type: str = "bearer"


class UserMeResponse(BaseModel):
    """Schema for the /auth/me endpoint."""

    id: int
    email: str
    name: str
    role: str
    is_active: bool
    must_change_password: bool


class ChangePasswordRequest(BaseModel):
    """Schema for the change-password request body."""

    current_password: str
    new_password: str
