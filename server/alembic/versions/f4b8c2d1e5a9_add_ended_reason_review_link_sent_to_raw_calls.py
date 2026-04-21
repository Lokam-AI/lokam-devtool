"""add ended_reason and review_link_sent to raw_calls

Revision ID: f4b8c2d1e5a9
Revises: e3a7b4c9d2f1
Create Date: 2026-04-21

"""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f4b8c2d1e5a9'
down_revision: Union[str, None] = 'e3a7b4c9d2f1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('raw_calls', sa.Column('ended_reason', sa.String(100), nullable=True))
    op.add_column('raw_calls', sa.Column('review_link_sent', sa.Boolean, nullable=True))


def downgrade() -> None:
    op.drop_column('raw_calls', 'review_link_sent')
    op.drop_column('raw_calls', 'ended_reason')
