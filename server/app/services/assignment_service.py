from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.eval import Eval
from app.models.raw_call import RawCall
from app.repositories import eval_repo, raw_call_repo, user_repo
from app.schemas.eval import EvalCreate

MAX_CALLS_PER_REVIEWER = 20


async def assign_calls_for_date(db: AsyncSession, call_date: date, source_env: str | None = None) -> int:
    """Round-robin assign unassigned calls to active reviewers; return count of new Evals created."""
    reviewers = await user_repo.list_active_reviewers(db)
    if not reviewers:
        return 0

    unassigned = await raw_call_repo.get_unassigned_for_date(db, call_date, source_env)
    if not unassigned:
        return 0

    reviewer_load = await _build_reviewer_load(db, [r.id for r in reviewers], call_date)
    records: list[EvalCreate] = []

    reviewer_cycle = list(reviewers)
    cycle_index = 0

    for call in unassigned:
        assigned = False
        attempts = 0
        while attempts < len(reviewer_cycle):
            reviewer = reviewer_cycle[cycle_index % len(reviewer_cycle)]
            cycle_index += 1
            attempts += 1
            current_load = reviewer_load.get(reviewer.id, 0)
            if current_load < MAX_CALLS_PER_REVIEWER:
                records.append(_build_eval_create(call, reviewer.id))
                reviewer_load[reviewer.id] = current_load + 1
                assigned = True
                break
        if not assigned:
            break  # all reviewers at cap

    if records:
        await eval_repo.create_bulk(db, records)
    return len(records)


async def _build_reviewer_load(db: AsyncSession, reviewer_ids: list[int], call_date: date) -> dict[int, int]:
    """Return a mapping of reviewer_id → count of evals already assigned for the date."""
    from sqlalchemy import func, select
    from app.models.eval import Eval
    from app.models.raw_call import RawCall

    result = await db.execute(
        select(Eval.assigned_to, func.count(Eval.id))
        .join(RawCall, Eval.call_id == RawCall.id)
        .where(RawCall.call_date == call_date, Eval.assigned_to.in_(reviewer_ids))
        .group_by(Eval.assigned_to)
    )
    return {row[0]: row[1] for row in result.all()}


def _build_eval_create(call: RawCall, reviewer_id: int) -> EvalCreate:
    """Build an EvalCreate record from a RawCall and a reviewer id."""
    return EvalCreate(
        call_id=call.id,
        assigned_to=reviewer_id,
        call_status=call.call_status,
        raw_transcript=call.raw_transcript,
        formatted_transcript=call.formatted_transcript,
        recording_url=call.recording_url,
        service_record_json=call.service_record_json,
        organization_json=call.organization_json,
    )
