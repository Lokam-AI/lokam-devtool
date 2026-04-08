from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
    """Return the User with the given id, or None if not found."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    """Return the User with the given email, or None if not found."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def list_all_active(db: AsyncSession) -> list[User]:
    """Return all active users across all roles."""
    result = await db.execute(
        select(User).where(User.is_active.is_(True)).order_by(User.id)
    )
    return list(result.scalars().all())


async def list_all(db: AsyncSession) -> list[User]:
    """Return all users ordered by id."""
    result = await db.execute(select(User).order_by(User.id))
    return list(result.scalars().all())


async def create(db: AsyncSession, *, email: str, password_hash: str, name: str, role: str) -> User:
    """Insert a new User row and return it after flush."""
    user = User(email=email, password_hash=password_hash, name=name, role=role)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user: User, **fields: object) -> User:
    """Apply field updates to an existing User and return the updated instance."""
    for key, value in fields.items():
        setattr(user, key, value)
    await db.flush()
    await db.refresh(user)
    return user


async def soft_delete(db: AsyncSession, user: User) -> None:
    """Mark a user as inactive without removing the row."""
    user.is_active = False
    await db.flush()
