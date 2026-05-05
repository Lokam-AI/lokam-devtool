"""add vapi_call_id to raw_calls

Revision ID: 7875fffd0d42
Revises: g5h9i2j3k4l5
Create Date: 2026-05-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '7875fffd0d42'
down_revision: Union[str, None] = 'g5h9i2j3k4l5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('raw_calls', sa.Column('vapi_call_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('raw_calls', 'vapi_call_id')
