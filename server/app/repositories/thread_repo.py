from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError, PermissionDeniedError
from app.models.thread import Message, Thread
from app.models.user import User
from app.schemas.thread import AttachmentRead

EXCERPT_MAX_LEN = 140


async def get_or_create_thread(
    db: AsyncSession,
    *,
    kind: str,
    entity_type: str,
    entity_id: int,
    created_by: int,
) -> Thread:
    """Return the existing thread for this entity or create one on first use."""
    result = await db.execute(
        select(Thread).where(
            Thread.entity_type == entity_type,
            Thread.entity_id == entity_id,
            Thread.kind == kind,
        )
    )
    thread = result.scalar_one_or_none()
    if thread is None:
        thread = Thread(
            kind=kind,
            entity_type=entity_type,
            entity_id=entity_id,
            created_by=created_by,
        )
        db.add(thread)
        await db.flush()
    return thread


async def list_messages(db: AsyncSession, thread_id: int) -> list[tuple[Message, str]]:
    """Return all non-deleted messages for a thread with the author's name."""
    result = await db.execute(
        select(Message, User.name)
        .join(User, User.id == Message.user_id)
        .where(Message.thread_id == thread_id)
        .order_by(Message.created_at.asc())
    )
    return result.all()


async def create_message(
    db: AsyncSession,
    *,
    thread_id: int,
    user_id: int,
    body: str,
    attachments: list[AttachmentRead],
) -> Message:
    """Insert a new message into a thread and return it."""
    msg = Message(
        thread_id=thread_id,
        user_id=user_id,
        body=body,
        attachments=[a.model_dump() for a in attachments],
    )
    db.add(msg)
    await db.flush()
    return msg


async def edit_message(
    db: AsyncSession,
    *,
    message_id: int,
    user_id: int,
    body: str,
) -> Message:
    """Update message body and set edited_at; raises if caller is not the owner or message is deleted."""
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if msg is None:
        raise NotFoundError("Message not found")
    if msg.deleted_at is not None:
        raise NotFoundError("Message has been deleted")
    if msg.user_id != user_id:
        raise PermissionDeniedError("Cannot edit another user's message")
    msg.body = body
    msg.edited_at = datetime.utcnow()
    await db.flush()
    return msg


async def soft_delete_message(
    db: AsyncSession,
    *,
    message_id: int,
    user_id: int,
) -> None:
    """Set deleted_at on a message; raises if caller is not the owner."""
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if msg is None:
        raise NotFoundError("Message not found")
    if msg.user_id != user_id:
        raise PermissionDeniedError("Cannot delete another user's message")
    msg.deleted_at = datetime.utcnow()
    await db.flush()
