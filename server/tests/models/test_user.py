from sqlalchemy import inspect
from app.models.user import User


def test_user_table_name() -> None:
    """User model maps to the 'users' table."""
    assert User.__tablename__ == "users"


def test_user_columns_exist() -> None:
    """User model defines all required columns."""
    col_names = {c.key for c in inspect(User).mapper.column_attrs}
    expected = {"id", "email", "password_hash", "name", "role", "is_active", "must_change_password", "created_at", "updated_at"}
    assert expected.issubset(col_names)


def test_user_role_default() -> None:
    """User role defaults to 'reviewer'."""
    user = User(email="a@b.com", password_hash="x", name="Alice")
    assert user.role == "reviewer"
