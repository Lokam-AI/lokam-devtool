from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.eval import EvalUpdate
from app.services import eval_service
from app.services.eval_service import _compute_has_corrections


def _make_eval(**kwargs: object) -> MagicMock:
    """Return a minimal mock Eval object."""
    ev = MagicMock()
    ev.id = 1
    ev.call_id = 10
    ev.assigned_to = 5
    ev.eval_status = "pending"
    ev.has_corrections = False
    for k, v in kwargs.items():
        setattr(ev, k, v)
    return ev


def _make_raw_call(**kwargs: object) -> MagicMock:
    """Return a minimal mock RawCall object."""
    rc = MagicMock()
    rc.call_summary = "original summary"
    rc.nps_score = 8
    rc.overall_feedback = "good"
    rc.positive_mentions = None
    rc.detractors = None
    rc.is_incomplete_call = False
    rc.incomplete_reason = None
    rc.is_dnc_request = False
    rc.escalation_needed = False
    for k, v in kwargs.items():
        setattr(rc, k, v)
    return rc


def test_compute_has_corrections_detects_change() -> None:
    """has_corrections is True when a submitted gt_ field differs from the original."""
    raw = _make_raw_call(nps_score=8)
    submitted = {"gt_nps_score": 6}
    assert _compute_has_corrections(raw, submitted) is True


def test_compute_has_corrections_no_change() -> None:
    """has_corrections is False when all submitted gt_ fields match originals."""
    raw = _make_raw_call(nps_score=8)
    submitted = {"gt_nps_score": 8}
    assert _compute_has_corrections(raw, submitted) is False


def test_compute_has_corrections_empty_submission() -> None:
    """has_corrections is False when no gt_ fields are submitted."""
    raw = _make_raw_call()
    assert _compute_has_corrections(raw, {}) is False


def test_compute_has_corrections_empty_containers_match_none() -> None:
    """has_corrections is False when empty containers mirror missing AI output."""
    raw = _make_raw_call(positive_mentions=None, detractors=None)
    submitted = {"gt_positive_mentions": [], "gt_detractors": []}
    assert _compute_has_corrections(raw, submitted) is False


@pytest.mark.asyncio
async def test_submit_eval_sets_completed() -> None:
    """submit_eval marks the eval as completed and computes has_corrections."""
    ev = _make_eval()
    raw = _make_raw_call(nps_score=8)

    # Build a mock with all nullable string/text fields set to None so Pydantic validates cleanly
    updated = MagicMock()
    updated.id = 1
    updated.call_id = 10
    updated.assigned_to = 5
    updated.eval_status = "completed"
    updated.has_corrections = True
    updated.completed_at = None
    for attr in (
        "call_status", "raw_transcript", "formatted_transcript", "recording_url",
        "service_record_json", "organization_json", "formatted_tags",
        "gt_call_summary", "gt_nps_score", "gt_overall_feedback",
        "gt_positive_mentions", "gt_detractors", "gt_is_incomplete_call",
        "gt_incomplete_reason", "gt_is_dnc_request", "gt_escalation_needed",
        "scenario_tags", "scenario_tags_str",
    ):
        setattr(updated, attr, None)
    updated.created_at = "2026-01-01T00:00:00"
    updated.updated_at = "2026-01-01T00:00:00"

    db = AsyncMock()
    payload = EvalUpdate(gt_nps_score=5)

    with (
        patch("app.services.eval_service.eval_repo.get_by_id", AsyncMock(return_value=ev)),
        patch("app.services.eval_service.raw_call_repo.get_by_id", AsyncMock(return_value=raw)),
        patch("app.services.eval_service.eval_repo.update_eval", AsyncMock(return_value=updated)),
    ):
        result = await eval_service.submit_eval(
            db, 1, payload, requesting_user_id=5, requesting_role="reviewer"
        )

    assert result.eval_status == "completed"
