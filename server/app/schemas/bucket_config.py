from pydantic import BaseModel, Field, model_validator

NPS_BUCKET_KEYS: tuple[str, ...] = (
    "service_na",
    "service_passive",
    "service_detractor",
    "service_promoter",
    "service_missed",
    "sales_na",
    "sales_detractor",
    "sales_promoter",
)

SPECIAL_KEYS: tuple[str, ...] = (
    "dnc",
    "email_send",
    "lead_escalated",
    "review_link_sent",
    "post_call_sms",
)

SUM_TOLERANCE: float = 1e-3


class BucketProbabilities(BaseModel):
    """NPS bucket probability map (8 buckets) — values must sum to 1.0 ± 1e-3."""

    service_na: float = Field(ge=0, le=1)
    service_passive: float = Field(ge=0, le=1)
    service_detractor: float = Field(ge=0, le=1)
    service_promoter: float = Field(ge=0, le=1)
    service_missed: float = Field(ge=0, le=1)
    sales_na: float = Field(ge=0, le=1)
    sales_detractor: float = Field(ge=0, le=1)
    sales_promoter: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def _validate_sum(self) -> "BucketProbabilities":
        """Reject configs where NPS probabilities do not sum to 1.0 within tolerance."""
        total = sum(getattr(self, k) for k in NPS_BUCKET_KEYS)
        if abs(total - 1.0) > SUM_TOLERANCE:
            raise ValueError(
                f"Bucket probabilities must sum to 1.0 (got {total:.6f}, tolerance ±{SUM_TOLERANCE})"
            )
        return self

    def to_dict(self) -> dict[str, float]:
        """Return NPS probabilities as a plain dict keyed by NPS_BUCKET_KEYS order."""
        return {k: getattr(self, k) for k in NPS_BUCKET_KEYS}


class SpecialTypeMinimums(BaseModel):
    """Per-org integer minimum call counts for special call types (Phase 1 picks)."""

    dnc: int = Field(default=1, ge=0)
    email_send: int = Field(default=1, ge=0)
    lead_escalated: int = Field(default=1, ge=0)
    review_link_sent: int = Field(default=1, ge=0)
    post_call_sms: int = Field(default=1, ge=0)

    def to_dict(self) -> dict[str, int]:
        """Return special minimums as a plain dict keyed by SPECIAL_KEYS order."""
        return {k: getattr(self, k) for k in SPECIAL_KEYS}


class BucketConfigRead(BaseModel):
    """Org-level call distribution config returned by the API."""

    probabilities: BucketProbabilities
    special_minimums: SpecialTypeMinimums
    default_reviewer_capacity: int


class BucketConfigUpdate(BaseModel):
    """Partial update payload for org-level call distribution config."""

    probabilities: BucketProbabilities | None = None
    special_minimums: SpecialTypeMinimums | None = None
    default_reviewer_capacity: int | None = Field(default=None, ge=1)


class ReviewerCapacityUpdateItem(BaseModel):
    """Single entry in a bulk capacity update request."""

    user_id: int
    capacity: int | None = Field(default=None, ge=1)


class ReviewerCapacityRead(BaseModel):
    """Per-reviewer capacity view returned by the API."""

    user_id: int
    email: str
    name: str
    capacity: int | None
    effective_capacity: int


class ReviewerCapacityUpdate(BaseModel):
    """Update payload for a single reviewer's capacity (None resets to org default)."""

    capacity: int | None = Field(default=None, ge=1)


class ReviewerCapacityBulkUpdate(BaseModel):
    """Bulk update payload for reviewer capacities."""

    updates: list[ReviewerCapacityUpdateItem]
