from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Schema for the login request body."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Schema returned after a successful login."""

    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    """Schema for the change-password request body."""

    current_password: str
    new_password: str
