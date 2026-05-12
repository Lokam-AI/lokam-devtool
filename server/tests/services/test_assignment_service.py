from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.assignment_config import AssignmentConfigRead, CallTargets, SalesCallTargets
from app.services import assignment_service


def _make_user(user_id: int) -> MagicMock:
    """Return a minimal mock User."""
    u = MagicMock()
    u.id = user_id
    return u


def _make_call(
    call_id: int,
    call_status: str = "Completed",
    nps_score: int | None = None,
    ended_reason: str | None = None,
    duration_sec: int = 60,
    call_type: str = "service",
    lead_type: str = "SERVICE_POST_RO",
) -> MagicMock:
    """Return a minimal mock RawCall."""
    c = MagicMock()
    c.id = call_id
    c.lokam_call_id = call_id
    c.call_status = call_status
    c.nps_score = nps_score
    c.ended_reason = ended_reason
    c.duration_sec = duration_sec
    c.call_type = call_type
    c.lead_type = lead_type
    c.raw_transcript = None
    c.formatted_transcript = None
    c.recording_url = None
    c.service_record_json = None
    c.organization_json = None
    return c


def _make_service_config(
    max_calls: int = 15,
    na: int = 7,
    passive: int = 0,
    detractor: int = 2,
    promoter: int = 3,
    missed: int = 3,
) -> AssignmentConfigRead:
    """Return an AssignmentConfigRead suitable for unit tests."""
    return AssignmentConfigRead(
        max_calls_per_user=max_calls,
        call_targets=CallTargets(na=na, passive=passive, detractor=detractor, promoter=promoter, missed=missed),
        sales_max_calls_per_user=2,
        sales_call_targets=SalesCallTargets(na=0, detractor=1, promoter=1),
    )


def test_categorize_calls_buckets() -> None:
    """Calls are correctly split into na, passive, promoter, detractor, and missed buckets."""
    calls = [
        _make_call(1, "Completed", None),                       # na
        _make_call(2, "Completed", 10),                         # promoter
        _make_call(3, "Completed", 9),                          # promoter
        _make_call(4, "Completed", 3),                          # detractor
        _make_call(5, "Missed", None, "voicemail"),             # missed (ended_reason in set)
        _make_call(6, "Voicemail", None, "call_screening"),     # missed (ended_reason in set)
        _make_call(7, "Completed", 7),                          # passive (NPS 7–8 range)
    ]
    buckets = assignment_service._categorize_calls(calls)
    assert len(buckets["na"]) == 1
    assert len(buckets["promoter"]) == 2
    assert len(buckets["detractor"]) == 1
    assert len(buckets["missed"]) == 2
    assert len(buckets["passive"]) == 1


def test_pick_calls_for_user_full_quota() -> None:
    """User gets exactly 15 calls when all buckets have sufficient supply."""
    config = _make_service_config()
    buckets = {
        "na": [_make_call(i) for i in range(20)],
        "promoter": [_make_call(i + 100) for i in range(10)],
        "detractor": [_make_call(i + 200) for i in range(10)],
        "missed": [_make_call(i + 300) for i in range(10)],
        "passive": [],
    }
    picks = assignment_service._pick_calls_for_user(buckets, current_load=0, config=config)
    assert len(picks) == 15
    assert len(buckets["na"]) == 13      # 20 - 7 (target)
    assert len(buckets["detractor"]) == 8  # 10 - 2 (target)
    assert len(buckets["missed"]) == 7   # 10 - 3 (target)
    assert len(buckets["promoter"]) == 7  # 10 - 3 (target)


def test_pick_calls_for_user_respects_existing_load() -> None:
    """User already at cap gets no new calls."""
    config = _make_service_config(max_calls=15)
    buckets = {"na": [_make_call(1)], "promoter": [], "detractor": [], "missed": [], "passive": []}
    picks = assignment_service._pick_calls_for_user(buckets, current_load=15, config=config)
    assert picks == []


def test_pick_calls_for_user_fallback_fill() -> None:
    """When a bucket is short, remaining slots fill from priority order."""
    config = _make_service_config()  # max=15, na=7, det=2, missed=3, pro=3, passive=0
    buckets = {
        "na": [_make_call(i) for i in range(3)],          # only 3, target is 7
        "detractor": [_make_call(i + 200) for i in range(10)],
        "missed": [_make_call(i + 300) for i in range(10)],
        "promoter": [_make_call(i + 100) for i in range(10)],
        "passive": [],
    }
    picks = assignment_service._pick_calls_for_user(buckets, current_load=0, config=config)
    assert len(picks) == 15
    assert len(buckets["na"]) == 0  # na bucket exhausted
    # After phase-1 (na=3, det=2, missed=3, pro=3, passive=0) remaining=4;
    # fallback round-robins: det→missed→pro → det (4 total), so each takes 1-2 from fallback.
    assert len(buckets["detractor"]) < 10  # at least 2 (target) picked
    assert len(buckets["promoter"]) < 10   # at least 3 (target) picked


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
    service_calls = [_make_call(i, "Completed", None) for i in range(10)]
    config = _make_service_config()
    db = AsyncMock()

    async def _unassigned_side_effect(
        db: object, call_date: object, source_env: object = None, call_type: str | None = None
    ) -> list:
        """Return service calls only; sales pool is empty."""
        return service_calls if call_type == "service" else []

    with (
        patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=users)),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", side_effect=_unassigned_side_effect),
        patch("app.services.assignment_service._build_reviewer_load", AsyncMock(return_value={})),
        patch("app.services.assignment_service.get_config", AsyncMock(return_value=config)),
        patch("app.services.assignment_service.eval_repo.create_bulk", AsyncMock(return_value=[])) as mock_bulk,
    ):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))

    assert count == 10
    mock_bulk.assert_awaited_once()
    records = mock_bulk.call_args[0][1]
    assert len(records) == 10
    # Pool of 10 is exhausted after the first user (max=15); second user gets 0.
    assigned_counts: dict[int, int] = {}
    for r in records:
        assigned_counts[r.assigned_to] = assigned_counts.get(r.assigned_to, 0) + 1
    assert sum(assigned_counts.values()) == 10
    assert len(assigned_counts) == 1  # only one user received any calls
