from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = 60 * 60 * 8  # 8 hours in seconds


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate with email/password and set an httpOnly access token cookie."""
    token_response = await auth_service.login(db, email=body.email, password=body.password)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token_response.access_token,
        httponly=True,
        max_age=COOKIE_MAX_AGE,
        samesite="lax",
        secure=False,
    )
    return token_response


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    """Clear the access token cookie to log the user out."""
    response.delete_cookie(key=COOKIE_NAME)
    return {"detail": "Logged out"}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Change the authenticated user's password and clear must_change_password."""
    await auth_service.change_password(
        db,
        user_id=current_user.id,
        current_password=body.current_password,
        new_password=body.new_password,
    )
    return {"detail": "Password changed"}
