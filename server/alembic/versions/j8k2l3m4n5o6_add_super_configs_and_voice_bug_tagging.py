"""add super_configs table and voice bug tagging columns

Revision ID: j8k2l3m4n5o6
Revises: c0d1e2f3a4b5
Create Date: 2026-05-16

Introduces:
  - super_configs table: generic configurable option taxonomy (bug types, etc.)
  - evals.bug_type_ids JSONB: list of super_config IDs tagged during review
  - raw_calls.quality_tag / quality_tag_notes: reviewer quality bookmark (AGENT_HANDLED_WELL / AGENT_FAILED)

Seeded defaults for voice_bug_type category match the 6 types from the Linear spec.
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "j8k2l3m4n5o6"
down_revision: Union[str, None] = "c0d1e2f3a4b5"
branch_labels = None
depends_on = None

DEFAULT_BUG_TYPES = [
    ("Transcription Error", "STT output is incorrect or garbled"),
    ("Agent Stopped Talking", "Agent went silent mid-call without completing the script"),
    ("Incorrect Escalation", "Agent escalated when it should not have, or failed to escalate"),
    ("Duplicate Response", "Agent repeated the same sentence/phrase back-to-back"),
    ("Script Deviation", "Agent skipped required script steps"),
    ("Call Drop", "Call disconnected unexpectedly"),
]


def upgrade() -> None:
    """Create super_configs table, add bug tagging columns, seed defaults."""
    op.create_table(
        "super_configs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("display_name", sa.String(150), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("options", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("category", "name", name="uq_super_configs_category_name"),
    )
    op.create_index("idx_super_configs_category_active", "super_configs", ["category", "is_active"])

    op.add_column("evals", sa.Column("bug_type_ids", postgresql.JSONB(), nullable=True))
    op.add_column("raw_calls", sa.Column("quality_tag", sa.String(30), nullable=True))
    op.add_column("raw_calls", sa.Column("quality_tag_notes", sa.Text(), nullable=True))

    # Seed default voice bug types
    op.execute(
        sa.text(
            """
            INSERT INTO super_configs (category, name, description, is_active, sort_order, created_at, updated_at)
            VALUES
              ('voice_bug_type', 'Transcription Error', 'STT output is incorrect or garbled', true, 0, now(), now()),
              ('voice_bug_type', 'Agent Stopped Talking', 'Agent went silent mid-call without completing the script', true, 1, now(), now()),
              ('voice_bug_type', 'Incorrect Escalation', 'Agent escalated when it should not have, or failed to escalate', true, 2, now(), now()),
              ('voice_bug_type', 'Duplicate Response', 'Agent repeated the same sentence/phrase back-to-back', true, 3, now(), now()),
              ('voice_bug_type', 'Script Deviation', 'Agent skipped required script steps', true, 4, now(), now()),
              ('voice_bug_type', 'Call Drop', 'Call disconnected unexpectedly', true, 5, now(), now())
            """
        )
    )


def downgrade() -> None:
    """Remove super_configs table and bug tagging columns."""
    op.drop_column("raw_calls", "quality_tag_notes")
    op.drop_column("raw_calls", "quality_tag")
    op.drop_column("evals", "bug_type_ids")
    op.drop_index("idx_super_configs_category_active", table_name="super_configs")
    op.drop_table("super_configs")
