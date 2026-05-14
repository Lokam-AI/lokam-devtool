import json
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import DEFAULT_BUCKET_PROBABILITIES, DEFAULT_REVIEWER_CAPACITY, DEFAULT_SPECIAL_MINIMUMS
from app.exceptions import DomainValidationError
from app.schemas.bucket_config import (
    NPS_BUCKET_KEYS,
    BucketConfigUpdate,
    BucketProbabilities,
    SpecialTypeMinimums,
)
from app.services import bucket_config_service


def _valid_probs() -> dict[str, float]:
    """Return a valid NPS probability dict summing to 1.0."""
    return dict(DEFAULT_BUCKET_PROBABILITIES)


def _valid_minimums() -> dict[str, int]:
    """Return valid special minimums."""
    return dict(DEFAULT_SPECIAL_MINIMUMS)


@pytest.mark.asyncio
async def test_get_config_returns_defaults_when_no_keys() -> None:
    """get_config returns code defaults when system_settings has no bucket config rows."""
    db = AsyncMock()
    with patch("app.services.bucket_config_service.system_setting_repo.get", AsyncMock(return_value=None)):
        cfg = await bucket_config_service.get_config(db)
    assert cfg.default_reviewer_capacity == DEFAULT_REVIEWER_CAPACITY
    assert cfg.probabilities.service_na == DEFAULT_BUCKET_PROBABILITIES["service_na"]


@pytest.mark.asyncio
async def test_get_config_returns_default_special_minimums_when_absent() -> None:
    """get_config returns default special minimums when the key is absent from system_settings."""
    db = AsyncMock()
    with patch("app.services.bucket_config_service.system_setting_repo.get", AsyncMock(return_value=None)):
        cfg = await bucket_config_service.get_config(db)
    for key in ("dnc", "email_send", "lead_escalated", "review_link_sent", "post_call_sms"):
        assert getattr(cfg.special_minimums, key) == DEFAULT_SPECIAL_MINIMUMS[key]


@pytest.mark.asyncio
async def test_get_config_reads_persisted_values() -> None:
    """get_config deserialises JSON rows from system_settings correctly."""
    db = AsyncMock()
    probs = _valid_probs()
    stored_probs = json.dumps(probs)
    stored_capacity = "12"
    stored_minimums = json.dumps({"dnc": 3, "email_send": 0, "lead_escalated": 2, "review_link_sent": 1, "post_call_sms": 4})

    async def _get(db: object, key: str) -> str | None:
        """Return stored value for each config key."""
        if key == "bucket_probabilities":
            return stored_probs
        if key == "default_reviewer_capacity":
            return stored_capacity
        if key == "special_type_minimums":
            return stored_minimums
        return None

    with patch("app.services.bucket_config_service.system_setting_repo.get", side_effect=_get):
        cfg = await bucket_config_service.get_config(db)

    assert cfg.default_reviewer_capacity == 12
    for k in NPS_BUCKET_KEYS:
        assert abs(getattr(cfg.probabilities, k) - probs[k]) < 1e-9
    assert cfg.special_minimums.dnc == 3
    assert cfg.special_minimums.email_send == 0


@pytest.mark.asyncio
async def test_get_config_falls_back_on_stale_13key_probabilities() -> None:
    """get_config falls back to defaults when the persisted probabilities row has extra keys (13-key legacy)."""
    db = AsyncMock()
    stale_probs = json.dumps({
        "service_na": 0.2, "service_passive": 0.0, "service_detractor": 0.06,
        "service_promoter": 0.09, "service_missed": 0.09, "sales_na": 0.0,
        "sales_detractor": 0.06, "sales_promoter": 0.06,
        "dnc": 0.05, "email_send": 0.05, "lead_escalated": 0.05,
        "review_link_sent": 0.05, "post_call_sms": 0.24,
    })

    async def _get(db: object, key: str) -> str | None:
        """Return stale 13-key probs."""
        return stale_probs if key == "bucket_probabilities" else None

    with patch("app.services.bucket_config_service.system_setting_repo.get", side_effect=_get):
        cfg = await bucket_config_service.get_config(db)

    # Should fall back to defaults, not crash
    assert cfg.probabilities.service_na == DEFAULT_BUCKET_PROBABILITIES["service_na"]


