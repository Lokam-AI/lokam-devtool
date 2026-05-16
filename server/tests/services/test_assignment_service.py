from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.config import DEFAULT_BUCKET_PROBABILITIES, DEFAULT_REVIEWER_CAPACITY, DEFAULT_SPECIAL_MINIMUMS
from app.schemas.bucket_config import (
    NPS_BUCKET_KEYS,
    SPECIAL_KEYS,
    BucketConfigRead,
    BucketConfigSystemDefaults,
    BucketProbabilities,
    SpecialTypeMinimums,
)
from app.services import assignment_service

_SYSTEM_DEFAULTS = BucketConfigSystemDefaults(
    probabilities=BucketProbabilities(**DEFAULT_BUCKET_PROBABILITIES),
    special_minimums=SpecialTypeMinimums(**DEFAULT_SPECIAL_MINIMUMS),
    reviewer_capacity=DEFAULT_REVIEWER_CAPACITY,
)


def _make_user(user_id: int, capacity: int | None = None) -> MagicMock:
    """Return a minimal mock User."""
    u = MagicMock()
    u.id = user_id
    u.capacity = capacity
    u.rooftop_name = None
    u.organization_name = None
    return u


def _make_call(
    call_id: int,
    call_status: str = "Completed",
    nps_score: int | None = None,
    ended_reason: str | None = None,
    duration_sec: int = 60,
    call_type: str = "service",
    is_dnc_request: bool = False,
    lead_escalated: bool = False,
    review_link_sent: bool = False,
    is_post_call_sms_survey: bool = False,
    call_metadata: dict | None = None,
    rooftop_name: str | None = None,
    organization_name: str | None = None,
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
    c.is_dnc_request = is_dnc_request
    c.lead_escalated = lead_escalated
    c.review_link_sent = review_link_sent
    c.is_post_call_sms_survey = is_post_call_sms_survey
    c.call_metadata = call_metadata
    c.lead_type = "SERVICE_POST_RO"
    c.raw_transcript = None
    c.formatted_transcript = None
    c.recording_url = None
    c.service_record_json = None
    c.organization_json = None
    c.rooftop_name = rooftop_name
    c.organization_name = organization_name
    return c


def _zero_special_minimums() -> SpecialTypeMinimums:
    """Return SpecialTypeMinimums with all zeros — disables phase 1 for most tests."""
    return SpecialTypeMinimums(dnc=0, email_send=0, lead_escalated=0, review_link_sent=0, post_call_sms=0)


def _make_bucket_config(
    probs: dict[str, float] | None = None,
    default_capacity: int = 10,
    special_minimums: SpecialTypeMinimums | None = None,
) -> BucketConfigRead:
    """Return a BucketConfigRead for unit tests. Defaults to uniform NPS distribution and zero specials."""
    if probs is None:
        per_bucket = round(1.0 / len(NPS_BUCKET_KEYS), 6)
        probs = {k: per_bucket for k in NPS_BUCKET_KEYS}
        total = sum(probs.values())
        last_key = NPS_BUCKET_KEYS[-1]
        probs[last_key] = round(probs[last_key] + (1.0 - total), 6)
    if special_minimums is None:
        special_minimums = _zero_special_minimums()
    return BucketConfigRead(
        probabilities=BucketProbabilities(**probs),
        special_minimums=special_minimums,
        default_reviewer_capacity=default_capacity,
        system_defaults=_SYSTEM_DEFAULTS,
    )


def _make_flat_probs(**overrides: float) -> dict[str, float]:
    """Build a flat NPS probability dict summing to 1.0, evenly distributed unless overridden."""
    base = {k: 0.0 for k in NPS_BUCKET_KEYS}
    base.update(overrides)
    total = sum(base.values())
    if total == 0:
        base[NPS_BUCKET_KEYS[0]] = 1.0
    else:
        scale = 1.0 / total
        base = {k: round(v * scale, 10) for k, v in base.items()}
    return base


# ── Hamilton rounding ──────────────────────────────────────────────────────────

def test_hamilton_round_sums_to_pool() -> None:
    """Hamilton rounding distributes exactly total_pool seats."""
    probs = BucketProbabilities(**_make_flat_probs(**{k: 1.0 for k in NPS_BUCKET_KEYS}))
    result = assignment_service._hamilton_round(probs, 100)
    assert sum(result.values()) == 100


def test_hamilton_round_zero_prob_yields_zero() -> None:
    """A bucket with probability 0 receives 0 calls."""
    flat = {k: 1.0 / (len(NPS_BUCKET_KEYS) - 1) if k != "service_passive" else 0.0 for k in NPS_BUCKET_KEYS}
    total = sum(flat.values())
    flat = {k: v / total for k, v in flat.items()}
    probs = BucketProbabilities(**flat)
    result = assignment_service._hamilton_round(probs, 50)
    assert result["service_passive"] == 0
    assert sum(result.values()) == 50


# ── Bucket categorisation ──────────────────────────────────────────────────────

def test_build_buckets_nps_service() -> None:
    """Service calls land in the correct NPS bucket."""
    calls = [
        _make_call(1, "Completed", None, duration_sec=60),       # service_na
        _make_call(2, "Completed", 10),                           # service_promoter
        _make_call(3, "Completed", 9),                            # service_promoter
        _make_call(4, "Completed", 3),                            # service_detractor
        _make_call(5, "Missed", None, "voicemail"),               # service_missed
        _make_call(6, "Completed", 7),                            # service_passive
    ]
    buckets = assignment_service._build_buckets(calls)
    assert len(buckets["service_na"]) == 1
    assert len(buckets["service_promoter"]) == 2
    assert len(buckets["service_detractor"]) == 1
    assert len(buckets["service_missed"]) == 1
    assert len(buckets["service_passive"]) == 1


def test_build_buckets_nps_sales() -> None:
    """Sales calls land in the correct NPS bucket."""
    calls = [
        _make_call(1, "Completed", 10, call_type="sales"),        # sales_promoter
        _make_call(2, "Completed", 5, call_type="sales"),         # sales_detractor
        _make_call(3, "Completed", None, call_type="sales"),      # sales_na
    ]
    buckets = assignment_service._build_buckets(calls)
    assert len(buckets["sales_promoter"]) == 1
    assert len(buckets["sales_detractor"]) == 1
    assert len(buckets["sales_na"]) == 1


def test_build_buckets_special_overlap_dnc() -> None:
    """A service-detractor call that is also DNC appears in both buckets."""
    call = _make_call(1, "Completed", 3, is_dnc_request=True)
    buckets = assignment_service._build_buckets([call])
    assert call in buckets["service_detractor"]
    assert call in buckets["dnc"]


def test_build_buckets_email_send_reads_metadata() -> None:
    """email_send bucket uses call_metadata JSONB key."""
    call = _make_call(1, "Completed", None, call_metadata={"email_send": True})
    buckets = assignment_service._build_buckets([call])
    assert call in buckets["email_send"]


def test_build_buckets_email_send_missing_key() -> None:
    """Calls without email_send metadata do not land in email_send bucket."""
    call = _make_call(1, "Completed", None, call_metadata={"other": True})
    buckets = assignment_service._build_buckets([call])
    assert call not in buckets["email_send"]


# ── NA duration filter ──────────────────────────────────────────────────────────

def test_pick_na_calls_prefers_long() -> None:
    """Long calls are preferred; at most one short call allowed."""
    long_call = _make_call(1, duration_sec=60)
    short_call = _make_call(2, duration_sec=20)
    picks = assignment_service._pick_na_calls([long_call, short_call], count=2)
    assert long_call in picks
    assert short_call in picks
    assert len(picks) == 2


def test_pick_na_calls_at_most_one_short() -> None:
    """Only one short call is picked even if multiple are available."""
    short_calls = [_make_call(i, duration_sec=10) for i in range(5)]
    picks = assignment_service._pick_na_calls(short_calls, count=3)
    assert len(picks) == 1


def test_na_duration_filter_preserved_in_sample() -> None:
    """service_na bucket sampling admits at most one short call in the org-level draw."""
    short_nas = [_make_call(i, duration_sec=5) for i in range(10)]
    long_nas = [_make_call(i + 100, duration_sec=90) for i in range(10)]
    buckets = {k: [] for k in assignment_service.ALL_BUCKET_KEYS}
    buckets["service_na"] = short_nas + long_nas
    targets = {k: 0 for k in NPS_BUCKET_KEYS}
    targets["service_na"] = 5
    picks = assignment_service._phase2_nps_picks(buckets, targets, _zero_special_minimums())
    short_picks = [p for p in picks if (p.duration_sec or 0) < 40]
    assert len(short_picks) <= 1


# ── Phase 2 priority sort: special minimums satisfied within NPS picks ─────────

def test_phase2_priority_prefers_dnc_call_over_plain() -> None:
    """Within an NPS bucket, a DNC call is picked before a plain call when DNC minimum unsatisfied."""
    call_dnc = _make_call(1, "Completed", 3, is_dnc_request=True)
    call_plain = _make_call(2, "Completed", 3)
    buckets = {k: [] for k in assignment_service.ALL_BUCKET_KEYS}
    buckets["service_detractor"] = [call_plain, call_dnc]  # plain first in list
    buckets["dnc"] = [call_dnc]
    targets = {k: 0 for k in NPS_BUCKET_KEYS}
    targets["service_detractor"] = 1
    minimums = SpecialTypeMinimums(dnc=1, email_send=0, lead_escalated=0, review_link_sent=0, post_call_sms=0)
    picks = assignment_service._phase2_nps_picks(buckets, targets, minimums)
    assert len(picks) == 1
    assert picks[0].lokam_call_id == call_dnc.lokam_call_id


def test_phase2_priority_prefers_multi_special_over_single() -> None:
    """A call satisfying 2 unsatisfied specials sorts above a call satisfying only 1."""
    call_both = _make_call(1, "Completed", 3, is_dnc_request=True, call_metadata={"email_send": True})
    call_dnc_only = _make_call(2, "Completed", 3, is_dnc_request=True)
    call_plain = _make_call(3, "Completed", 3)
    buckets = {k: [] for k in assignment_service.ALL_BUCKET_KEYS}
    buckets["service_detractor"] = [call_dnc_only, call_both, call_plain]  # both not first
    buckets["dnc"] = [call_dnc_only, call_both]
    buckets["email_send"] = [call_both]
    targets = {k: 0 for k in NPS_BUCKET_KEYS}
    targets["service_detractor"] = 1
    minimums = SpecialTypeMinimums(dnc=1, email_send=1, lead_escalated=0, review_link_sent=0, post_call_sms=0)
    picks = assignment_service._phase2_nps_picks(buckets, targets, minimums)
    assert len(picks) == 1
    assert picks[0].lokam_call_id == call_both.lokam_call_id


def test_phase2_special_credited_across_nps_buckets() -> None:
    """DNC picked from service_detractor decrements DNC need; next NPS bucket no longer prioritises DNC."""
    call_dnc = _make_call(1, "Completed", 3, is_dnc_request=True)
    call_plain_det = _make_call(2, "Completed", 3)
    call_dnc_promo = _make_call(3, "Completed", 10, is_dnc_request=True)
    call_plain_promo = _make_call(4, "Completed", 10)
    buckets = {k: [] for k in assignment_service.ALL_BUCKET_KEYS}
    buckets["service_detractor"] = [call_plain_det, call_dnc]
    buckets["service_promoter"] = [call_plain_promo, call_dnc_promo]
    buckets["dnc"] = [call_dnc, call_dnc_promo]
    targets = {k: 0 for k in NPS_BUCKET_KEYS}
    targets["service_detractor"] = 1
    targets["service_promoter"] = 1
    minimums = SpecialTypeMinimums(dnc=1, email_send=0, lead_escalated=0, review_link_sent=0, post_call_sms=0)
    picks = assignment_service._phase2_nps_picks(buckets, targets, minimums)
    picked_ids = {p.lokam_call_id for p in picks}
    # DNC filled by detractor pick; promoter bucket picks plain (DNC need already 0 → no sort boost)
    assert call_dnc.lokam_call_id in picked_ids
    assert len(picks) == 2


def test_phase2_zero_minimum_no_priority_effect() -> None:
    """When all special minimums are zero, picks equal top-N by original list order."""
    call_dnc = _make_call(1, "Completed", 3, is_dnc_request=True)
    call_plain = _make_call(2, "Completed", 3)
    buckets = {k: [] for k in assignment_service.ALL_BUCKET_KEYS}
    buckets["service_detractor"] = [call_plain, call_dnc]  # plain first
    buckets["dnc"] = [call_dnc]
    targets = {k: 0 for k in NPS_BUCKET_KEYS}
    targets["service_detractor"] = 1
    picks = assignment_service._phase2_nps_picks(buckets, targets, _zero_special_minimums())
    assert len(picks) == 1
    assert picks[0].lokam_call_id == call_plain.lokam_call_id  # plain first, no sort applied


def test_phase2_full_pool_used() -> None:
    """Hamilton targets sum equals total_pool (not reduced by special minimums)."""
    total_pool = 10
    probs = BucketProbabilities(**_make_flat_probs(**{k: 1.0 for k in NPS_BUCKET_KEYS}))
    targets = assignment_service._hamilton_round(probs, total_pool)
    assert sum(targets.values()) == total_pool


# ── Phase 2: dedup within NPS ─────────────────────────────────────────────────


def test_phase2_deduplicates_within_nps() -> None:
    """A call that appears in multiple NPS buckets is only picked once."""
    call = _make_call(1, "Completed", 3, is_dnc_request=True)
    buckets = {k: [] for k in assignment_service.ALL_BUCKET_KEYS}
    buckets["service_detractor"] = [call]
    targets = {k: 0 for k in NPS_BUCKET_KEYS}
    targets["service_detractor"] = 1
    picks = assignment_service._phase2_nps_picks(buckets, targets, _zero_special_minimums())
    assert len(picks) == 1


# ── Distribute ────────────────────────────────────────────────────────────────

def test_distribute_respects_remaining_capacity() -> None:
    """Each user receives at most their remaining capacity."""
    users = [_make_user(1), _make_user(2)]
    remaining = {1: 3, 2: 2}
    picks = [_make_call(i) for i in range(10)]
    records = assignment_service._distribute(picks, users, remaining)
    counts: dict[int, int] = {}
    for r in records:
        counts[r.assigned_to] = counts.get(r.assigned_to, 0) + 1
    assert counts.get(1, 0) <= 3
    assert counts.get(2, 0) <= 2
    assert sum(counts.values()) == 5  # total pool = 3 + 2


def test_distribute_reviewer_capacity_zero_gets_no_calls() -> None:
    """A user with remaining=0 receives no calls."""
    users = [_make_user(1), _make_user(2)]
    remaining = {1: 0, 2: 5}
    picks = [_make_call(i) for i in range(3)]
    records = assignment_service._distribute(picks, users, remaining)
    assigned_to = {r.assigned_to for r in records}
    assert 1 not in assigned_to


def test_distribute_short_na_capped_per_reviewer() -> None:
    """Each reviewer gets at most one short NA call."""
    user1, user2 = _make_user(1), _make_user(2)
    short_na_calls = [_make_call(i, duration_sec=5) for i in range(10)]
    remaining = {1: 5, 2: 5}
    records = assignment_service._distribute(short_na_calls, [user1, user2], remaining)
    for uid in (1, 2):
        assert len([r for r in records if r.assigned_to == uid]) <= 1


# ── Full async flow ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_assign_calls_no_users_returns_zero() -> None:
    """Returns 0 immediately when there are no active users."""
    db = AsyncMock()
    with patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=[])):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))
    assert count == 0


