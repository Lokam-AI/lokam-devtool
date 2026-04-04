import pytest
from pydantic import ValidationError
from app.schemas.user import UserCreate, UserRead


def test_user_create_validates_role() -> None:
    """UserCreate rejects invalid role values."""
    with pytest.raises(ValidationError):
        UserCreate(email="a@b.com", password="pass123", name="Alice", role="hacker")


def test_user_create_valid() -> None:
    """UserCreate accepts valid data."""
    u = UserCreate(email="a@b.com", password="pass123", name="Alice", role="reviewer")
    assert u.role == "reviewer"


def test_user_read_excludes_password() -> None:
    """UserRead schema does not expose password_hash."""
    fields = UserRead.model_fields
    assert "password_hash" not in fields
    assert "password" not in fields
