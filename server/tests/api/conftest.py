"""Shared fixtures for API endpoint tests."""
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user, get_db


def _make_user(role: str = "reviewer", user_id: int = 1) -> MagicMock:
    """Return a mock User with the given role."""
    user = MagicMock()
    user.id = user_id
    user.role = role
    user.is_active = True
    user.must_change_password = False
    user.email = "test@example.com"
    user.name = "Test User"
    user.created_at = "2026-01-01T00:00:00"
    user.updated_at = "2026-01-01T00:00:00"
    return user


@pytest.fixture
def reviewer_client() -> TestClient:
    """Return a test client authenticated as a reviewer."""
    user = _make_user(role="reviewer")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    client = TestClient(app, raise_server_exceptions=False)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client() -> TestClient:
    """Return a test client authenticated as an admin."""
    user = _make_user(role="admin")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    client = TestClient(app, raise_server_exceptions=False)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client() -> TestClient:
    """Return a test client with no authentication."""
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    client = TestClient(app, raise_server_exceptions=False)
    yield client
    app.dependency_overrides.clear()
