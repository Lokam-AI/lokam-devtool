from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.super_config import SuperConfig
from app.schemas.super_config import SuperConfigCreate, SuperConfigUpdate


async def list_by_category(
    db: AsyncSession,
    category: str,
    active_only: bool = True,
) -> list[SuperConfig]:
    """Return super_config rows for a category, optionally filtered to active only."""
    query = select(SuperConfig).where(SuperConfig.category == category)
    if active_only:
        query = query.where(SuperConfig.is_active.is_(True))
    query = query.order_by(SuperConfig.sort_order, SuperConfig.id)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, config_id: int) -> SuperConfig | None:
    """Return a single super_config row by primary key."""
    result = await db.execute(select(SuperConfig).where(SuperConfig.id == config_id))
    return result.scalar_one_or_none()


async def get_by_ids(db: AsyncSession, ids: list[int]) -> list[SuperConfig]:
    """Return super_config rows matching the given ids."""
    if not ids:
        return []
    result = await db.execute(select(SuperConfig).where(SuperConfig.id.in_(ids)))
    return list(result.scalars().all())


async def create(db: AsyncSession, data: SuperConfigCreate) -> SuperConfig:
    """Insert a new super_config row and return it."""
    row = SuperConfig(
        category=data.category,
        name=data.name,
        display_name=data.display_name,
        description=data.description,
        options=data.options,
        sort_order=data.sort_order,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return row


async def update(db: AsyncSession, config_id: int, data: SuperConfigUpdate) -> SuperConfig | None:
    """Apply partial updates to an existing super_config row and return it."""
    row = await get_by_id(db, config_id)
    if row is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.flush()
    await db.refresh(row)
    return row
