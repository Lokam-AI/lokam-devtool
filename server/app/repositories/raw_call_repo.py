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
    """Return RawCall rows with no corresponding Eval record for the given date."""
    from app.models.eval import Eval

    assigned_ids_subq = select(Eval.call_id)
    query = (
        select(RawCall)
        .where(RawCall.call_date == call_date)
        .where(RawCall.id.not_in(assigned_ids_subq))
    )
    if source_env is not None:
        query = query.where(RawCall.source_env == source_env)
    result = await db.execute(query.order_by(RawCall.id))
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, call_id: int) -> RawCall | None:
    """Return the RawCall with the given id, or None if not found."""
    result = await db.execute(select(RawCall).where(RawCall.id == call_id))
    return result.scalar_one_or_none()
