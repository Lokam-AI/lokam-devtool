from sqlalchemy import inspect
from app.models.raw_call import RawCall


def test_raw_call_table_name() -> None:
    """RawCall model maps to the 'raw_calls' table."""
    assert RawCall.__tablename__ == "raw_calls"


def test_raw_call_columns_exist() -> None:
    """RawCall model defines all required columns."""
    col_names = {c.key for c in inspect(RawCall).mapper.column_attrs}
    expected = {
        "id", "lokam_call_id", "call_date", "nps_score", "call_summary",
        "overall_feedback", "positive_mentions", "detractors",
        "is_incomplete_call", "incomplete_reason", "is_dnc_request",
        "escalation_needed", "raw_transcript", "formatted_transcript",
        "recording_url", "service_record_json", "organization_json",
        "call_metadata", "customer_name_masked", "customer_phone_masked",
        "source_env", "synced_at", "created_at", "updated_at",
    }
    assert expected.issubset(col_names)


def test_raw_call_source_env_default() -> None:
    """source_env defaults to 'prod'."""
    call = RawCall(lokam_call_id=1, call_date="2026-04-04")
    assert call.source_env == "prod"
