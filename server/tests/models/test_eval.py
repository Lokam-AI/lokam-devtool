from sqlalchemy import inspect
from app.models.eval import Eval


def test_eval_table_name() -> None:
    """Eval model maps to the 'evals' table."""
    assert Eval.__tablename__ == "evals"


def test_eval_columns_exist() -> None:
    """Eval model defines all required gt_ and status columns."""
    col_names = {c.key for c in inspect(Eval).mapper.column_attrs}
    expected = {
        "id", "call_id", "assigned_to", "eval_status", "has_corrections",
        "completed_at", "gt_call_summary", "gt_nps_score", "gt_overall_feedback",
        "gt_positive_mentions", "gt_detractors", "gt_is_incomplete_call",
        "gt_incomplete_reason", "gt_is_dnc_request", "gt_escalation_needed",
        "scenario_tags", "scenario_tags_str",
    }
    assert expected.issubset(col_names)


def test_eval_status_default() -> None:
    """Eval defaults to pending status with no corrections."""
    ev = Eval(call_id=1, assigned_to=1)
    assert ev.eval_status == "pending"
    assert ev.has_corrections is False
