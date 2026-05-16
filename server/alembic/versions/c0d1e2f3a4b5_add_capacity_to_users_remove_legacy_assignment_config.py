"""add capacity to users and remove legacy assignment config keys

Revision ID: c0d1e2f3a4b5
Revises: b9e2a1f4c8d3
Create Date: 2026-05-13 00:00:00.000000

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "c0d1e2f3a4b5"
down_revision: Union[str, None] = "b9e2a1f4c8d3"
branch_labels = None
depends_on = None

_LEGACY_KEYS = ("max_calls_per_user", "call_targets", "sales_max_calls_per_user", "sales_call_targets")


def upgrade() -> None:
    """Add nullable capacity column to users; purge legacy assignment-config rows from system_settings."""
    op.add_column("users", sa.Column("capacity", sa.Integer(), nullable=True))
    op.execute(
        sa.text("DELETE FROM system_settings WHERE key = ANY(:keys)").bindparams(
            keys=list(_LEGACY_KEYS)
        )
    )


def downgrade() -> None:
    """Remove capacity column from users (legacy system_settings rows are not restored)."""
    op.drop_column("users", "capacity")
