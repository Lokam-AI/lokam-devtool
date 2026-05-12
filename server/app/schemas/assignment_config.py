from pydantic import BaseModel, Field, model_validator


class CallTargets(BaseModel):
    """Per-category call assignment quotas for service calls (5 NPS buckets)."""

    na: int = Field(ge=0)
    passive: int = Field(ge=0, default=0)
    detractor: int = Field(ge=0)
    promoter: int = Field(ge=0)
    missed: int = Field(ge=0)

    @property
    def total(self) -> int:
        """Return the sum of all category targets."""
        return self.na + self.passive + self.detractor + self.promoter + self.missed


class SalesCallTargets(BaseModel):
    """Per-status call assignment quotas for sales calls (3 buckets — no passive/missed)."""

    na: int = Field(ge=0)
    detractor: int = Field(ge=0)
    promoter: int = Field(ge=0)

    @property
    def total(self) -> int:
        """Return the sum of all status targets."""
        return self.na + self.detractor + self.promoter


class AssignmentConfigRead(BaseModel):
    """Assignment configuration returned by the API."""

    max_calls_per_user: int
    call_targets: CallTargets
    sales_max_calls_per_user: int
    sales_call_targets: SalesCallTargets


class AssignmentConfigUpdate(BaseModel):
    """Partial update payload for assignment configuration."""

    max_calls_per_user: int | None = Field(default=None, ge=1)
    call_targets: CallTargets | None = None
    sales_max_calls_per_user: int | None = Field(default=None, ge=1)
    sales_call_targets: SalesCallTargets | None = None

    @model_validator(mode="after")
    def _validate_budget(self) -> "AssignmentConfigUpdate":
        """Reject payloads where category totals exceed their per-user cap."""
        if self.max_calls_per_user is not None and self.call_targets is not None:
            if self.call_targets.total > self.max_calls_per_user:
                raise ValueError(
                    f"Service category totals ({self.call_targets.total}) exceed "
                    f"max_calls_per_user ({self.max_calls_per_user})"
                )
        if self.sales_max_calls_per_user is not None and self.sales_call_targets is not None:
            if self.sales_call_targets.total > self.sales_max_calls_per_user:
                raise ValueError(
                    f"Sales status totals ({self.sales_call_targets.total}) exceed "
                    f"sales_max_calls_per_user ({self.sales_max_calls_per_user})"
                )
        return self
