from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.env_config import EnvConfig


async def get_by_name(db: AsyncSession, name: str) -> EnvConfig | None:
    """Return the EnvConfig with the given name, or None if not found."""
    result = await db.execute(select(EnvConfig).where(EnvConfig.name == name))
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, env_id: int) -> EnvConfig | None:
    """Return the EnvConfig with the given id, or None if not found."""
    result = await db.execute(select(EnvConfig).where(EnvConfig.id == env_id))
    return result.scalar_one_or_none()


async def list_active(db: AsyncSession) -> list[EnvConfig]:
    """Return all active EnvConfig rows."""
    result = await db.execute(
        select(EnvConfig).where(EnvConfig.is_active.is_(True)).order_by(EnvConfig.id)
    )
    return list(result.scalars().all())


async def list_all(db: AsyncSession) -> list[EnvConfig]:
    """Return all EnvConfig rows ordered by id."""
    result = await db.execute(select(EnvConfig).order_by(EnvConfig.id))
    return list(result.scalars().all())


async def create(db: AsyncSession, *, name: str, base_url: str, secrets: dict, is_active: bool = True) -> EnvConfig:
    """Insert a new EnvConfig row and return it after flush."""
    env = EnvConfig(name=name, base_url=base_url, secrets=secrets, is_active=is_active)
    db.add(env)
    await db.flush()
    await db.refresh(env)
    return env


async def update_env(db: AsyncSession, env: EnvConfig, **fields: object) -> EnvConfig:
    """Apply field updates to an existing EnvConfig and return the updated instance."""
    for key, value in fields.items():
        setattr(env, key, value)
    await db.flush()
    await db.refresh(env)
    return env
