"""add_is_resolved_to_bug_reports

Revision ID: b7e4f1a2c3d6
Revises: a3f9c2e1b4d5
Create Date: 2026-04-18 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b7e4f1a2c3d6'
down_revision: Union[str, None] = 'a3f9c2e1b4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE bug_reports
        ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false
    """)


def downgrade() -> None:
    op.drop_column('bug_reports', 'is_resolved')
