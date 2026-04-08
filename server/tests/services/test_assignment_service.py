from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import assignment_service


def _make_user(user_id: int) -> MagicMock:
    """Return a minimal mock User."""
    u = MagicMock()
    u.id = user_id
    return u


def _make_call(call_id: int, call_status: str = "Completed", nps_score: int | None = None) -> MagicMock:
    """Return a minimal mock RawCall."""
    c = MagicMock()
    c.id = call_id
    c.call_status = call_status
    c.nps_score = nps_score
    c.raw_transcript = None
    c.formatted_transcript = None
    c.recording_url = None
    c.service_record_json = None
    c.organization_json = None
    return c


def test_categorize_calls_buckets() -> None:
    """Calls are correctly split into na, promoter, detractor, and missed buckets."""
    calls = [
        _make_call(1, "Completed", None),     # na
        _make_call(2, "Completed", 10),        # promoter
        _make_call(3, "Completed", 9),         # promoter
        _make_call(4, "Completed", 3),         # detractor
        _make_call(5, "Missed", None),         # missed
        _make_call(6, "Voicemail", None),      # missed
        _make_call(7, "Completed", 7),         # na (passive, not promoter/detractor)
    ]
    buckets = assignment_service._categorize_calls(calls)
    assert len(buckets["na"]) == 2
    assert len(buckets["promoter"]) == 2
    assert len(buckets["detractor"]) == 1
    assert len(buckets["missed"]) == 2


def test_pick_calls_for_user_full_quota() -> None:
    """User gets exactly 15 calls when all buckets have sufficient supply."""
    buckets = {
        "na": [_make_call(i) for i in range(20)],
        "promoter": [_make_call(i + 100) for i in range(10)],
        "detractor": [_make_call(i + 200) for i in range(10)],
        "missed": [_make_call(i + 300) for i in range(10)],
    }
    picks = assignment_service._pick_calls_for_user(buckets, current_load=0)
    assert len(picks) == 15
    assert len(buckets["na"]) == 13   # 20 - 7
    assert len(buckets["promoter"]) == 7   # 10 - 3
    assert len(buckets["detractor"]) == 8  # 10 - 2
    assert len(buckets["missed"]) == 7     # 10 - 3


def test_pick_calls_for_user_respects_existing_load() -> None:
    """User already at cap gets no new calls."""
    buckets = {"na": [_make_call(1)], "promoter": [], "detractor": [], "missed": []}
    picks = assignment_service._pick_calls_for_user(buckets, current_load=15)
    assert picks == []


def test_pick_calls_for_user_fallback_fill() -> None:
    """When a bucket is short, remaining slots fill from priority order."""
    buckets = {
        "na": [_make_call(i) for i in range(3)],   # only 3, target is 7
        "promoter": [_make_call(i + 100) for i in range(10)],
        "detractor": [_make_call(i + 200) for i in range(10)],
        "missed": [_make_call(i + 300) for i in range(10)],
    }
    picks = assignment_service._pick_calls_for_user(buckets, current_load=0)
    assert len(picks) == 15
    # na bucket exhausted
    assert len(buckets["na"]) == 0
    # promoter fills the 4 missing na slots on top of its 3 target
    assert len(buckets["promoter"]) == 3  # 10 - 3 (target) - 4 (fallback) = 3


@pytest.mark.asyncio
async def test_assign_calls_no_users() -> None:
    """Returns 0 immediately when there are no active users."""
    db = AsyncMock()
    with patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=[])):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))
    assert count == 0


@pytest.mark.asyncio
async def test_assign_calls_no_unassigned() -> None:
    """Returns 0 when there are no unassigned calls for the date."""
    db = AsyncMock()
    with (
        patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=[_make_user(1)])),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", AsyncMock(return_value=[])),
    ):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))
    assert count == 0


@pytest.mark.asyncio
async def test_assign_calls_creates_evals() -> None:
    """Eval records are created for each user-call assignment."""
    users = [_make_user(1), _make_user(2)]
    calls = [_make_call(i, "Completed", None) for i in range(10)]
    db = AsyncMock()

    with (
        patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=users)),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", AsyncMock(return_value=calls)),
        patch("app.services.assignment_service._build_reviewer_load", AsyncMock(return_value={})),
        patch("app.services.assignment_service.eval_repo.create_bulk", AsyncMock(return_value=[])) as mock_bulk,
    ):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))

    assert count == 10
    mock_bulk.assert_awaited_once()
    records = mock_bulk.call_args[0][1]
    assert len(records) == 10
    # User 1 fills up to 15: takes 7 (target) + 3 (fallback) = 10. User 2 gets 0 (pool exhausted).
    assigned_counts: dict[int, int] = {}
    for r in records:
        assigned_counts[r.assigned_to] = assigned_counts.get(r.assigned_to, 0) + 1
    assert assigned_counts.get(1) == 10
    assert assigned_counts.get(2) is None
