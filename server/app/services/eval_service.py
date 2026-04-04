from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError, PermissionError
from app.repositories import eval_repo, raw_call_repo
from app.schemas.eval import EvalRead, EvalUpdate

GT_FIELDS = (
    "gt_call_summary",
    "gt_nps_score",
    "gt_overall_feedback",
    "gt_positive_mentions",
    "gt_detractors",
    "gt_is_incomplete_call",
    "gt_incomplete_reason",
    "gt_is_dnc_request",
    "gt_escalation_needed",
)


async def get_eval_form(db: AsyncSession, eval_id: int, *, requesting_user_id: int, requesting_role: str) -> EvalRead:
    """Return an eval with its raw call context; reviewers may only access their own."""
    ev = await eval_repo.get_by_id(db, eval_id)
    if ev is None:
        raise NotFoundError(f"Eval {eval_id} not found")
    if requesting_role == "reviewer" and ev.assigned_to != requesting_user_id:
        raise PermissionError("You are not assigned to this evaluation")
    return EvalRead.model_validate(ev)


async def submit_eval(
    db: AsyncSession,
    eval_id: int,
    payload: EvalUpdate,
    *,
    requesting_user_id: int,
    requesting_role: str,
) -> EvalRead:
    """Apply ground-truth fields, compute has_corrections, and mark the eval completed."""
    ev = await eval_repo.get_by_id(db, eval_id)
    if ev is None:
        raise NotFoundError(f"Eval {eval_id} not found")
    if requesting_role == "reviewer" and ev.assigned_to != requesting_user_id:
        raise PermissionError("You are not assigned to this evaluation")

    raw_call = await raw_call_repo.get_by_id(db, ev.call_id)
    changes = payload.model_dump(exclude_none=True)

    has_corrections = _compute_has_corrections(raw_call, changes) if raw_call else False
    changes["has_corrections"] = has_corrections
    changes["eval_status"] = "completed"
    changes["completed_at"] = datetime.utcnow()

    updated = await eval_repo.update_eval(db, ev, **changes)
    return EvalRead.model_validate(updated)


async def get_next_pending(db: AsyncSession, user_id: int) -> EvalRead | None:
    """Return the reviewer's next pending eval, or None if none remain."""
    ev = await eval_repo.get_next_pending(db, user_id)
    if ev is None:
        return None
    return EvalRead.model_validate(ev)


def _compute_has_corrections(raw_call: object, submitted: dict) -> bool:
    """Return True if any submitted gt_ field differs from the original AI output."""
    field_map = {
        "gt_call_summary": "call_summary",
        "gt_nps_score": "nps_score",
        "gt_overall_feedback": "overall_feedback",
        "gt_positive_mentions": "positive_mentions",
        "gt_detractors": "detractors",
        "gt_is_incomplete_call": "is_incomplete_call",
        "gt_incomplete_reason": "incomplete_reason",
        "gt_is_dnc_request": "is_dnc_request",
        "gt_escalation_needed": "escalation_needed",
    }
    for gt_field, original_field in field_map.items():
        if gt_field in submitted:
            original_value = getattr(raw_call, original_field, None)
            if submitted[gt_field] != original_value:
                return True
    return False