@pytest.mark.asyncio
async def test_assign_calls_no_unassigned_returns_zero() -> None:
    """Returns 0 when all calls are already assigned (empty unassigned pool)."""
    db = AsyncMock()
    cfg = _make_bucket_config(default_capacity=5)
    user = _make_user(1)
    with (
        patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=[user])),
        patch("app.services.assignment_service.bucket_config_service.get_config", AsyncMock(return_value=cfg)),
        patch("app.services.assignment_service._build_unified_load", AsyncMock(return_value={})),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", AsyncMock(return_value=[])),
    ):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))
    assert count == 0


@pytest.mark.asyncio
async def test_assign_calls_total_capacity_zero_returns_zero() -> None:
    """Returns 0 when all users are already at cap (no remaining capacity)."""
    db = AsyncMock()
    cfg = _make_bucket_config(default_capacity=5)
    user = _make_user(1)
    with (
        patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=[user])),
        patch("app.services.assignment_service.bucket_config_service.get_config", AsyncMock(return_value=cfg)),
        patch("app.services.assignment_service._build_unified_load", AsyncMock(return_value={1: 5})),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", AsyncMock(return_value=[])),
    ):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))
    assert count == 0


@pytest.mark.asyncio
async def test_assign_calls_creates_evals() -> None:
    """Eval records are created proportional to NPS bucket probabilities (phase2 only)."""
    users = [_make_user(1), _make_user(2)]
    service_calls = [_make_call(i, "Completed", None, duration_sec=90) for i in range(10)]
    probs = {k: 0.0 for k in NPS_BUCKET_KEYS}
    probs["service_na"] = 1.0
    cfg = _make_bucket_config(probs=probs, default_capacity=5)
    db = AsyncMock()

    async def _unassigned(db: object, call_date: object, source_env: object = None, call_type: str | None = None) -> list:
        """Return service calls only; sales pool is empty."""
        return service_calls if call_type == "service" else []

    with (
        patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=users)),
        patch("app.services.assignment_service.bucket_config_service.get_config", AsyncMock(return_value=cfg)),
        patch("app.services.assignment_service._build_unified_load", AsyncMock(return_value={})),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", side_effect=_unassigned),
        patch("app.services.assignment_service.eval_repo.create_bulk", AsyncMock(return_value=[])) as mock_bulk,
    ):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))

    assert count == 10
    mock_bulk.assert_awaited_once()
    records = mock_bulk.call_args[0][1]
    assert len(records) == 10


