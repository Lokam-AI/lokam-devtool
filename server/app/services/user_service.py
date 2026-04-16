from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.models.user import User
from app.repositories import user_repo
from app.schemas.user import UserCreate, UserRead, UserUpdate

SUPERADMIN_ROLE = "superadmin"
ADMIN_ROLE = "admin"


async def create_user(db: AsyncSession, payload: UserCreate, *, created_by_role: str) -> UserRead:
    """Create a new user; only superadmin may create admin or superadmin accounts."""
    if payload.role in (SUPERADMIN_ROLE, ADMIN_ROLE) and created_by_role != SUPERADMIN_ROLE:
        raise PermissionDeniedError(f"Only superadmin can create a user with role '{payload.role}'")
    existing = await user_repo.get_by_email(db, payload.email)
    if existing is not None:
        raise ConflictError(f"Email '{payload.email}' is already registered")
    user = await user_repo.create(
        db,
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        role=payload.role,
    )
    return UserRead.model_validate(user)


async def update_user(db: AsyncSession, user_id: int, payload: UserUpdate, *, updated_by_role: str) -> UserRead:
    """Update an existing user; role escalation to superadmin requires superadmin caller."""
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found")
    if payload.role == SUPERADMIN_ROLE and updated_by_role != SUPERADMIN_ROLE:
        raise PermissionDeniedError("Only superadmin can assign the superadmin role")
    changes = payload.model_dump(exclude_none=True)
    updated = await user_repo.update_user(db, user, **changes)
    return UserRead.model_validate(updated)


async def list_users(db: AsyncSession) -> list[UserRead]:
    """Return all users as read schemas."""
    users = await user_repo.list_all(db)
    return [UserRead.model_validate(u) for u in users]


async def get_user(db: AsyncSession, user_id: int) -> UserRead:
    """Return a single user by id; raise NotFoundError if absent."""
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found")
    return UserRead.model_validate(user)


async def deactivate_user(db: AsyncSession, user_id: int, *, requesting_role: str) -> None:
    """Soft-delete a user; only superadmin may deactivate an admin or superadmin."""
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found")
    if user.role in (SUPERADMIN_ROLE, ADMIN_ROLE) and requesting_role != SUPERADMIN_ROLE:
        raise PermissionDeniedError(f"Only superadmin can deactivate a user with role '{user.role}'")
    await user_repo.soft_delete(db, user)
