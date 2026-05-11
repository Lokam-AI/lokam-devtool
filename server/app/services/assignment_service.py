from __future__ import annotations

import random
from collections import defaultdict
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import FILL_PRIORITY, SALES_FILL_PRIORITY
from app.models.eval import Eval
from app.models.raw_call import RawCall
from app.repositories import eval_repo, raw_call_repo, user_repo
from app.schemas.eval import EvalCreate
from app.schemas.assignment_config import AssignmentConfigRead, SalesCallTargets
from app.services.assignment_config_service import get_config

PROMOTER_NPS_MIN = 9
DETRACTOR_NPS_MAX = 6

# Sales NPS from lokamspace voice agent is tri-valued: 10=promoter, 5=detractor, null=na.
SALES_NPS_PROMOTER = 10
SALES_NPS_DETRACTOR = 5

CALL_TYPE_SERVICE = "service"
CALL_TYPE_SALES = "sales"
SUPPORTED_CALL_TYPES: tuple[str, ...] = (CALL_TYPE_SERVICE, CALL_TYPE_SALES)


async def assign_calls_for_date(db: AsyncSession, call_date: date, source_env: str | None = None) -> int:
    """Assign unassigned calls of every supported call_type to active users; return total Evals created."""
    users = await user_repo.list_all_active(db)
    if not users:
        return 0

    total = 0
    for call_type in SUPPORTED_CALL_TYPES:
        total += await _assign_for_call_type(db, users, call_date, call_type, source_env)
    return total


async def _assign_for_call_type(
    db: AsyncSession,
    users: list,
    call_date: date,
    call_type: str,
    source_env: str | None,
) -> int:
    """Assign unassigned calls of one call_type using the strategy appropriate for that type."""
    unassigned = await raw_call_repo.get_unassigned_for_date(db, call_date, source_env, call_type=call_type)
    if not unassigned:
        return 0
    if call_type == CALL_TYPE_SALES:
        return await _assign_sales(db, users, call_date, unassigned)
    return await _assign_service(db, users, call_date, unassigned)


async def _assign_service(
    db: AsyncSession,
    users: list,
    call_date: date,
    unassigned: list[RawCall],
) -> int:
    """Service-call assignment: NPS quota buckets + per-user fill priority."""
    config = await get_config(db)
    user_load = await _build_reviewer_load(db, [u.id for u in users], call_date, call_type=CALL_TYPE_SERVICE)
    buckets = _categorize_calls(unassigned)

    shuffled_users = users.copy()
    random.shuffle(shuffled_users)

    records: list[EvalCreate] = []
    for user in shuffled_users:
        picked = _pick_calls_for_user(buckets, user_load.get(user.id, 0), config)
        for call in picked:
            records.append(_build_eval_create(call, user.id))

    if records:
        await eval_repo.create_bulk(db, records)
    return len(records)


async def _assign_sales(
    db: AsyncSession,
    users: list,
    call_date: date,
    unassigned: list[RawCall],
) -> int:
    """Sales-call assignment: 3-status NPS buckets (na/promoter/detractor) + per-user fill priority."""
    config = await get_config(db)
    user_load = await _build_reviewer_load(db, [u.id for u in users], call_date, call_type=CALL_TYPE_SALES)
    buckets = _categorize_sales_calls(unassigned)

    shuffled_users = users.copy()
    random.shuffle(shuffled_users)

    records: list[EvalCreate] = []
    for user in shuffled_users:
        picked = _pick_sales_calls_for_user(
            buckets,
            user_load.get(user.id, 0),
            config.sales_max_calls_per_user,
            config.sales_call_targets,
        )
        for call in picked:
            records.append(_build_eval_create(call, user.id))

    if records:
        await eval_repo.create_bulk(db, records)
    return len(records)


def _categorize_sales_calls(calls: list[RawCall]) -> dict[str, list[RawCall]]:
    """Bucket sales calls by NPS status — promoter (10), detractor (5), na (everything else)."""
    raw: dict[str, list[RawCall]] = {"na": [], "detractor": [], "promoter": []}
    for call in calls:
        if call.nps_score == SALES_NPS_PROMOTER:
            raw["promoter"].append(call)
        elif call.nps_score == SALES_NPS_DETRACTOR:
            raw["detractor"].append(call)
        else:
            raw["na"].append(call)
    return {category: _interleave_by_rooftop(bucket) for category, bucket in raw.items()}


def _pick_sales_calls_for_user(
    buckets: dict[str, list[RawCall]],
    current_load: int,
    max_calls: int,
    targets: SalesCallTargets,
) -> list[RawCall]:
    """Draw up to max_calls sales calls from shared buckets using targets then fallback priority."""
    remaining = max_calls - current_load
    if remaining <= 0:
        return []

    picks: list[RawCall] = []
    target_map = targets.model_dump()

    for category in SALES_FILL_PRIORITY:
        if remaining == 0:
            break
        available = buckets[category]
        selected = available[:min(target_map[category], remaining)]
        picks.extend(selected)
        for call in selected:
            available.remove(call)
        remaining -= len(selected)

    while remaining > 0:
        picked_any = False
        for category in SALES_FILL_PRIORITY:
            if remaining == 0:
                break
            available = buckets[category]
            if not available:
                continue
            picks.append(available.pop(0))
            remaining -= 1
            picked_any = True
        if not picked_any:
            break

    return picks