@pytest.mark.asyncio
async def test_pool_matches_sum_of_capacities() -> None:
    """Total pool equals sum of remaining capacities across all users."""
    users = [_make_user(i, capacity=5) for i in range(1, 4)]  # 3 users, cap 5 each → pool 15
    probs = {k: 0.0 for k in NPS_BUCKET_KEYS}
    probs["service_na"] = 1.0
    cfg = _make_bucket_config(probs=probs, default_capacity=5)
    db = AsyncMock()
    calls = [_make_call(i, "Completed", None, duration_sec=90) for i in range(20)]

    async def _unassigned(db: object, call_date: object, source_env: object = None, call_type: str | None = None) -> list:
        """Return service calls only; sales pool is empty."""
        return calls if call_type == "service" else []

    with (
        patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=users)),
        patch("app.services.assignment_service.bucket_config_service.get_config", AsyncMock(return_value=cfg)),
        patch("app.services.assignment_service._build_unified_load", AsyncMock(return_value={})),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", side_effect=_unassigned),
        patch("app.services.assignment_service.eval_repo.create_bulk", AsyncMock(return_value=[])) as mock_bulk,
    ):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))

    assert count == 15  # pool = 3 × 5


@pytest.mark.asyncio
async def test_default_capacity_used_when_user_capacity_null() -> None:
    """User with capacity=None inherits default_reviewer_capacity."""
    user = _make_user(1, capacity=None)
    probs = {k: 0.0 for k in NPS_BUCKET_KEYS}
    probs["service_na"] = 1.0
    cfg = _make_bucket_config(probs=probs, default_capacity=7)
    db = AsyncMock()
    calls = [_make_call(i, "Completed", None, duration_sec=90) for i in range(20)]

    async def _unassigned(db: object, call_date: object, source_env: object = None, call_type: str | None = None) -> list:
        """Return service calls only."""
        return calls if call_type == "service" else []

    with (
        patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=[user])),
        patch("app.services.assignment_service.bucket_config_service.get_config", AsyncMock(return_value=cfg)),
        patch("app.services.assignment_service._build_unified_load", AsyncMock(return_value={})),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", side_effect=_unassigned),
        patch("app.services.assignment_service.eval_repo.create_bulk", AsyncMock(return_value=[])) as mock_bulk,
    ):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))

    assert count == 7  # inherited default capacity