@pytest.mark.asyncio
async def test_update_config_persists_probabilities() -> None:
    """update_config calls system_setting_repo.set for probabilities when provided."""
    db = AsyncMock()
    probs = BucketProbabilities(**_valid_probs())
    patch_obj = BucketConfigUpdate(probabilities=probs, default_reviewer_capacity=None)

    set_calls: list[tuple] = []

    async def _set(db: object, key: str, value: str) -> None:
        """Record set calls."""
        set_calls.append((key, value))

    with (
        patch("app.services.bucket_config_service.system_setting_repo.set", side_effect=_set),
        patch("app.services.bucket_config_service.system_setting_repo.get", AsyncMock(return_value=None)),
    ):
        await bucket_config_service.update_config(db, patch_obj)

    assert any(k == "bucket_probabilities" for k, _ in set_calls)
    assert not any(k == "default_reviewer_capacity" for k, _ in set_calls)
    assert not any(k == "special_type_minimums" for k, _ in set_calls)


@pytest.mark.asyncio
async def test_update_config_persists_special_minimums() -> None:
    """update_config persists special_minimums when provided."""
    db = AsyncMock()
    minimums = SpecialTypeMinimums(dnc=2, email_send=0, lead_escalated=1, review_link_sent=3, post_call_sms=0)
    patch_obj = BucketConfigUpdate(probabilities=None, special_minimums=minimums)

    set_calls: list[tuple] = []

    async def _set(db: object, key: str, value: str) -> None:
        """Record set calls."""
        set_calls.append((key, value))

    with (
        patch("app.services.bucket_config_service.system_setting_repo.set", side_effect=_set),
        patch("app.services.bucket_config_service.system_setting_repo.get", AsyncMock(return_value=None)),
    ):
        await bucket_config_service.update_config(db, patch_obj)

    assert any(k == "special_type_minimums" for k, _ in set_calls)
    assert not any(k == "bucket_probabilities" for k, _ in set_calls)
    stored = next(v for k, v in set_calls if k == "special_type_minimums")
    parsed = json.loads(stored)
    assert parsed["dnc"] == 2
    assert parsed["email_send"] == 0


@pytest.mark.asyncio
async def test_update_config_persists_capacity_only() -> None:
    """update_config only sets default_reviewer_capacity when probabilities and minimums are None."""
    db = AsyncMock()
    patch_obj = BucketConfigUpdate(probabilities=None, default_reviewer_capacity=20)

    set_calls: list[tuple] = []

    async def _set(db: object, key: str, value: str) -> None:
        """Record set calls."""
        set_calls.append((key, value))

    with (
        patch("app.services.bucket_config_service.system_setting_repo.set", side_effect=_set),
        patch("app.services.bucket_config_service.system_setting_repo.get", AsyncMock(return_value=None)),
    ):
        await bucket_config_service.update_config(db, patch_obj)

    assert any(k == "default_reviewer_capacity" and v == "20" for k, v in set_calls)
    assert not any(k == "bucket_probabilities" for k, _ in set_calls)


def test_bucket_probabilities_rejects_sum_not_one() -> None:
    """BucketProbabilities raises ValidationError when sum deviates from 1.0 by more than tolerance."""
    bad_probs = _valid_probs()
    bad_probs["service_na"] += 0.1  # pushes sum to ~1.1

    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="sum to 1.0"):
        BucketProbabilities(**bad_probs)


def test_bucket_probabilities_accepts_sum_within_tolerance() -> None:
    """BucketProbabilities accepts a sum within 1e-3 of 1.0."""
    slightly_off = _valid_probs()
    slightly_off["service_na"] += 0.0009  # within 1e-3 tolerance
    probs = BucketProbabilities(**slightly_off)
    total = sum(getattr(probs, k) for k in NPS_BUCKET_KEYS)
    assert abs(total - 1.0) < 1e-3
