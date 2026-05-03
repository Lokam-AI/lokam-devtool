import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.thread import Message as MessageModel
from app.repositories import notification_repo, thread_repo, user_repo
from app.schemas.thread import AttachmentRead, MessageRead, ThreadRead

_MENTION_RE = re.compile(r"@(\S+)")
THREAD_KIND_ENTITY = "entity"
EXCERPT_MAX_LEN = 140


def _build_message_read(msg: MessageModel, user_name: str) -> MessageRead:
    """Convert a Message ORM row + user_name string into a MessageRead schema."""
    return MessageRead(
        id=msg.id,
        thread_id=msg.thread_id,
        user_id=msg.user_id,
        user_name=user_name,
        body=msg.body if msg.deleted_at is None else None,
        created_at=msg.created_at,
        edited_at=msg.edited_at,
        deleted_at=msg.deleted_at,
        attachments=msg.attachments or [],
    )


async def get_thread(
    db: AsyncSession,
    *,
    entity_type: str,
    entity_id: int,
    current_user_id: int,
) -> ThreadRead:
    """Return the thread for an entity, creating it if it does not yet exist."""
    thread = await thread_repo.get_or_create_thread(
        db,
        kind=THREAD_KIND_ENTITY,
        entity_type=entity_type,
        entity_id=entity_id,
        created_by=current_user_id,
    )
    rows = await thread_repo.list_messages(db, thread.id)
    messages = [_build_message_read(msg, name) for msg, name in rows]
    return ThreadRead(id=thread.id, messages=messages)


async def post_message(
    db: AsyncSession,
    *,
    entity_type: str,
    entity_id: int,
    current_user_id: int,
    body: str,
    attachments: list[AttachmentRead],
) -> MessageRead:
    """Post a message to an entity's thread, creating the thread if needed, and fire mention notifications."""
    thread = await thread_repo.get_or_create_thread(
        db,
        kind=THREAD_KIND_ENTITY,
        entity_type=entity_type,
        entity_id=entity_id,
        created_by=current_user_id,
    )
    current_user = await user_repo.get_by_id(db, current_user_id)
    user_name = current_user.name if current_user else str(current_user_id)

    msg = await thread_repo.create_message(
        db,
        thread_id=thread.id,
        user_id=current_user_id,
        body=body,
        attachments=attachments,
    )
    await _fire_mention_notifications(
        db,
        body=body,
        message_id=msg.id,
        thread_id=thread.id,
        entity_type=entity_type,
        entity_id=entity_id,
        sender_id=current_user_id,
        previous_mentions=set(),
    )
    return _build_message_read(msg, user_name)


async def edit_message(
    db: AsyncSession,
    *,
    message_id: int,
    current_user_id: int,
    body: str,
) -> MessageRead:
    """Edit a message body; only notifies users who are newly @mentioned."""
    result = await db.execute(select(MessageModel).where(MessageModel.id == message_id))
    existing = result.scalar_one_or_none()
    old_body = existing.body or "" if existing else ""
    old_mentions = _extract_mention_names(old_body)

    msg = await thread_repo.edit_message(db, message_id=message_id, user_id=current_user_id, body=body)

    await _fire_mention_notifications(
        db,
        body=body,
        message_id=msg.id,
        thread_id=msg.thread_id,
        entity_type=None,
        entity_id=None,
        sender_id=current_user_id,
        previous_mentions=old_mentions,
    )

    current_user = await user_repo.get_by_id(db, current_user_id)
    user_name = current_user.name if current_user else str(current_user_id)
    return _build_message_read(msg, user_name)


async def delete_message(
    db: AsyncSession,
    *,
    message_id: int,
    current_user_id: int,
) -> None:
    """Soft-delete a message; only the author may delete."""
    await thread_repo.soft_delete_message(db, message_id=message_id, user_id=current_user_id)


def _extract_mention_names(body: str) -> set[str]:
    """Return the set of @-mentioned names found in a message body."""
    return {m.group(1).lower() for m in _MENTION_RE.finditer(body)}


async def _fire_mention_notifications(
    db: AsyncSession,
    *,
    body: str,
    message_id: int,
    thread_id: int,
    entity_type: str | None,
    entity_id: int | None,
    sender_id: int,
    previous_mentions: set[str],
) -> None:
    """Insert mention notifications for users newly @mentioned in body."""
    current_mentions = _extract_mention_names(body)
    new_mentions = current_mentions - previous_mentions
    if not new_mentions:
        return

    active_users = await user_repo.list_all_active(db)
    # Index by full name and by first word so "@John" matches "John Doe"
    name_to_user: dict[str, object] = {}
    for u in active_users:
        full = u.name.lower()
        first = full.split()[0] if full else full
        name_to_user[full] = u
        if first not in name_to_user:
            name_to_user[first] = u
    excerpt = body[:EXCERPT_MAX_LEN]

    for mention_name in new_mentions:
        target = name_to_user.get(mention_name)
        if target is None or target.id == sender_id:
            continue
        await notification_repo.create_mention_notification(
            db,
            recipient_id=target.id,
            message_id=message_id,
            thread_id=thread_id,
            entity_type=entity_type,
            entity_id=entity_id,
            excerpt=excerpt,
        )
