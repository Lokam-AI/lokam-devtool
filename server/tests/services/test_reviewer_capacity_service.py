from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.exceptions import NotFoundError
from app.schemas.bucket_config import (
    BucketConfigRead,
    BucketProbabilities,
    ReviewerCapacityUpdate,
    SpecialTypeMinimums,
)
from app.services import reviewer_capacity_service

from app.core.config import DEFAULT_BUCKET_PROBABILITIES, DEFAULT_SPECIAL_MINIMUMS


def _make_user(uid: int, capacity: int | None = None, is_active: bool = True) -> MagicMock:
    """Return a minimal mock User."""
    u = MagicMock()
    u.id = uid
    u.email = f"user{uid}@example.com"
    u.name = f"User {uid}"
    u.capacity = capacity
    u.is_active = is_active
    return u


def _cfg(default_capacity: int = 10) -> BucketConfigRead:
    """Return a minimal BucketConfigRead with the given default capacity."""
    return BucketConfigRead(
        probabilities=BucketProbabilities(**DEFAULT_BUCKET_PROBABILITIES),
        special_minimums=SpecialTypeMinimums(**DEFAULT_SPECIAL_MINIMUMS),
        default_reviewer_capacity=default_capacity,
    )


@pytest.mark.asyncio
async def test_list_capacities_effective_capacity_uses_default_when_null() -> None:
    """effective_capacity falls back to org default when user.capacity is None."""
    db = AsyncMock()
    users = [_make_user(1, capacity=None), _make_user(2, capacity=5)]
    cfg = _cfg(default_capacity=10)

    with (
        patch("app.services.reviewer_capacity_service.bucket_config_service.get_config", AsyncMock(return_value=cfg)),
        patch("app.services.reviewer_capacity_service.user_repo.list_active_reviewers", AsyncMock(return_value=users)),
    ):
        rows = await reviewer_capacity_service.list_capacities(db)

    by_id = {r.user_id: r for r in rows}
    assert by_id[1].effective_capacity == 10  # inherited default
    assert by_id[2].effective_capacity == 5   # per-user override


@pytest.mark.asyncio
async def test_update_capacity_persists_value() -> None:
    """update_capacity calls user_repo.update_user with the new capacity."""
    db = AsyncMock()
    user = _make_user(1, capacity=None)
    cfg = _cfg(default_capacity=10)

    async def _update_user(db: object, user: object, **fields: object) -> object:
        """Apply fields to mock user."""
        for k, v in fields.items():
            setattr(user, k, v)
        return user

    with (
        patch("app.services.reviewer_capacity_service.user_repo.get_by_id", AsyncMock(return_value=user)),
        patch("app.services.reviewer_capacity_service.user_repo.update_user", side_effect=_update_user),
        patch("app.services.reviewer_capacity_service.bucket_config_service.get_config", AsyncMock(return_value=cfg)),
    ):
        result = await reviewer_capacity_service.update_capacity(
            db, 1, ReviewerCapacityUpdate(capacity=8)
        )

    assert result.capacity == 8
    assert result.effective_capacity == 8


@pytest.mark.asyncio
async def test_update_capacity_reset_to_none() -> None:
    """Passing capacity=None resets per-user override; effective falls back to default."""
    db = AsyncMock()
    user = _make_user(1, capacity=8)
    cfg = _cfg(default_capacity=10)

    async def _update_user(db: object, user: object, **fields: object) -> object:
        """Apply fields to mock user."""
        for k, v in fields.items():
            setattr(user, k, v)
        return user

    with (
        patch("app.services.reviewer_capacity_service.user_repo.get_by_id", AsyncMock(return_value=user)),
        patch("app.services.reviewer_capacity_service.user_repo.update_user", side_effect=_update_user),
        patch("app.services.reviewer_capacity_service.bucket_config_service.get_config", AsyncMock(return_value=cfg)),
    ):
        result = await reviewer_capacity_service.update_capacity(
            db, 1, ReviewerCapacityUpdate(capacity=None)
        )

    assert result.capacity is None
    assert result.effective_capacity == 10


@pytest.mark.asyncio
async def test_update_capacity_not_found_raises() -> None:
    """update_capacity raises NotFoundError when user does not exist."""
    db = AsyncMock()
    with patch("app.services.reviewer_capacity_service.user_repo.get_by_id", AsyncMock(return_value=None)):
        with pytest.raises(NotFoundError):
            await reviewer_capacity_service.update_capacity(
                db, 999, ReviewerCapacityUpdate(capacity=5)
            )


@pytest.mark.asyncio
async def test_bulk_update_applies_all_entries() -> None:
    """bulk_update processes every entry in the payload atomically."""
    from app.schemas.bucket_config import ReviewerCapacityBulkUpdate, ReviewerCapacityUpdateItem

    db = AsyncMock()
    users = {1: _make_user(1, capacity=None), 2: _make_user(2, capacity=3)}
    cfg = _cfg(default_capacity=10)

    async def _get_by_id(db: object, uid: int) -> MagicMock | None:
        """Return mock user by id."""
        return users.get(uid)

    async def _update_user(db: object, user: object, **fields: object) -> object:
        """Apply fields to mock user."""
        for k, v in fields.items():
            setattr(user, k, v)
        return user

    payload = ReviewerCapacityBulkUpdate(
        updates=[
            ReviewerCapacityUpdateItem(user_id=1, capacity=7),
            ReviewerCapacityUpdateItem(user_id=2, capacity=None),
        ]
    )

    with (
        patch("app.services.reviewer_capacity_service.user_repo.get_by_id", side_effect=_get_by_id),
        patch("app.services.reviewer_capacity_service.user_repo.update_user", side_effect=_update_user),
        patch("app.services.reviewer_capacity_service.bucket_config_service.get_config", AsyncMock(return_value=cfg)),
    ):
        results = await reviewer_capacity_service.bulk_update(db, payload)

    by_id = {r.user_id: r for r in results}
    assert by_id[1].capacity == 7
    assert by_id[2].capacity is None
    assert by_id[2].effective_capacity == 10
