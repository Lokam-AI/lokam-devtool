from __future__ import annotations

import random
from collections import defaultdict
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import FILL_PRIORITY
from app.models.eval import Eval
from app.models.raw_call import RawCall
from app.repositories import eval_repo, raw_call_repo, user_repo
from app.schemas.eval import EvalCreate
from app.schemas.assignment_config import AssignmentConfigRead
from app.services.assignment_config_service import get_config

PROMOTER_NPS_MIN = 9
DETRACTOR_NPS_MAX = 6


async def assign_calls_for_date(db: AsyncSession, call_date: date, source_env: str | None = None) -> int:
    """Assign unassigned calls to all active users using quota buckets; return count of new Evals created."""
    users = await user_repo.list_all_active(db)
    if not users:
        return 0

    unassigned = await raw_call_repo.get_unassigned_for_date(db, call_date, source_env)
    if not unassigned:
        return 0

    config = await get_config(db)
    user_load = await _build_reviewer_load(db, [u.id for u in users], call_date)
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


def _categorize_calls(calls: list[RawCall]) -> dict[str, list[RawCall]]:
    """Split calls into na, promoter, detractor, and missed buckets, interleaved by rooftop."""
    raw: dict[str, list[RawCall]] = {"na": [], "promoter": [], "detractor": [], "missed": []}
    for call in calls:
        if call.call_status != "Completed":
            raw["missed"].append(call)
        elif call.nps_score is None or (call.nps_score > DETRACTOR_NPS_MAX and call.nps_score < PROMOTER_NPS_MIN):
            raw["na"].append(call)
        elif call.nps_score >= PROMOTER_NPS_MIN:
            raw["promoter"].append(call)
        else:
            raw["detractor"].append(call)
    return {category: _interleave_by_rooftop(bucket) for category, bucket in raw.items()}


NA_MIN_DURATION_SEC = 40


def _pick_na_calls(available: list[RawCall], count: int) -> list[RawCall]:
    """Pick up to `count` NA calls, ensuring the first slot is a 40s+ call when one exists."""
    if count <= 0:
        return []
    long_calls  = [c for c in available if (c.duration_sec or 0) >= NA_MIN_DURATION_SEC]
    short_calls = [c for c in available if (c.duration_sec or 0) < NA_MIN_DURATION_SEC]
    picks: list[RawCall] = []
    if long_calls:
        picks.append(long_calls.pop(0))
    remaining_slots = count - len(picks)
    rest = long_calls + short_calls
    picks.extend(rest[:remaining_slots])
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

    for category in FILL_PRIORITY:
        target = targets[category]
        available = buckets[category]
        if category == "na":
            selected = _pick_na_calls(available, min(target, remaining))
        else:
            selected = available[:min(target, remaining)]
        picks.extend(selected)
        for call in selected:
            available.remove(call)
        remaining -= len(selected)
        if remaining == 0:
            return picks

    # Fallback: fill remaining slots from any category still available, in priority order
    for category in FILL_PRIORITY:
        if remaining == 0:
            break
        available = buckets[category]
        take = min(len(available), remaining)
        picks.extend(available[:take])
        buckets[category] = available[take:]
        remaining -= take

    return picks


async def _build_reviewer_load(db: AsyncSession, user_ids: list[int], call_date: date) -> dict[int, int]:
    """Return a mapping of user_id → count of evals already assigned for the date."""
    from sqlalchemy import func, select

    result = await db.execute(
        select(Eval.assigned_to, func.count(Eval.id))
        .join(RawCall, Eval.call_id == RawCall.lokam_call_id)
        .where(RawCall.call_date == call_date, Eval.assigned_to.in_(user_ids))
        .group_by(Eval.assigned_to)
    )
    return {row[0]: row[1] for row in result.all()}


def _build_eval_create(call: RawCall, user_id: int) -> EvalCreate:
    """Build an EvalCreate record from a RawCall and a user id."""
    return EvalCreate(
        call_id=call.lokam_call_id,
        assigned_to=user_id,
        call_status=call.call_status,
        lead_type=call.lead_type,
        raw_transcript=call.raw_transcript,
        formatted_transcript=call.formatted_transcript,
        recording_url=call.recording_url,
        service_record_json=call.service_record_json,
        organization_json=call.organization_json,
    )
