from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_superadmin
from app.models.user import User
from app.schemas.bucket_config import (
    BucketConfigRead,
    BucketConfigUpdate,
    ReviewerCapacityBulkUpdate,
    ReviewerCapacityRead,
    ReviewerCapacityUpdate,
)
from app.services import bucket_config_service, reviewer_capacity_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/bucket-config", response_model=BucketConfigRead)
async def get_bucket_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superadmin),
) -> BucketConfigRead:
    """Return the current org-level call distribution config; superadmin only."""
    return await bucket_config_service.get_config(db)


@router.patch("/bucket-config", response_model=BucketConfigRead)
async def update_bucket_config(
    body: BucketConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superadmin),
) -> BucketConfigRead:
    """Update org-level bucket probabilities and/or default reviewer capacity; superadmin only."""
    return await bucket_config_service.update_config(db, body)


@router.get("/reviewer-capacities", response_model=list[ReviewerCapacityRead])
async def list_reviewer_capacities(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superadmin),
) -> list[ReviewerCapacityRead]:
    """Return all active reviewers with their capacity settings; superadmin only."""
    return await reviewer_capacity_service.list_capacities(db)


@router.patch("/reviewer-capacities/{user_id}", response_model=ReviewerCapacityRead)
async def update_reviewer_capacity(
    user_id: int,
    body: ReviewerCapacityUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superadmin),
) -> ReviewerCapacityRead:
    """Set or reset a single reviewer's capacity; superadmin only."""
    return await reviewer_capacity_service.update_capacity(db, user_id, body)


@router.put("/reviewer-capacities", response_model=list[ReviewerCapacityRead])
async def bulk_update_reviewer_capacities(
    body: ReviewerCapacityBulkUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superadmin),
) -> list[ReviewerCapacityRead]:
    """Atomically update capacities for multiple reviewers; superadmin only."""
    return await reviewer_capacity_service.bulk_update(db, body)
