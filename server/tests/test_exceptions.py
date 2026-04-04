import pytest
from app.exceptions import AppError, NotFoundError, AuthError, PermissionError


def test_app_error_is_base() -> None:
    """AppError is the base for all domain exceptions."""
    assert issubclass(NotFoundError, AppError)
    assert issubclass(AuthError, AppError)
    assert issubclass(PermissionError, AppError)


def test_not_found_has_default_message() -> None:
    """NotFoundError carries a descriptive message."""
    err = NotFoundError("User not found")
    assert str(err) == "User not found"
