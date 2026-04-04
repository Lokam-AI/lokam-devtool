from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.exceptions import AuthError
from app.services import auth_service


def _make_user(*, is_active: bool = True, password_hash: str = "hashed") -> MagicMock:
    """Return a minimal mock User object."""
    user = MagicMock()
    user.id = 1
    user.role = "reviewer"
    user.is_active = is_active
    user.password_hash = password_hash
    return user


@pytest.mark.asyncio
async def test_login_success() -> None:
    """login returns a TokenResponse when credentials are valid."""
    user = _make_user()
    db = AsyncMock()
    with (
        patch("app.services.auth_service.user_repo.get_by_email", AsyncMock(return_value=user)),
        patch("app.services.auth_service.verify_password", return_value=True),
        patch("app.services.auth_service.create_access_token", return_value="tok"),
    ):
        result = await auth_service.login(db, email="a@b.com", password="secret")
    assert result.access_token == "tok"


@pytest.mark.asyncio
async def test_login_wrong_password() -> None:
    """login raises AuthError when password does not match."""
    user = _make_user()
    db = AsyncMock()
    with (
        patch("app.services.auth_service.user_repo.get_by_email", AsyncMock(return_value=user)),
        patch("app.services.auth_service.verify_password", return_value=False),
    ):
        with pytest.raises(AuthError):
            await auth_service.login(db, email="a@b.com", password="wrong")


@pytest.mark.asyncio
async def test_login_inactive_user() -> None:
    """login raises AuthError for inactive users."""
    user = _make_user(is_active=False)
    db = AsyncMock()
    with patch("app.services.auth_service.user_repo.get_by_email", AsyncMock(return_value=user)):
        with pytest.raises(AuthError):
            await auth_service.login(db, email="a@b.com", password="secret")


@pytest.mark.asyncio
async def test_login_nonexistent_user() -> None:
    """login raises AuthError when the email is not found."""
    db = AsyncMock()
    with patch("app.services.auth_service.user_repo.get_by_email", AsyncMock(return_value=None)):
        with pytest.raises(AuthError):
            await auth_service.login(db, email="nobody@b.com", password="secret")


@pytest.mark.asyncio
async def test_change_password_clears_flag() -> None:
    """change_password calls update_user with must_change_password=False."""
    user = _make_user()
    db = AsyncMock()
    mock_update = AsyncMock()
    with (
        patch("app.services.auth_service.user_repo.get_by_id", AsyncMock(return_value=user)),
        patch("app.services.auth_service.verify_password", return_value=True),
        patch("app.services.auth_service.hash_password", return_value="newhash"),
        patch("app.services.auth_service.user_repo.update_user", mock_update),
    ):
        await auth_service.change_password(db, user_id=1, current_password="old", new_password="new")
    mock_update.assert_awaited_once()
    _, kwargs = mock_update.call_args
    assert kwargs["must_change_password"] is False
    assert kwargs["password_hash"] == "newhash"


@pytest.mark.asyncio
async def test_change_password_wrong_current() -> None:
    """change_password raises AuthError when current password is wrong."""
    user = _make_user()
    db = AsyncMock()
    with (
        patch("app.services.auth_service.user_repo.get_by_id", AsyncMock(return_value=user)),
        patch("app.services.auth_service.verify_password", return_value=False),
    ):
        with pytest.raises(AuthError):
            await auth_service.change_password(db, user_id=1, current_password="bad", new_password="new")
