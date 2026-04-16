from datetime import date

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

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
        .where(RawCall.lokam_call_id.not_in(assigned_ids_subq))
    )
    if source_env is not None:
        query = query.where(RawCall.source_env == source_env)
    result = await db.execute(query.order_by(RawCall.id))
    return list(result.scalars().all())


async def list_all(
    db: AsyncSession,
    source_env: str | None = None,
    call_status: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[RawCall]:
    """Return all RawCall rows with optional filters, ordered by most recent first."""
    query = select(RawCall)
    if source_env is not None:
        query = query.where(RawCall.source_env == source_env)
    if call_status is not None:
        query = query.where(RawCall.call_status == call_status)
    query = query.order_by(RawCall.call_date.desc(), RawCall.id.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def count_all(
    db: AsyncSession,
    source_env: str | None = None,
    call_status: str | None = None,
) -> int:
    """Return count of RawCall rows matching filters."""
    from sqlalchemy import func
    query = select(func.count(RawCall.id))
    if source_env is not None:
        query = query.where(RawCall.source_env == source_env)
    if call_status is not None:
        query = query.where(RawCall.call_status == call_status)
    result = await db.execute(query)
    return result.scalar_one()


async def get_by_id(db: AsyncSession, call_id: int) -> RawCall | None:
    """Return the RawCall with the given internal id, or None if not found."""
    result = await db.execute(select(RawCall).where(RawCall.id == call_id))
    return result.scalar_one_or_none()


async def get_by_lokam_call_id(db: AsyncSession, lokam_call_id: int) -> RawCall | None:
    """Return the RawCall with the given lokam_call_id, or None if not found."""
    result = await db.execute(select(RawCall).where(RawCall.lokam_call_id == lokam_call_id))
    return result.scalar_one_or_none()
