from datetime import date

from sqlalchemy import cast, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import String

from app.models.raw_call import RawCall
from app.schemas.raw_call import RawCallCreate


async def upsert_by_lokam_call_id(db: AsyncSession, data: RawCallCreate) -> RawCall:
    """Insert or update a RawCall row keyed on lokam_call_id and return it."""
    values = data.model_dump()
    stmt = (
        insert(RawCall)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["lokam_call_id"],
            set_={k: v for k, v in values.items() if k != "lokam_call_id"},
        )
        .returning(RawCall)
    )
    result = await db.execute(stmt)
    row = result.scalar_one()
    return row


async def list_by_date(db: AsyncSession, call_date: date, source_env: str | None = None) -> list[RawCall]:
    """Return all RawCall rows for a given date, optionally filtered by env."""
    query = select(RawCall).where(RawCall.call_date == call_date)
    if source_env is not None:
        query = query.where(RawCall.source_env == source_env)
    result = await db.execute(query.order_by(RawCall.id))
    return list(result.scalars().all())


async def get_unassigned_for_date(db: AsyncSession, call_date: date, source_env: str | None = None) -> list[RawCall]:
    """Return RawCall rows with no Eval assigned for the given date."""
    from app.models.eval import Eval

    # Scope the exclusion to evals whose linked call falls on call_date only,
    # so calls on other dates don't block assignment for this date.
    assigned_ids_subq = (
        select(Eval.call_id)
        .join(RawCall, Eval.call_id == RawCall.lokam_call_id)
        .where(RawCall.call_date == call_date)
    )
    query = (
        select(RawCall)
        .where(RawCall.call_date == call_date)
        .where(RawCall.lead_type == "SERVICE_POST_RO")
        .where(RawCall.direction == "outbound")
        .where(RawCall.lokam_call_id.not_in(assigned_ids_subq))
    )
    if source_env is not None:
        query = query.where(RawCall.source_env == source_env)
    result = await db.execute(query.order_by(RawCall.id))
    return list(result.scalars().all())


def _apply_call_filters(
    query: object,
    source_env: str | None,
    call_status: str | None,
    date_from: date | None,
    date_to: date | None,
    search: str | None,
    organization_name: str | None,
    nps_filter: str | None,
) -> object:
    """Apply shared filter clauses to a RawCall select query."""
    if source_env is not None:
        query = query.where(RawCall.source_env == source_env)
    if call_status is not None:
        query = query.where(RawCall.call_status == call_status)
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
    return query


def _apply_call_sort(query: object, sort_by: str, sort_dir: str) -> object:
    """Apply ORDER BY clause to a RawCall select query."""
    desc = sort_dir == "desc"
    if sort_by == "nps":
        col = RawCall.nps_score.desc() if desc else RawCall.nps_score.asc()
    elif sort_by == "duration":
        col = RawCall.duration_sec.desc() if desc else RawCall.duration_sec.asc()
    elif sort_by == "status":
        col = RawCall.call_status.desc() if desc else RawCall.call_status.asc()
    else:
        col = RawCall.call_date.desc() if desc else RawCall.call_date.asc()
    return query.order_by(col, RawCall.id.desc())


async def list_all(
    db: AsyncSession,
    source_env: str | None = None,
    call_status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    organization_name: str | None = None,
    nps_filter: str | None = None,
    sort_by: str = "date",
    sort_dir: str = "desc",
    limit: int = 30,
    offset: int = 0,
) -> list[RawCall]:
    """Return all RawCall rows with optional filters, ordered as requested."""
    query = select(RawCall)
    query = _apply_call_filters(query, source_env, call_status, date_from, date_to, search, organization_name, nps_filter)
    query = _apply_call_sort(query, sort_by, sort_dir)
    result = await db.execute(query.limit(limit).offset(offset))
    return list(result.scalars().all())


async def count_all(
    db: AsyncSession,
    source_env: str | None = None,
    call_status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    organization_name: str | None = None,
    nps_filter: str | None = None,
) -> int:
    """Return count of RawCall rows matching filters."""
    query = select(func.count(RawCall.id))
    query = _apply_call_filters(query, source_env, call_status, date_from, date_to, search, organization_name, nps_filter)
    result = await db.execute(query)
    return result.scalar_one()


async def stats_all(
    db: AsyncSession,
    source_env: str | None = None,
    call_status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    organization_name: str | None = None,
    nps_filter: str | None = None,
) -> dict:
    """Return avg_duration_sec and avg_nps for all RawCall rows matching filters."""
    query = select(
        func.avg(RawCall.duration_sec).label("avg_duration"),
        func.avg(RawCall.nps_score).label("avg_nps"),
    )
    query = _apply_call_filters(query, source_env, call_status, date_from, date_to, search, organization_name, nps_filter)
    result = await db.execute(query)
    row = result.one()
    return {
        "avg_duration_sec": round(row.avg_duration) if row.avg_duration is not None else None,
        "avg_nps": round(float(row.avg_nps), 1) if row.avg_nps is not None else None,
    }


async def get_by_id(db: AsyncSession, call_id: int) -> RawCall | None:
    """Return the RawCall with the given internal id, or None if not found."""
    result = await db.execute(select(RawCall).where(RawCall.id == call_id))
    return result.scalar_one_or_none()


async def get_by_lokam_call_id(db: AsyncSession, lokam_call_id: int) -> RawCall | None:
    """Return the RawCall with the given lokam_call_id, or None if not found."""
    result = await db.execute(select(RawCall).where(RawCall.lokam_call_id == lokam_call_id))
    return result.scalar_one_or_none()
