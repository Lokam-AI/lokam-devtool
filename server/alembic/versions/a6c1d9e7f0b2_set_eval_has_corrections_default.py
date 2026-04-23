"""set eval has_corrections default

Revision ID: a6c1d9e7f0b2
Revises: f4b8c2d1e5a9
Create Date: 2026-04-23

"""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "a6c1d9e7f0b2"
down_revision: Union[str, None] = "f4b8c2d1e5a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE evals SET has_corrections = false WHERE has_corrections IS NULL")
    op.alter_column(
        "evals",
        "has_corrections",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.text("false"),
    )


def downgrade() -> None:
    op.alter_column(
        "evals",
        "has_corrections",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=None,
    )
