from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError
from app.repositories import user_repo
from app.schemas.bucket_config import (
    ReviewerCapacityBulkUpdate,
    ReviewerCapacityRead,
    ReviewerCapacityUpdate,
)
from app.services import bucket_config_service


async def list_capacities(db: AsyncSession) -> list[ReviewerCapacityRead]:
    """Return all active users with their capacity and org-default effective capacity."""
    cfg = await bucket_config_service.get_config(db)
    users = await user_repo.list_all_active(db)
    return [
        ReviewerCapacityRead(
            user_id=u.id,
            email=u.email,
            name=u.name,
            capacity=u.capacity,
            effective_capacity=u.capacity if u.capacity is not None else cfg.default_reviewer_capacity,
        )
        for u in users
    ]


async def update_capacity(
    db: AsyncSession, user_id: int, patch: ReviewerCapacityUpdate
) -> ReviewerCapacityRead:
    """Set or reset a single reviewer's capacity and return their updated entry."""
    user = await user_repo.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise NotFoundError(f"Active reviewer with id={user_id} not found")
    await user_repo.update_user(db, user, capacity=patch.capacity)
    cfg = await bucket_config_service.get_config(db)
    return ReviewerCapacityRead(
        user_id=user.id,
        email=user.email,
        name=user.name,
        capacity=user.capacity,
        effective_capacity=user.capacity if user.capacity is not None else cfg.default_reviewer_capacity,
    )


async def bulk_update(
    db: AsyncSession, payload: ReviewerCapacityBulkUpdate
) -> list[ReviewerCapacityRead]:
    """Atomically update capacities for a list of reviewers."""
    results = []
    for item in payload.updates:
        result = await update_capacity(db, item.user_id, ReviewerCapacityUpdate(capacity=item.capacity))
        results.append(result)
    return results
