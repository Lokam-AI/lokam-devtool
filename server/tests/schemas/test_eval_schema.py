import pytest
from pydantic import ValidationError
from app.schemas.eval import EvalUpdate


def test_eval_update_validates_status() -> None:
    """EvalUpdate rejects invalid eval_status values."""
    with pytest.raises(ValidationError):
        EvalUpdate(eval_status="unknown")


def test_eval_update_valid_status() -> None:
    """EvalUpdate accepts valid status value."""
    ev = EvalUpdate(eval_status="completed")
    assert ev.eval_status == "completed"