def _interleave_by_rooftop(calls: list[RawCall]) -> list[RawCall]:
    """Round-robin interleave calls across rooftops so picks naturally span multiple rooftops."""
    groups: dict[str, list[RawCall]] = defaultdict(list)
    for call in calls:
        key = call.rooftop_name or call.organization_name or "__unknown__"
        groups[key].append(call)
    for group in groups.values():
        random.shuffle(group)
    result: list[RawCall] = []
    iters = [iter(g) for g in groups.values()]
    while iters:
        next_iters = []
        for it in iters:
            try:
                result.append(next(it))
                next_iters.append(it)
            except StopIteration:
                pass
        iters = next_iters
    return result


PASSIVE_NPS_MIN = 7
PASSIVE_NPS_MAX = 8

MISSED_ENDED_REASONS = {"voicemail", "call_screening", "callback_requested", "dnc_request"}


def _categorize_calls(calls: list[RawCall]) -> dict[str, list[RawCall]]:
    """Split calls into na, passive, promoter, detractor, and missed buckets, interleaved by rooftop."""
    raw: dict[str, list[RawCall]] = {"na": [], "passive": [], "promoter": [], "detractor": [], "missed": []}
    for call in calls:
        if call.call_status != "Completed":
            if call.ended_reason in MISSED_ENDED_REASONS:
                raw["missed"].append(call)
        elif call.nps_score is None:
            raw["na"].append(call)
        elif call.nps_score >= PROMOTER_NPS_MIN:
            raw["promoter"].append(call)
        elif call.nps_score <= DETRACTOR_NPS_MAX:
            raw["detractor"].append(call)
        else:
            raw["passive"].append(call)
    return {category: _interleave_by_rooftop(bucket) for category, bucket in raw.items()}


NA_MIN_DURATION_SEC = 40


def _pick_na_calls(available: list[RawCall], count: int) -> list[RawCall]:
    """Pick up to `count` NA calls; at most 1 may be under 40s, all others must be 40s+."""
    if count <= 0:
        return []
    long_calls  = [c for c in available if (c.duration_sec or 0) >= NA_MIN_DURATION_SEC]
    short_calls = [c for c in available if (c.duration_sec or 0) < NA_MIN_DURATION_SEC]
    picks: list[RawCall] = long_calls[:count]
    if len(picks) < count and short_calls:
        picks.append(short_calls[0])
    return picks


def _pick_calls_for_user(
    buckets: dict[str, list[RawCall]], current_load: int, config: AssignmentConfigRead
) -> list[RawCall]:
    """Draw up to config.max_calls_per_user calls from shared buckets using targets then fallback priority."""
    remaining = config.max_calls_per_user - current_load
    if remaining <= 0:
        return []

    picks: list[RawCall] = []
    targets = config.call_targets.model_dump()
    short_na_picked = False

    for category in FILL_PRIORITY:
        target = targets[category]
        available = buckets[category]
        if category == "na":
            selected = _pick_na_calls(available, min(target, remaining))
            short_na_picked = any((c.duration_sec or 0) < NA_MIN_DURATION_SEC for c in selected)
        else:
            selected = available[:min(target, remaining)]
        picks.extend(selected)
        for call in selected:
            available.remove(call)
        remaining -= len(selected)
        if remaining == 0:
            return picks

    # Fallback: round-robin across categories in fill-priority order, 1 call per category per round.
    # For NA, respect the 1-short-call-per-user cap.
    while remaining > 0:
        picked_any = False
        for category in FILL_PRIORITY:
            if remaining == 0:
                break
            available = buckets[category]
            if not available:
                continue
            if category == "na":
                eligible = _pick_na_calls(available, 1) if not short_na_picked else (
                    [c for c in available if (c.duration_sec or 0) >= NA_MIN_DURATION_SEC][:1]
                )
                if not eligible:
                    continue
                if not short_na_picked and (eligible[0].duration_sec or 0) < NA_MIN_DURATION_SEC:
                    short_na_picked = True
                picks.append(eligible[0])
                available.remove(eligible[0])
            else:
                picks.append(available[0])
                buckets[category] = available[1:]
            remaining -= 1
            picked_any = True
        if not picked_any:
            break

    return picks


async def _build_reviewer_load(
    db: AsyncSession,
    user_ids: list[int],
    call_date: date,
    call_type: str | None = None,
) -> dict[int, int]:
    """Return a mapping of user_id → count of evals already assigned for the date, optionally per call_type."""
    from sqlalchemy import func, select

    query = (
        select(Eval.assigned_to, func.count(Eval.id))
        .join(RawCall, Eval.call_id == RawCall.lokam_call_id)
        .where(RawCall.call_date == call_date, Eval.assigned_to.in_(user_ids))
    )
    if call_type is not None:
        query = query.where(Eval.call_type == call_type)
    result = await db.execute(query.group_by(Eval.assigned_to))
    return {row[0]: row[1] for row in result.all()}


def _build_eval_create(call: RawCall, user_id: int) -> EvalCreate:
    """Build an EvalCreate record from a RawCall and a user id."""
    return EvalCreate(
        call_id=call.lokam_call_id,
        assigned_to=user_id,
        call_status=call.call_status,
        lead_type=call.lead_type,
        call_type=call.call_type,
        raw_transcript=call.raw_transcript,
        formatted_transcript=call.formatted_transcript,
        recording_url=call.recording_url,
        service_record_json=call.service_record_json,
        organization_json=call.organization_json,
    )
