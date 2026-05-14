import json
import logging

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DEFAULT_BUCKET_PROBABILITIES, DEFAULT_REVIEWER_CAPACITY, DEFAULT_SPECIAL_MINIMUMS
from app.repositories import system_setting_repo
from app.schemas.bucket_config import (
    BucketConfigRead,
    BucketConfigSystemDefaults,
    BucketConfigUpdate,
    BucketProbabilities,
    SpecialTypeMinimums,
)

logger = logging.getLogger(__name__)

SETTING_BUCKET_PROBABILITIES = "bucket_probabilities"
SETTING_DEFAULT_REVIEWER_CAPACITY = "default_reviewer_capacity"
SETTING_SPECIAL_MINIMUMS = "special_type_minimums"


async def get_config(db: AsyncSession) -> BucketConfigRead:
    """Return current bucket distribution config from DB, falling back to code defaults."""
    raw_probs = await system_setting_repo.get(db, SETTING_BUCKET_PROBABILITIES)
    raw_capacity = await system_setting_repo.get(db, SETTING_DEFAULT_REVIEWER_CAPACITY)
    raw_minimums = await system_setting_repo.get(db, SETTING_SPECIAL_MINIMUMS)

    if raw_probs is not None:
        try:
            probabilities = BucketProbabilities(**json.loads(raw_probs))
        except (ValidationError, ValueError, KeyError):
            # Stale row with 13-key schema from prior implementation — fall back to defaults.
            logger.warning("bucket_probabilities in system_settings is invalid; using defaults")
            probabilities = BucketProbabilities(**DEFAULT_BUCKET_PROBABILITIES)
    else:
        probabilities = BucketProbabilities(**DEFAULT_BUCKET_PROBABILITIES)

    default_capacity = int(raw_capacity) if raw_capacity is not None else DEFAULT_REVIEWER_CAPACITY

    special_minimums = (
        SpecialTypeMinimums(**json.loads(raw_minimums))
        if raw_minimums is not None
        else SpecialTypeMinimums(**DEFAULT_SPECIAL_MINIMUMS)
    )

    return BucketConfigRead(
        probabilities=probabilities,
        special_minimums=special_minimums,
        default_reviewer_capacity=default_capacity,
        system_defaults=BucketConfigSystemDefaults(
            probabilities=BucketProbabilities(**DEFAULT_BUCKET_PROBABILITIES),
            special_minimums=SpecialTypeMinimums(**DEFAULT_SPECIAL_MINIMUMS),
            reviewer_capacity=DEFAULT_REVIEWER_CAPACITY,
        ),
    )


async def update_config(db: AsyncSession, patch: BucketConfigUpdate) -> BucketConfigRead:
    """Persist changed bucket config fields and return the updated config."""
    if patch.probabilities is not None:
        await system_setting_repo.set(
            db,
            SETTING_BUCKET_PROBABILITIES,
            json.dumps(patch.probabilities.to_dict()),
        )
    if patch.special_minimums is not None:
        await system_setting_repo.set(
            db,
            SETTING_SPECIAL_MINIMUMS,
            json.dumps(patch.special_minimums.to_dict()),
        )
    if patch.default_reviewer_capacity is not None:
        await system_setting_repo.set(
            db,
            SETTING_DEFAULT_REVIEWER_CAPACITY,
            str(patch.default_reviewer_capacity),
        )
    return await get_config(db)
