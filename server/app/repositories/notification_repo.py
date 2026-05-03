from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.thread import Notification

EXCERPT_MAX_LEN = 140


async def create_mention_notification(
    db: AsyncSession,
    *,
    recipient_id: int,
    message_id: int,
    thread_id: int,
    entity_type: str | None,
    entity_id: int | None,
    excerpt: str,
) -> Notification:
    """Insert a mention notification for a user."""
    notification = Notification(
        recipient_id=recipient_id,
        type="mention",
        message_id=message_id,
        thread_id=thread_id,
        entity_type=entity_type,
        entity_id=entity_id,
        excerpt=excerpt[:EXCERPT_MAX_LEN],
    )
    db.add(notification)
    await db.flush()
    return notification


async def list_for_user(db: AsyncSession, user_id: int) -> list[Notification]:
    """Return all notifications for a user, unread first then recent read."""
    result = await db.execute(
        select(Notification)
        .where(Notification.recipient_id == user_id)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())


async def mark_read(db: AsyncSession, *, notification_id: int, user_id: int) -> None:
    """Mark a single notification as read; silently ignores if not owned by user."""
    await db.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.recipient_id == user_id)
        .values(is_read=True)
    )


async def mark_all_read(db: AsyncSession, *, user_id: int) -> None:
    """Mark all notifications for a user as read."""
    await db.execute(
        update(Notification)
        .where(Notification.recipient_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
