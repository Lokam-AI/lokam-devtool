from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.exceptions import PermissionError
from app.schemas.eval import EvalRead
from tests.api.conftest import _make_user


def _make_eval_read(eval_id: int = 1, assigned_to: int = 1) -> EvalRead:
    """Return a minimal EvalRead schema instance."""
    return EvalRead(
        id=eval_id,
        call_id=10,
        assigned_to=assigned_to,
        eval_status="pending",
        has_corrections=False,
        completed_at=None,
        created_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
    )


def test_reviewer_sees_only_own_evals(reviewer_client: TestClient) -> None:
    """GET /evals/my returns only the reviewer's pending evals."""
    evals = [_make_eval_read(eval_id=1, assigned_to=1)]
    with patch("app.repositories.eval_repo.list_for_reviewer", AsyncMock(return_value=evals)):
        response = reviewer_client.get("/api/v1/evals/my")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == 1


def test_submit_eval_returns_completed(reviewer_client: TestClient) -> None:
    """PATCH /evals/{id} returns the completed eval."""
    completed = _make_eval_read()
    completed.eval_status = "completed"
    with patch("app.api.v1.endpoints.evals.eval_service.submit_eval", AsyncMock(return_value=completed)):
        response = reviewer_client.patch("/api/v1/evals/1", json={"gt_nps_score": 7})
    assert response.status_code == 200
    assert response.json()["eval_status"] == "completed"


def test_get_eval_permission_denied(reviewer_client: TestClient) -> None:
    """GET /evals/{id} for another reviewer's eval returns 403."""
    with patch(
        "app.api.v1.endpoints.evals.eval_service.get_eval_form",
        AsyncMock(side_effect=PermissionError("not yours")),
    ):
        response = reviewer_client.get("/api/v1/evals/99")
    assert response.status_code == 403
