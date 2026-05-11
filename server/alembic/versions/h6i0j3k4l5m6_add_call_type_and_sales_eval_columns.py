"""add call_type to raw_calls/evals and sales-specific gt columns to evals

Revision ID: h6i0j3k4l5m6
Revises: 7875fffd0d42
Create Date: 2026-05-11

"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "h6i0j3k4l5m6"
down_revision: Union[str, None] = "7875fffd0d42"
branch_labels = None
depends_on = None


CALL_TYPE_ENUM_NAME = "call_type_enum"
CALL_TYPE_VALUES = ("service", "sales")


def upgrade() -> None:
    """Create call_type enum, add call_type columns, backfill from lead_type, add sales gt columns + indexes."""
    call_type_enum = sa.Enum(*CALL_TYPE_VALUES, name=CALL_TYPE_ENUM_NAME)
    call_type_enum.create(op.get_bind(), checkfirst=True)

    enum_ref = sa.Enum(*CALL_TYPE_VALUES, name=CALL_TYPE_ENUM_NAME, create_type=False)

    op.add_column(
        "raw_calls",
        sa.Column("call_type", enum_ref, nullable=False, server_default="service"),
    )
    op.add_column(
        "evals",
        sa.Column("call_type", enum_ref, nullable=False, server_default="service"),
    )

    # Backfill call_type from lead_type so any pre-existing SALES_PRE_LEAD rows are labeled correctly.
    op.execute("UPDATE raw_calls SET call_type = 'sales' WHERE lead_type = 'SALES_PRE_LEAD'")
    op.execute("UPDATE evals SET call_type = 'sales' WHERE lead_type = 'SALES_PRE_LEAD'")

    op.add_column("evals", sa.Column("gt_objection_category", sa.String(length=64), nullable=True))
    op.add_column("evals", sa.Column("gt_disposition", sa.String(length=32), nullable=True))
    op.add_column("evals", sa.Column("gt_lead_status_outcome", sa.String(length=32), nullable=True))
    op.add_column("evals", sa.Column("gt_sentiment", sa.String(length=16), nullable=True))

    op.create_index("idx_raw_calls_call_type_date", "raw_calls", ["call_type", "call_date"])
    op.create_index("idx_evals_assigned_call_type", "evals", ["assigned_to", "call_type"])


def downgrade() -> None:
    """Drop indexes, sales gt columns, call_type columns, and the enum."""
    op.drop_index("idx_evals_assigned_call_type", table_name="evals")
    op.drop_index("idx_raw_calls_call_type_date", table_name="raw_calls")

    op.drop_column("evals", "gt_sentiment")
    op.drop_column("evals", "gt_lead_status_outcome")
    op.drop_column("evals", "gt_disposition")
    op.drop_column("evals", "gt_objection_category")
    op.drop_column("evals", "call_type")
    op.drop_column("raw_calls", "call_type")

    sa.Enum(name=CALL_TYPE_ENUM_NAME).drop(op.get_bind(), checkfirst=True)
