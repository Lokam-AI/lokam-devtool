from typing import Any

from sqlalchemy import Boolean, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

VALID_ROLES = ("superadmin", "admin", "reviewer")


class User(Base, TimestampMixin):
    """ORM model for the users table."""

    __tablename__ = "users"
    __table_args__ = (
        Index("idx_users_email", "email"),
        Index("idx_users_role", "role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False)

    def __init__(
        self,
        *,
        role: str = "reviewer",
        is_active: bool = True,
        must_change_password: bool = True,
        **kwargs: Any,
    ) -> None:
        """Initialize User with default role and activation state."""
        super().__init__(
            role=role,
            is_active=is_active,
            must_change_password=must_change_password,
            **kwargs,
        )
