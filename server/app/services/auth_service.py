from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.exceptions import AuthError, NotFoundError
from app.repositories import user_repo
from app.schemas.auth import TokenResponse


async def login(db: AsyncSession, *, email: str, password: str) -> TokenResponse:
    """Verify credentials and return a JWT access token on success."""
    user = await user_repo.get_by_email(db, email)
    if user is None or not user.is_active:
        raise AuthError("Invalid email or password")
    if not verify_password(password, user.password_hash):
        raise AuthError("Invalid email or password")
    token = create_access_token(subject=user.id, role=user.role)
    return TokenResponse(access_token=token)


async def change_password(
    db: AsyncSession,
    *,
    user_id: int,
    current_password: str,
    new_password: str,
) -> None:
    """Verify the current password then store a new hash; clears must_change_password."""
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found")
    if not verify_password(current_password, user.password_hash):
        raise AuthError("Current password is incorrect")
    await user_repo.update_user(
        db,
        user,
        password_hash=hash_password(new_password),
        must_change_password=False,
    )
