from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limit import check_login_rate
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse, UserMeResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = 60 * 60 * 8  # 8 hours in seconds


@router.get("/me", response_model=UserMeResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserMeResponse:
    """Return the profile of the currently authenticated user."""
    return UserMeResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        is_active=current_user.is_active,
        must_change_password=current_user.must_change_password,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate with email/password and set an httpOnly access token cookie."""
    check_login_rate(request)
    token_response = await auth_service.login(db, email=body.email, password=body.password)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token_response.access_token,
        httponly=True,
        max_age=COOKIE_MAX_AGE,
        samesite="none" if settings.ENVIRONMENT != "development" else "lax",
        secure=settings.ENVIRONMENT != "development",
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
