from pydantic import BaseModel, Field, model_validator


class CallTargets(BaseModel):
    """Per-category call assignment quotas."""

    na: int = Field(ge=0)
    detractor: int = Field(ge=0)
    promoter: int = Field(ge=0)
    missed: int = Field(ge=0)

    @property
    def total(self) -> int:
        """Return the sum of all category targets."""
        return self.na + self.detractor + self.promoter + self.missed


class AssignmentConfigRead(BaseModel):
    """Assignment configuration returned by the API."""

    max_calls_per_user: int
    call_targets: CallTargets


class AssignmentConfigUpdate(BaseModel):
    """Partial update payload for assignment configuration."""

    max_calls_per_user: int | None = Field(default=None, ge=1)
    call_targets: CallTargets | None = None

    @model_validator(mode="after")
    def _validate_budget(self) -> "AssignmentConfigUpdate":
        """Reject payloads where category totals exceed max_calls_per_user."""
        if self.max_calls_per_user is not None and self.call_targets is not None:
            if self.call_targets.total > self.max_calls_per_user:
                raise ValueError(
                    f"Category totals ({self.call_targets.total}) exceed "
                    f"max_calls_per_user ({self.max_calls_per_user})"
                )
        return self
