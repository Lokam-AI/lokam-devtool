"""add post-call SMS columns to raw_calls

Revision ID: add_post_call_sms_cols
Revises: a6c1d9e7f0b2
Create Date: 2026-04-28

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "add_post_call_sms_cols"
down_revision: Union[str, None] = "a6c1d9e7f0b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add flat post-call SMS columns to raw_calls."""
    op.add_column("raw_calls", sa.Column("is_post_call_sms_survey", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("raw_calls", sa.Column("post_call_sms_body", sa.Text(), nullable=True))
    op.add_column("raw_calls", sa.Column("post_call_sms_comments", sa.Text(), nullable=True))
    op.add_column("raw_calls", sa.Column("post_call_sms_status", sa.String(20), nullable=True))
    op.add_column("raw_calls", sa.Column("post_call_sms_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("raw_calls", sa.Column("post_call_sms_received_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("raw_calls", sa.Column("post_call_sms_nps", sa.Integer(), nullable=True))


def downgrade() -> None:
    """Remove post-call SMS columns from raw_calls."""
    op.drop_column("raw_calls", "post_call_sms_nps")
    op.drop_column("raw_calls", "post_call_sms_received_at")
    op.drop_column("raw_calls", "post_call_sms_sent_at")
    op.drop_column("raw_calls", "post_call_sms_status")
    op.drop_column("raw_calls", "post_call_sms_comments")
    op.drop_column("raw_calls", "post_call_sms_body")
    op.drop_column("raw_calls", "is_post_call_sms_survey")
