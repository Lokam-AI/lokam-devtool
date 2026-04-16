from collections.abc import AsyncGenerator

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import decode_access_token
from app.exceptions import AuthError, PermissionDeniedError
from app.models.user import User
from app.repositories import user_repo


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session scoped to the request."""
    async with AsyncSessionLocal() as session:
        async with session.begin():
            yield session


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    access_token: str | None = Cookie(default=None),
) -> User:
    """Decode the JWT from the httpOnly cookie and return the authenticated user."""
    if access_token is None:
        raise AuthError("Not authenticated")
    payload = decode_access_token(access_token)
    user_id_str: str | None = payload.get("sub")
    if user_id_str is None:
        raise AuthError("Invalid token payload")
    user = await user_repo.get_by_id(db, int(user_id_str))
    if user is None or not user.is_active:
        raise AuthError("User not found or inactive")
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Raise PermissionError unless the current user is admin or superadmin."""
    if current_user.role not in ("admin", "superadmin"):
        raise PermissionDeniedError("Admin access required")
    return current_user


async def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    """Raise PermissionError unless the current user is superadmin."""
    if current_user.role != "superadmin":
        raise PermissionDeniedError("Superadmin access required")
    return current_user
