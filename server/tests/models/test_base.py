from sqlalchemy import inspect
from app.models.base import Base, TimestampMixin


class _SampleModel(Base, TimestampMixin):
    """Minimal concrete model used to test TimestampMixin column injection."""

    __tablename__ = "_sample_for_test"

    from sqlalchemy.orm import Mapped, mapped_column
    id: Mapped[int] = mapped_column(primary_key=True)


def test_timestamp_mixin_has_created_at() -> None:
    """TimestampMixin injects created_at and updated_at into concrete models."""
    col_names = {c.key for c in inspect(_SampleModel).mapper.column_attrs}
    assert "created_at" in col_names
    assert "updated_at" in col_names
