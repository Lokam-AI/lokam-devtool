from datetime import date, datetime
from typing import NamedTuple

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.eval import Eval
from app.models.raw_call import RawCall
from app.schemas.eval import EvalCreate


class ReviewerStats(NamedTuple):
    """Aggregated evaluation statistics for a single reviewer."""

    user_id: int
    calls_assigned: int
    calls_pending: int
    completed_total: int
    completed_today: int
    corrections_made: int
    avg_nps: float | None


async def create_bulk(db: AsyncSession, records: list[EvalCreate]) -> list[Eval]:
    """Insert multiple Eval rows in one flush and return them."""
    evals = [Eval(**r.model_dump()) for r in records]
    db.add_all(evals)
    await db.flush()
    for ev in evals:
        await db.refresh(ev)
    return evals


async def get_by_id(db: AsyncSession, eval_id: int) -> Eval | None:
    """Return the Eval with the given id, or None if not found."""
    result = await db.execute(select(Eval).where(Eval.id == eval_id))
    return result.scalar_one_or_none()


async def list_for_reviewer(
    db: AsyncSession,
    user_id: int,
    status: str | None = None,
    call_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Eval]:
    """Return Eval rows assigned to the given reviewer with optional filters and pagination."""
    query = select(Eval).where(Eval.assigned_to == user_id)
    if status is not None:
        query = query.where(Eval.eval_status == status)
    if call_id is not None:
        query = query.where(Eval.call_id == call_id)
    result = await db.execute(query.order_by(Eval.id).limit(limit).offset(offset))
    return list(result.scalars().all())


async def list_for_team_overview(db: AsyncSession) -> list[Eval]:
    """Return all Eval rows for admin overview, ordered by assigned_to then id."""
    result = await db.execute(select(Eval).order_by(Eval.assigned_to, Eval.id))
    return list(result.scalars().all())


async def update_eval(db: AsyncSession, ev: Eval, **fields: object) -> Eval:
    """Apply field updates to an existing Eval and return the updated instance."""
    for key, value in fields.items():
        setattr(ev, key, value)
    await db.flush()
    await db.refresh(ev)
    return ev


async def get_team_stats(db: AsyncSession) -> list[ReviewerStats]:
    """Return aggregated evaluation stats per reviewer in a single query."""
    today = date.today()
    result = await db.execute(
        select(
            Eval.assigned_to,
            func.count().label("calls_assigned"),
            func.sum(case((Eval.eval_status == "pending", 1), else_=0)).label("calls_pending"),
            func.sum(case((Eval.eval_status == "completed", 1), else_=0)).label("completed_total"),
            func.sum(
                case((
                    (Eval.eval_status == "completed") & (func.date(Eval.completed_at) == today),
                    1,
                ), else_=0)
            ).label("completed_today"),
            func.sum(case((Eval.has_corrections.is_(True), 1), else_=0)).label("corrections_made"),
            func.avg(Eval.gt_nps_score).label("avg_nps"),
        ).group_by(Eval.assigned_to)
    )
    rows = result.all()
    return [
        ReviewerStats(
            user_id=r.assigned_to,
            calls_assigned=r.calls_assigned,
            calls_pending=int(r.calls_pending or 0),
            completed_total=int(r.completed_total or 0),
            completed_today=int(r.completed_today or 0),
            corrections_made=int(r.corrections_made or 0),
            avg_nps=float(r.avg_nps) if r.avg_nps is not None else None,
        )
        for r in rows
    ]


def _build_calls_for_reviewer_query(
    user_id: int,
    eval_status: str | None,
    date_from: date | None,
    date_to: date | None,
    search: str | None,
    organization_name: str | None,
    nps_filter: str | None,
    post_call_sms: str | None,
    sort_by: str,
    sort_dir: str,
) -> object:
    """Build a joined Eval+RawCall query for a reviewer with optional filters."""
    from sqlalchemy import cast
    from sqlalchemy.types import String

    query = (
        select(Eval, RawCall)
        .join(RawCall, Eval.call_id == RawCall.lokam_call_id)
        .where(Eval.assigned_to == user_id)
    )
    if eval_status is not None:
        query = query.where(Eval.eval_status == eval_status)
    if date_from is not None:
        query = query.where(RawCall.call_date >= date_from)
    if date_to is not None:
        query = query.where(RawCall.call_date <= date_to)
    if organization_name is not None:
        query = query.where(RawCall.organization_name == organization_name)
    if search is not None:
        term = f"%{search}%"
        query = query.where(
            or_(
                RawCall.organization_name.ilike(term),
                RawCall.campaign_name.ilike(term),
                RawCall.rooftop_name.ilike(term),
                cast(RawCall.lokam_call_id, String).ilike(term),
            )
        )
    if nps_filter == "promoter":
        query = query.where(RawCall.nps_score >= 9)
    elif nps_filter == "passive":
        query = query.where(RawCall.nps_score >= 7, RawCall.nps_score <= 8)
    elif nps_filter == "detractor":
        query = query.where(RawCall.nps_score <= 6)
    if post_call_sms == "yes":
        query = query.where(RawCall.is_post_call_sms_survey == True)
    elif post_call_sms == "no":
        query = query.where(RawCall.is_post_call_sms_survey == False)

    desc = sort_dir == "desc"
    if sort_by == "nps":
        order = RawCall.nps_score.desc() if desc else RawCall.nps_score.asc()
    elif sort_by == "duration":
        order = RawCall.duration_sec.desc() if desc else RawCall.duration_sec.asc()
    elif sort_by == "status":
        order = Eval.eval_status.desc() if desc else Eval.eval_status.asc()
    else:
        order = RawCall.call_date.desc() if desc else RawCall.call_date.asc()
    return query.order_by(order, Eval.id.desc())


