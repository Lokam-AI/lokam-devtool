from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.repositories import notification_repo
from app.schemas.thread import NotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationRead]:
    """Return unread and recent notifications for the current user."""
    rows = await notification_repo.list_for_user(db, current_user.id)
    return [NotificationRead.model_validate(n) for n in rows]


@router.patch("/{notification_id}/read", status_code=204)
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Mark a single notification as read."""
    await notification_repo.mark_read(db, notification_id=notification_id, user_id=current_user.id)


@router.post("/read-all", status_code=204)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Mark all notifications for the current user as read."""
    await notification_repo.mark_all_read(db, user_id=current_user.id)
