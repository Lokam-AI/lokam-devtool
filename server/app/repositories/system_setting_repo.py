from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_setting import SystemSetting


async def get(db: AsyncSession, key: str) -> str | None:
    """Return the value for a setting key, or None if not present."""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    row = result.scalar_one_or_none()
    return row.value if row else None


async def set(db: AsyncSession, key: str, value: str) -> None:
    """Upsert a setting key/value pair."""
    stmt = (
        insert(SystemSetting)
        .values(key=key, value=value)
        .on_conflict_do_update(index_elements=["key"], set_={"value": value})
    )
    await db.execute(stmt)
    await db.flush()
