from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.thread import MessageCreate, MessageRead, MessageUpdate, ThreadRead
from app.services import comment_service

router = APIRouter(prefix="/threads", tags=["threads"])


@router.get("", response_model=ThreadRead)
async def get_thread(
    entity_type: str = Query(...),
    entity_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ThreadRead:
    """Return (or lazily create) the thread for an entity."""
    return await comment_service.get_thread(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        current_user_id=current_user.id,
    )


@router.post("/messages", response_model=MessageRead, status_code=201)
async def post_message(
    body: MessageCreate,
    entity_type: str = Query(...),
    entity_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageRead:
    """Post a new message to an entity's thread."""
    return await comment_service.post_message(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        current_user_id=current_user.id,
        body=body.body,
        attachments=body.attachments,
    )


@router.patch("/messages/{message_id}", response_model=MessageRead)
async def edit_message(
    message_id: int,
    body: MessageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageRead:
    """Edit the body of a message the caller owns."""
    return await comment_service.edit_message(
        db,
        message_id=message_id,
        current_user_id=current_user.id,
        body=body.body,
    )


@router.delete("/messages/{message_id}", status_code=204)
async def delete_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Soft-delete a message the caller owns."""
    await comment_service.delete_message(
        db,
        message_id=message_id,
        current_user_id=current_user.id,
    )
