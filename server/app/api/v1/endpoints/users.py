from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.repositories import user_repo
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


class MentionableUser(BaseModel):
    """Minimal user info for @mention autocomplete — available to all authenticated users."""

    id: int
    name: str
    is_active: bool


@router.get("/mentionable", response_model=list[MentionableUser])
async def list_mentionable_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[MentionableUser]:
    """Return id+name of all active users for @mention autocomplete; any authenticated user."""
    users = await user_repo.list_all_active(db)
    return [MentionableUser(id=u.id, name=u.name, is_active=u.is_active) for u in users]


@router.get("", response_model=list[UserRead])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[UserRead]:
    """Return all users; admin+ only."""
    return await user_service.list_users(db)


@router.post("", response_model=UserRead, status_code=201)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> UserRead:
    """Create a new user account; admin+ only."""
    return await user_service.create_user(db, body, created_by_role=current_user.role)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRead:
    """Return a single user by id; admin+ only."""
    return await user_service.get_user(db, user_id)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> UserRead:
    """Update an existing user; admin+ only."""
    return await user_service.update_user(db, user_id, body, updated_by_role=current_user.role)


@router.delete("/{user_id}", status_code=204)
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> None:
    """Soft-delete (deactivate) a user; admin+ only."""
    await user_service.deactivate_user(db, user_id, requesting_role=current_user.role)
