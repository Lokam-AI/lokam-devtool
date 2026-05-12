"""add is_bookmarked to raw_calls

Revision ID: b9e2a1f4c8d3
Revises: i7j1k2l3m4n5
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "b9e2a1f4c8d3"
down_revision: Union[str, None] = "i7j1k2l3m4n5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("raw_calls", sa.Column("is_bookmarked", sa.Boolean(), nullable=False, server_default="false"))
    op.create_index(
        "idx_raw_calls_bookmarked",
        "raw_calls",
        ["id"],
        postgresql_where=sa.text("is_bookmarked"),
    )


def downgrade() -> None:
    op.drop_index("idx_raw_calls_bookmarked", table_name="raw_calls")
    op.drop_column("raw_calls", "is_bookmarked")