async def list_calls_for_reviewer(
    db: AsyncSession,
    user_id: int,
    eval_status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    organization_name: str | None = None,
    nps_filter: str | None = None,
    post_call_sms: str | None = None,
    sort_by: str = "date",
    sort_dir: str = "desc",
    limit: int = 30,
    offset: int = 0,
) -> list[tuple[Eval, RawCall]]:
    """Return paginated eval+call pairs for a reviewer with optional filters."""
    query = _build_calls_for_reviewer_query(
        user_id, eval_status, date_from, date_to, search, organization_name, nps_filter, post_call_sms, sort_by, sort_dir,
    )
    result = await db.execute(query.limit(limit).offset(offset))
    return list(result.all())


async def count_calls_for_reviewer(
    db: AsyncSession,
    user_id: int,
    eval_status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    organization_name: str | None = None,
    nps_filter: str | None = None,
    post_call_sms: str | None = None,
) -> int:
    """Return count of eval+call pairs matching reviewer filters."""
    from sqlalchemy import cast
    from sqlalchemy.types import String

    count_q = (
        select(func.count())
        .select_from(Eval)
        .join(RawCall, Eval.call_id == RawCall.lokam_call_id)
        .where(Eval.assigned_to == user_id)
    )
    if eval_status is not None:
        count_q = count_q.where(Eval.eval_status == eval_status)
    if date_from is not None:
        count_q = count_q.where(RawCall.call_date >= date_from)
    if date_to is not None:
        count_q = count_q.where(RawCall.call_date <= date_to)
    if organization_name is not None:
        count_q = count_q.where(RawCall.organization_name == organization_name)
    if search is not None:
        term = f"%{search}%"
        count_q = count_q.where(
            or_(
                RawCall.organization_name.ilike(term),
                RawCall.campaign_name.ilike(term),
                RawCall.rooftop_name.ilike(term),
                cast(RawCall.lokam_call_id, String).ilike(term),
            )
        )
    if nps_filter == "promoter":
        count_q = count_q.where(RawCall.nps_score >= 9)
    elif nps_filter == "passive":
        count_q = count_q.where(RawCall.nps_score >= 7, RawCall.nps_score <= 8)
    elif nps_filter == "detractor":
        count_q = count_q.where(RawCall.nps_score <= 6)
    if post_call_sms == "yes":
        count_q = count_q.where(RawCall.is_post_call_sms_survey == True)
    elif post_call_sms == "no":
        count_q = count_q.where(RawCall.is_post_call_sms_survey == False)
    result = await db.execute(count_q)
    return result.scalar_one()


async def stats_calls_for_reviewer(
    db: AsyncSession,
    user_id: int,
    eval_status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    organization_name: str | None = None,
    nps_filter: str | None = None,
    post_call_sms: str | None = None,
) -> dict:
    """Return avg_duration_sec for all reviewer-assigned call+eval pairs matching filters."""
    from sqlalchemy import cast
    from sqlalchemy.types import String

    query = (
        select(func.avg(RawCall.duration_sec).label("avg_duration"))
        .select_from(Eval)
        .join(RawCall, Eval.call_id == RawCall.lokam_call_id)
        .where(Eval.assigned_to == user_id)
    )
    if eval_status is not None:
        query = query.where(Eval.eval_status == eval_status)
    if date_from is not None:
        query = query.where(RawCall.call_date >= date_from)
    if date_to is not None:
        query = query.where(RawCall.call_date <= date_to)
    if organization_name is not None:
        query = query.where(RawCall.organization_name == organization_name)
    if search is not None:
        term = f"%{search}%"
        query = query.where(
            or_(
                RawCall.organization_name.ilike(term),
                RawCall.campaign_name.ilike(term),
                RawCall.rooftop_name.ilike(term),
                cast(RawCall.lokam_call_id, String).ilike(term),
            )
        )
    if nps_filter == "promoter":
        query = query.where(RawCall.nps_score >= 9)
    elif nps_filter == "passive":
        query = query.where(RawCall.nps_score >= 7, RawCall.nps_score <= 8)
    elif nps_filter == "detractor":
        query = query.where(RawCall.nps_score <= 6)
    if post_call_sms == "yes":
        query = query.where(RawCall.is_post_call_sms_survey == True)
    elif post_call_sms == "no":
        query = query.where(RawCall.is_post_call_sms_survey == False)
    result = await db.execute(query)
    row = result.one()
    return {
        "avg_duration_sec": round(row.avg_duration) if row.avg_duration is not None else None,
    }


async def get_next_pending(db: AsyncSession, user_id: int) -> Eval | None:
    """Return the first pending Eval for the given reviewer, or None."""
    result = await db.execute(
        select(Eval)
        .where(Eval.assigned_to == user_id, Eval.eval_status == "pending")
        .order_by(Eval.id)
        .limit(1)
    )
    return result.scalar_one_or_none()
