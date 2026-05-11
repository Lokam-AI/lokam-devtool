"""redesign sales eval columns — drop dispo/objection/lead_status/sentiment, add lead_escalated

Revision ID: i7j1k2l3m4n5
Revises: h6i0j3k4l5m6
Create Date: 2026-05-11

Sales review pivots to mirror lokamspace voice-agent output (tick/cross QA pattern):
service-style call_summary/overall_feedback/detractors verification + new lead_escalated bool.
The four legacy sales gt_* columns (objection_category, disposition, lead_status_outcome,
sentiment) are no longer surfaced and are dropped here — but any reviewer data already
captured in those columns is stashed into `evals.scenario_tags->'legacy_sales_eval'` so it
isn't lost across the upgrade. The downgrade restores those values from the stash if present.
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "i7j1k2l3m4n5"
down_revision: Union[str, None] = "h6i0j3k4l5m6"
branch_labels = None
depends_on = None


LEGACY_SALES_GT_FIELDS = (
    "gt_objection_category",
    "gt_disposition",
    "gt_lead_status_outcome",
    "gt_sentiment",
)


def upgrade() -> None:
    """Preserve legacy sales gt_* into scenario_tags JSONB before drop; add new lead_escalated cols."""
    # Stash any reviewer-entered legacy sales values under scenario_tags->'legacy_sales_eval'
    # so we never silently lose ground-truth data on a redeploy of this migration.
    op.execute(
        """
        UPDATE evals SET scenario_tags = COALESCE(scenario_tags, '{}'::jsonb) || jsonb_build_object(
            'legacy_sales_eval', jsonb_build_object(
                'objection_category',  gt_objection_category,
                'disposition',         gt_disposition,
                'lead_status_outcome', gt_lead_status_outcome,
                'sentiment',           gt_sentiment
            )
        )
        WHERE call_type = 'sales'
          AND (
              gt_objection_category  IS NOT NULL
           OR gt_disposition         IS NOT NULL
           OR gt_lead_status_outcome IS NOT NULL
           OR gt_sentiment           IS NOT NULL
          )
        """
    )

    op.drop_column("evals", "gt_sentiment")
    op.drop_column("evals", "gt_lead_status_outcome")
    op.drop_column("evals", "gt_disposition")
    op.drop_column("evals", "gt_objection_category")

    op.add_column("evals", sa.Column("gt_lead_escalated", sa.Boolean(), nullable=True))
    op.add_column("raw_calls", sa.Column("lead_escalated", sa.Boolean(), nullable=True))


def downgrade() -> None:
    """Drop lead_escalated cols; recreate 4 legacy sales cols and rehydrate from scenario_tags stash."""
    op.drop_column("raw_calls", "lead_escalated")
    op.drop_column("evals", "gt_lead_escalated")

    op.add_column("evals", sa.Column("gt_objection_category", sa.String(length=64), nullable=True))
    op.add_column("evals", sa.Column("gt_disposition", sa.String(length=32), nullable=True))
    op.add_column("evals", sa.Column("gt_lead_status_outcome", sa.String(length=32), nullable=True))
    op.add_column("evals", sa.Column("gt_sentiment", sa.String(length=16), nullable=True))

    # Rehydrate from the stash created on upgrade. Rows that never had legacy values stay null.
    op.execute(
        """
        UPDATE evals SET
            gt_objection_category  = scenario_tags->'legacy_sales_eval'->>'objection_category',
            gt_disposition         = scenario_tags->'legacy_sales_eval'->>'disposition',
            gt_lead_status_outcome = scenario_tags->'legacy_sales_eval'->>'lead_status_outcome',
            gt_sentiment           = scenario_tags->'legacy_sales_eval'->>'sentiment'
        WHERE scenario_tags ? 'legacy_sales_eval'
        """
    )
    # Optional: prune the stash key so scenario_tags isn't polluted post-downgrade.
    op.execute(
        """
        UPDATE evals SET scenario_tags = scenario_tags - 'legacy_sales_eval'
        WHERE scenario_tags ? 'legacy_sales_eval'
        """
    )
