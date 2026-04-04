from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import assignment_service


def _make_reviewer(reviewer_id: int) -> MagicMock:
    """Return a minimal mock reviewer User."""
    r = MagicMock()
    r.id = reviewer_id
    return r


def _make_call(call_id: int) -> MagicMock:
    """Return a minimal mock RawCall."""
    c = MagicMock()
    c.id = call_id
    c.call_status = None
    c.raw_transcript = None
    c.formatted_transcript = None
    c.recording_url = None
    c.service_record_json = None
    c.organization_json = None
    return c


@pytest.mark.asyncio
async def test_assign_calls_round_robin() -> None:
    """Calls are distributed evenly across reviewers in round-robin order."""
    reviewers = [_make_reviewer(1), _make_reviewer(2), _make_reviewer(3)]
    calls = [_make_call(i) for i in range(6)]
    test_date = date(2026, 4, 4)
    db = AsyncMock()

    with (
        patch("app.services.assignment_service.user_repo.list_active_reviewers", AsyncMock(return_value=reviewers)),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", AsyncMock(return_value=calls)),
        patch("app.services.assignment_service._build_reviewer_load", AsyncMock(return_value={})),
        patch("app.services.assignment_service.eval_repo.create_bulk", AsyncMock(return_value=[])) as mock_bulk,
    ):
        count = await assignment_service.assign_calls_for_date(db, test_date)

    assert count == 6
    created_records = mock_bulk.call_args[0][1]
    assigned_ids = [r.assigned_to for r in created_records]
    assert assigned_ids == [1, 2, 3, 1, 2, 3]


@pytest.mark.asyncio
async def test_assign_calls_respects_cap() -> None:
    """Calls beyond MAX_CALLS_PER_REVIEWER per reviewer are not assigned."""
    reviewer = _make_reviewer(1)
    calls = [_make_call(i) for i in range(5)]
    test_date = date(2026, 4, 4)
    db = AsyncMock()

    cap = assignment_service.MAX_CALLS_PER_REVIEWER
    with (
        patch("app.services.assignment_service.user_repo.list_active_reviewers", AsyncMock(return_value=[reviewer])),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", AsyncMock(return_value=calls)),
        patch("app.services.assignment_service._build_reviewer_load", AsyncMock(return_value={1: cap})),
        patch("app.services.assignment_service.eval_repo.create_bulk", AsyncMock(return_value=[])) as mock_bulk,
    ):
        count = await assignment_service.assign_calls_for_date(db, test_date)

    assert count == 0
    mock_bulk.assert_not_awaited()


@pytest.mark.asyncio
async def test_assign_calls_no_reviewers() -> None:
    """Returns 0 immediately when there are no active reviewers."""
    db = AsyncMock()
    with patch("app.services.assignment_service.user_repo.list_active_reviewers", AsyncMock(return_value=[])):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))
    assert count == 0
