from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.eval import Eval
from app.schemas.eval import EvalCreate


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


async def list_for_reviewer(db: AsyncSession, user_id: int, status: str | None = None) -> list[Eval]:
    """Return all Eval rows assigned to the given reviewer, optionally filtered by status."""
    query = select(Eval).where(Eval.assigned_to == user_id)
    if status is not None:
        query = query.where(Eval.eval_status == status)
    result = await db.execute(query.order_by(Eval.id))
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


async def get_next_pending(db: AsyncSession, user_id: int) -> Eval | None:
    """Return the first pending Eval for the given reviewer, or None."""
    result = await db.execute(
        select(Eval)
        .where(Eval.assigned_to == user_id, Eval.eval_status == "pending")
        .order_by(Eval.id)
        .limit(1)
    )
    return result.scalar_one_or_none()