@pytest.mark.asyncio
async def test_partial_supply_assigns_available_continues_other_buckets() -> None:
    """When one bucket has fewer calls than target, assignment continues with other buckets."""
    users = [_make_user(1, capacity=10)]
    probs = {k: 0.0 for k in NPS_BUCKET_KEYS}
    probs["service_na"] = 0.5
    probs["service_promoter"] = 0.5
    cfg = _make_bucket_config(probs=probs, default_capacity=10)
    db = AsyncMock()
    na_calls = [_make_call(i, "Completed", None, duration_sec=90) for i in range(2)]
    promoter_calls = [_make_call(i + 100, "Completed", 10) for i in range(10)]
    all_calls = na_calls + promoter_calls

    async def _unassigned(db: object, call_date: object, source_env: object = None, call_type: str | None = None) -> list:
        """Return all calls for service."""
        return all_calls if call_type == "service" else []

    with (
        patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=users)),
        patch("app.services.assignment_service.bucket_config_service.get_config", AsyncMock(return_value=cfg)),
        patch("app.services.assignment_service._build_unified_load", AsyncMock(return_value={})),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", side_effect=_unassigned),
        patch("app.services.assignment_service.eval_repo.create_bulk", AsyncMock(return_value=[])) as mock_bulk,
    ):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))

    # NA had 2 (vs target 5), promoter has 5. Total picks = 7, distributed to user (cap 10).
    assert count == 7


