from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_db
from app.exceptions import AuthError
from app.schemas.auth import TokenResponse


@pytest.fixture
def client() -> TestClient:
    """Return a test client with a mocked DB dependency."""
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    c = TestClient(app, raise_server_exceptions=False)
    yield c
    app.dependency_overrides.clear()


def test_login_success_sets_cookie(client: TestClient) -> None:
    """Successful login sets an httpOnly access_token cookie."""
    token_resp = TokenResponse(access_token="test-token")
    with patch("app.api.v1.endpoints.auth.auth_service.login", AsyncMock(return_value=token_resp)):
        response = client.post("/api/v1/auth/login", json={"email": "a@b.com", "password": "pass"})
    assert response.status_code == 200
    assert "access_token" in response.cookies


def test_login_bad_credentials_returns_401(client: TestClient) -> None:
    """Failed login returns 401."""
    with patch("app.api.v1.endpoints.auth.auth_service.login", AsyncMock(side_effect=AuthError("bad"))):
        response = client.post("/api/v1/auth/login", json={"email": "a@b.com", "password": "bad"})
    assert response.status_code == 401


def test_logout_clears_cookie(client: TestClient) -> None:
    """Logout endpoint returns 200 and clears the cookie."""
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert response.json() == {"detail": "Logged out"}
