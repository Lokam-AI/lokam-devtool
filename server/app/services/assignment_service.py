from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import CALL_TARGETS, FILL_PRIORITY, MAX_CALLS_PER_USER
from app.models.eval import Eval
from app.models.raw_call import RawCall
from app.repositories import eval_repo, raw_call_repo, user_repo
from app.schemas.eval import EvalCreate

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

    user_load = await _build_reviewer_load(db, [u.id for u in users], call_date)
    buckets = _categorize_calls(unassigned)

    records: list[EvalCreate] = []
    for user in users:
        picked = _pick_calls_for_user(buckets, user_load.get(user.id, 0))
        for call in picked:
            records.append(_build_eval_create(call, user.id))

    if records:
        await eval_repo.create_bulk(db, records)
    return len(records)


def _categorize_calls(calls: list[RawCall]) -> dict[str, list[RawCall]]:
    """Split calls into na, promoter, detractor, and missed buckets."""
    buckets: dict[str, list[RawCall]] = {"na": [], "promoter": [], "detractor": [], "missed": []}
    for call in calls:
        if call.call_status != "Completed":
            buckets["missed"].append(call)
        elif call.nps_score is None or call.nps_score > DETRACTOR_NPS_MAX and call.nps_score < PROMOTER_NPS_MIN:
            buckets["na"].append(call)
        elif call.nps_score >= PROMOTER_NPS_MIN:
            buckets["promoter"].append(call)
        else:
            buckets["detractor"].append(call)
    return buckets


def _pick_calls_for_user(buckets: dict[str, list[RawCall]], current_load: int) -> list[RawCall]:
    """Draw up to MAX_CALLS_PER_USER calls from shared buckets using targets then fallback priority."""
    remaining = MAX_CALLS_PER_USER - current_load
    if remaining <= 0:
        return []

    picks: list[RawCall] = []

    for category in FILL_PRIORITY:
        target = CALL_TARGETS[category]
        available = buckets[category]
        take = min(target, len(available), remaining)
        picks.extend(available[:take])
        buckets[category] = available[take:]
        remaining -= take
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
        .join(RawCall, Eval.call_id == RawCall.id)
        .where(RawCall.call_date == call_date, Eval.assigned_to.in_(user_ids))
        .group_by(Eval.assigned_to)
    )
    return {row[0]: row[1] for row in result.all()}


def _build_eval_create(call: RawCall, user_id: int) -> EvalCreate:
    """Build an EvalCreate record from a RawCall and a user id."""
    return EvalCreate(
        call_id=call.id,
        assigned_to=user_id,
        call_status=call.call_status,
        raw_transcript=call.raw_transcript,
        formatted_transcript=call.formatted_transcript,
        recording_url=call.recording_url,
        service_record_json=call.service_record_json,
        organization_json=call.organization_json,
    )