@pytest.mark.asyncio
async def test_two_phase_total_at_most_pool() -> None:
    """Assignments with special minimums never exceed total_pool."""
    users = [_make_user(1, capacity=5), _make_user(2, capacity=5)]  # pool = 10
    probs = {k: 0.0 for k in NPS_BUCKET_KEYS}
    probs["service_na"] = 1.0
    dnc_calls = [_make_call(i, is_dnc_request=True, call_type="service", nps_score=None, duration_sec=90) for i in range(20)]
    na_calls = [_make_call(i + 100, "Completed", None, duration_sec=90) for i in range(20)]
    # Special minimum: dnc=3
    special_minimums = SpecialTypeMinimums(dnc=3, email_send=0, lead_escalated=0, review_link_sent=0, post_call_sms=0)
    cfg = _make_bucket_config(probs=probs, default_capacity=5, special_minimums=special_minimums)
    db = AsyncMock()

    async def _unassigned(db: object, call_date: object, source_env: object = None, call_type: str | None = None) -> list:
        """Return both DNC and NA calls for service."""
        return dnc_calls + na_calls if call_type == "service" else []

    with (
        patch("app.services.assignment_service.user_repo.list_all_active", AsyncMock(return_value=users)),
        patch("app.services.assignment_service.bucket_config_service.get_config", AsyncMock(return_value=cfg)),
        patch("app.services.assignment_service._build_unified_load", AsyncMock(return_value={})),
        patch("app.services.assignment_service.raw_call_repo.get_unassigned_for_date", side_effect=_unassigned),
        patch("app.services.assignment_service.eval_repo.create_bulk", AsyncMock(return_value=[])) as mock_bulk,
    ):
        count = await assignment_service.assign_calls_for_date(db, date(2026, 4, 4))

    assert count <= 10  # never exceeds pool
