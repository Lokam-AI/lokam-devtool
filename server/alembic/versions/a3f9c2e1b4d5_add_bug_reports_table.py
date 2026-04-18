"""add_bug_reports_table

Revision ID: a3f9c2e1b4d5
Revises: 5be2d5d5564d
Create Date: 2026-04-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a3f9c2e1b4d5'
down_revision: Union[str, None] = '5be2d5d5564d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create table only if it does not already exist (may have been created via standalone script)
    op.execute("""
        CREATE TABLE IF NOT EXISTS bug_reports (
            id SERIAL NOT NULL,
            external_id INTEGER NOT NULL,
            call_id INTEGER,
            organization_id VARCHAR(100),
            organization_name VARCHAR(150),
            rooftop_id VARCHAR(100),
            rooftop_name VARCHAR(150),
            bug_types JSONB,
            description TEXT,
            submitted_by INTEGER,
            submitted_by_name VARCHAR(150),
            bug_date DATE NOT NULL,
            source_env VARCHAR(50) NOT NULL,
            external_created_at TIMESTAMP WITHOUT TIME ZONE,
            synced_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT uq_bug_reports_external_id_env UNIQUE (external_id, source_env)
        )
    """)

    # Add assigned_to column idempotently
    op.execute("""
        ALTER TABLE bug_reports
        ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id)
    """)

    # Indexes — use IF NOT EXISTS to be safe
    op.execute("CREATE INDEX IF NOT EXISTS idx_bug_reports_bug_date ON bug_reports (bug_date)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bug_reports_source_env ON bug_reports (source_env)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bug_reports_organization_name ON bug_reports (organization_name)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bug_reports_assigned_to ON bug_reports (assigned_to)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_bug_reports_assigned_to")
    op.execute("DROP INDEX IF EXISTS idx_bug_reports_organization_name")
    op.execute("DROP INDEX IF EXISTS idx_bug_reports_source_env")
    op.execute("DROP INDEX IF EXISTS idx_bug_reports_bug_date")
    op.drop_table('bug_reports')
