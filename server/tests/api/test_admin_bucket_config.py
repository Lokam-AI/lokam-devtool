import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import DEFAULT_BUCKET_PROBABILITIES, DEFAULT_REVIEWER_CAPACITY, DEFAULT_SPECIAL_MINIMUMS
from app.schemas.bucket_config import (
    NPS_BUCKET_KEYS,
    BucketConfigRead,
    BucketProbabilities,
    ReviewerCapacityRead,
    SpecialTypeMinimums,
)


def _cfg() -> BucketConfigRead:
    """Return a minimal BucketConfigRead backed by defaults."""
    return BucketConfigRead(
        probabilities=BucketProbabilities(**DEFAULT_BUCKET_PROBABILITIES),
        special_minimums=SpecialTypeMinimums(**DEFAULT_SPECIAL_MINIMUMS),
        default_reviewer_capacity=DEFAULT_REVIEWER_CAPACITY,
    )


def _reviewer(uid: int = 1, capacity: int | None = None) -> ReviewerCapacityRead:
    """Return a minimal ReviewerCapacityRead."""
    return ReviewerCapacityRead(
        user_id=uid,
        email=f"user{uid}@example.com",
        name=f"User {uid}",
        capacity=capacity,
        effective_capacity=capacity if capacity is not None else DEFAULT_REVIEWER_CAPACITY,
    )


# ── Authorization gating ───────────────────────────────────────────────────────

def test_get_bucket_config_requires_superadmin(admin_client: TestClient) -> None:
    """Admin role cannot access the bucket-config endpoint."""
    resp = admin_client.get("/api/v1/admin/bucket-config")
    assert resp.status_code == 403


def test_patch_bucket_config_requires_superadmin(admin_client: TestClient) -> None:
    """Admin role cannot patch the bucket-config endpoint."""
    resp = admin_client.patch("/api/v1/admin/bucket-config", json={})
    assert resp.status_code == 403


def test_get_reviewer_capacities_requires_superadmin(admin_client: TestClient) -> None:
    """Admin role cannot access the reviewer-capacities endpoint."""
    resp = admin_client.get("/api/v1/admin/reviewer-capacities")
    assert resp.status_code == 403


# ── GET /admin/bucket-config ───────────────────────────────────────────────────

def test_get_bucket_config_returns_200(superadmin_client: TestClient) -> None:
    """Superadmin can retrieve current bucket config."""
    cfg = _cfg()
    with patch("app.services.bucket_config_service.get_config", AsyncMock(return_value=cfg)):
        resp = superadmin_client.get("/api/v1/admin/bucket-config")
    assert resp.status_code == 200
    body = resp.json()
    assert "probabilities" in body
    assert "default_reviewer_capacity" in body
    assert body["default_reviewer_capacity"] == DEFAULT_REVIEWER_CAPACITY


# ── PATCH /admin/bucket-config ─────────────────────────────────────────────────

def test_patch_bucket_config_valid_probs_returns_200(superadmin_client: TestClient) -> None:
    """Superadmin can patch bucket config with valid probabilities."""
    cfg = _cfg()
    with patch("app.services.bucket_config_service.update_config", AsyncMock(return_value=cfg)):
        resp = superadmin_client.patch(
            "/api/v1/admin/bucket-config",
            json={"default_reviewer_capacity": 20},
        )
    assert resp.status_code == 200


def test_patch_bucket_config_invalid_probs_returns_422(superadmin_client: TestClient) -> None:
    """Probabilities not summing to 1.0 are rejected with 422."""
    bad_probs = dict(DEFAULT_BUCKET_PROBABILITIES)
    bad_probs["service_na"] += 0.5  # pushes sum well above 1.0
    payload = {"probabilities": bad_probs}
    resp = superadmin_client.patch("/api/v1/admin/bucket-config", json=payload)
    assert resp.status_code == 422


def test_patch_bucket_config_special_minimums_only_returns_200(superadmin_client: TestClient) -> None:
    """Superadmin can patch only special_minimums without touching probabilities."""
    cfg = _cfg()
    with patch("app.services.bucket_config_service.update_config", AsyncMock(return_value=cfg)):
        resp = superadmin_client.patch(
            "/api/v1/admin/bucket-config",
            json={"special_minimums": {"dnc": 2, "email_send": 0, "lead_escalated": 1, "review_link_sent": 1, "post_call_sms": 3}},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert "special_minimums" in body


def test_get_bucket_config_includes_special_minimums(superadmin_client: TestClient) -> None:
    """GET bucket-config response includes special_minimums field."""
    cfg = _cfg()
    with patch("app.services.bucket_config_service.get_config", AsyncMock(return_value=cfg)):
        resp = superadmin_client.get("/api/v1/admin/bucket-config")
    assert resp.status_code == 200
    body = resp.json()
    assert "special_minimums" in body
    assert "dnc" in body["special_minimums"]


# ── GET /admin/reviewer-capacities ────────────────────────────────────────────

def test_list_reviewer_capacities_returns_200(superadmin_client: TestClient) -> None:
    """Superadmin can list reviewer capacities."""
    rows = [_reviewer(1), _reviewer(2, capacity=5)]
    with patch("app.services.reviewer_capacity_service.list_capacities", AsyncMock(return_value=rows)):
        resp = superadmin_client.get("/api/v1/admin/reviewer-capacities")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["user_id"] == 1


# ── PATCH /admin/reviewer-capacities/{user_id} ────────────────────────────────

def test_patch_reviewer_capacity_returns_200(superadmin_client: TestClient) -> None:
    """Superadmin can update a single reviewer's capacity."""
    result = _reviewer(1, capacity=8)
    with patch("app.services.reviewer_capacity_service.update_capacity", AsyncMock(return_value=result)):
        resp = superadmin_client.patch("/api/v1/admin/reviewer-capacities/1", json={"capacity": 8})
    assert resp.status_code == 200
    assert resp.json()["capacity"] == 8


def test_patch_reviewer_capacity_not_found_returns_404(superadmin_client: TestClient) -> None:
    """404 is returned when reviewer does not exist."""
    from app.exceptions import NotFoundError

    with patch(
        "app.services.reviewer_capacity_service.update_capacity",
        AsyncMock(side_effect=NotFoundError("not found")),
    ):
        resp = superadmin_client.patch("/api/v1/admin/reviewer-capacities/999", json={"capacity": 5})
    assert resp.status_code == 404


# ── PUT /admin/reviewer-capacities ────────────────────────────────────────────

def test_bulk_update_reviewer_capacities_returns_200(superadmin_client: TestClient) -> None:
    """Superadmin can bulk-update reviewer capacities."""
    results = [_reviewer(1, capacity=7), _reviewer(2)]
    with patch("app.services.reviewer_capacity_service.bulk_update", AsyncMock(return_value=results)):
        resp = superadmin_client.put(
            "/api/v1/admin/reviewer-capacities",
            json={"updates": [{"user_id": 1, "capacity": 7}, {"user_id": 2, "capacity": None}]},
        )
    assert resp.status_code == 200
    assert len(resp.json()) == 2
