"""add lead_type to raw_calls and evals

Revision ID: e3a7b4c9d2f1
Revises: d2f6a3b8c9e1
Create Date: 2026-04-19

"""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e3a7b4c9d2f1'
down_revision: Union[str, None] = 'd2f6a3b8c9e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('raw_calls', sa.Column('lead_type', sa.String(50), nullable=True))
    op.add_column('evals', sa.Column('lead_type', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('evals', 'lead_type')
    op.drop_column('raw_calls', 'lead_type')
