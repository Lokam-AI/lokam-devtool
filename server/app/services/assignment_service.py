from __future__ import annotations

import random
from collections import defaultdict
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.eval import Eval
from app.models.raw_call import RawCall
from app.models.user import User
from app.repositories import eval_repo, raw_call_repo, user_repo
from app.schemas.bucket_config import (
    NPS_BUCKET_KEYS,
    SPECIAL_KEYS,
    BucketProbabilities,
    SpecialTypeMinimums,
)
from app.schemas.eval import EvalCreate
from app.services import bucket_config_service

PROMOTER_NPS_MIN = 9
DETRACTOR_NPS_MAX = 6
PASSIVE_NPS_MIN = 7
PASSIVE_NPS_MAX = 8

SALES_NPS_PROMOTER = 10
SALES_NPS_DETRACTOR = 5

CALL_TYPE_SERVICE = "service"
CALL_TYPE_SALES = "sales"

MISSED_ENDED_REASONS = {"voicemail", "call_screening", "callback_requested", "dnc_request"}
NA_MIN_DURATION_SEC = 40

ALL_BUCKET_KEYS = NPS_BUCKET_KEYS + SPECIAL_KEYS


async def assign_calls_for_date(db: AsyncSession, call_date: date, source_env: str | None = None) -> int:
    """Two-phase call assignment: pick special minimums first, then fill with NPS probabilities."""
    users = await user_repo.list_active_reviewers(db)
    if not users:
        return 0
    cfg = await bucket_config_service.get_config(db)

    cap_by_user = {
        u.id: (u.capacity if u.capacity is not None else cfg.default_reviewer_capacity)
        for u in users
    }
    load = await _build_unified_load(db, [u.id for u in users], call_date)
    remaining = {uid: max(0, cap - load.get(uid, 0)) for uid, cap in cap_by_user.items()}
    total_pool = sum(remaining.values())
    if total_pool == 0:
        return 0

    service_calls = await raw_call_repo.get_unassigned_for_date(
        db, call_date, source_env, call_type=CALL_TYPE_SERVICE
    )
    sales_calls = await raw_call_repo.get_unassigned_for_date(
        db, call_date, source_env, call_type=CALL_TYPE_SALES
    )
    buckets = _build_buckets(service_calls + sales_calls)

    # Phase 1: guaranteed minimums for each special type.
    phase1_picks, seen_ids = _phase1_special_picks(buckets, cfg.special_minimums)

    # Phase 2: fill remaining slots using NPS bucket probabilities.
    # If phase1 exceeds pool (misconfigured minimums), phase2_pool floors at 0; _distribute caps total.
    phase2_pool = max(0, total_pool - len(phase1_picks))
    targets = _hamilton_round(cfg.probabilities, phase2_pool)
    phase2_picks = _phase2_nps_picks(buckets, targets, seen_ids)

    records = _distribute(phase1_picks + phase2_picks, users, remaining)

    if records:
        await eval_repo.create_bulk(db, records)
    return len(records)


async def _build_unified_load(
    db: AsyncSession,
    user_ids: list[int],
    call_date: date,
) -> dict[int, int]:
    """Return user_id → eval count already assigned for call_date (all call types combined)."""
    query = (
        select(Eval.assigned_to, func.count(Eval.id))
        .join(RawCall, Eval.call_id == RawCall.lokam_call_id)
        .where(RawCall.call_date == call_date, Eval.assigned_to.in_(user_ids))
        .group_by(Eval.assigned_to)
    )
    result = await db.execute(query)
    return {row[0]: row[1] for row in result.all()}


def _build_buckets(calls: list[RawCall]) -> dict[str, list[RawCall]]:
    """Categorize calls into NPS and special buckets; specials may overlap NPS buckets."""
    raw: dict[str, list[RawCall]] = {k: [] for k in ALL_BUCKET_KEYS}
    for call in calls:
        _categorize_into_buckets(call, raw)
    return {k: _interleave_by_rooftop(v) for k, v in raw.items()}


def _categorize_into_buckets(call: RawCall, buckets: dict[str, list[RawCall]]) -> None:
    """Add a call to every applicable bucket (NPS exclusive per call_type; specials overlapping)."""
    if call.call_type == CALL_TYPE_SERVICE:
        if call.call_status != "Completed":
            if call.ended_reason in MISSED_ENDED_REASONS:
                buckets["service_missed"].append(call)
        elif call.nps_score is None:
            buckets["service_na"].append(call)
        elif call.nps_score >= PROMOTER_NPS_MIN:
            buckets["service_promoter"].append(call)
        elif call.nps_score <= DETRACTOR_NPS_MAX:
            buckets["service_detractor"].append(call)
        else:
            buckets["service_passive"].append(call)
    elif call.call_type == CALL_TYPE_SALES:
        if call.nps_score == SALES_NPS_PROMOTER:
            buckets["sales_promoter"].append(call)
        elif call.nps_score == SALES_NPS_DETRACTOR:
            buckets["sales_detractor"].append(call)
        else:
            buckets["sales_na"].append(call)

    # Special buckets overlap NPS — same call may appear in both
    if call.is_dnc_request:
        buckets["dnc"].append(call)
    if _is_email_send(call):
        buckets["email_send"].append(call)
    if call.lead_escalated:
        buckets["lead_escalated"].append(call)
    if call.review_link_sent:
        buckets["review_link_sent"].append(call)
    if call.is_post_call_sms_survey:
        buckets["post_call_sms"].append(call)


def _is_email_send(call: RawCall) -> bool:
    """Return True if call metadata signals an email-send event."""
    meta = call.call_metadata or {}
    return bool(meta.get("email_send") or meta.get("is_email_send"))


def _is_short_na(call: RawCall) -> bool:
    """Return True if call is a completed service call with no NPS and duration < 40s."""
    return (
        call.call_type == CALL_TYPE_SERVICE
        and call.call_status == "Completed"
        and call.nps_score is None
        and (call.duration_sec or 0) < NA_MIN_DURATION_SEC
    )


def _phase1_special_picks(
    buckets: dict[str, list[RawCall]],
    special_minimums: SpecialTypeMinimums,
) -> tuple[list[RawCall], set[int]]:
    """Pick the minimum count of each special call type, preferring calls that satisfy multiple minimums.

    Candidates for each bucket are sorted by how many *other* still-unsatisfied buckets they also
    belong to.  This ensures an overlap call (e.g. DNC + email_send) is chosen before a single-type
    call even when it appears later in the source bucket list, minimising total unique picks.
    """
    seen_ids: set[int] = set()
    picks: list[RawCall] = []
    bucket_id_sets = {key: {c.lokam_call_id for c in buckets[key]} for key in SPECIAL_KEYS}

    for key in SPECIAL_KEYS:
        min_count = getattr(special_minimums, key)
        if min_count == 0:
            continue
        already = sum(1 for c in picks if c.lokam_call_id in bucket_id_sets[key])
        need = min_count - already
        if need <= 0:
            continue

        # Keys whose minimums are still unsatisfied after crediting current picks.
        other_needs = {
            k for k in SPECIAL_KEYS
            if k != key
            and getattr(special_minimums, k) > sum(
                1 for c in picks if c.lokam_call_id in bucket_id_sets[k]
            )
        }
        # Sort by overlap score descending so multi-satisfying calls come first.
        candidates = [c for c in buckets[key] if c.lokam_call_id not in seen_ids]
        candidates.sort(
            key=lambda c: sum(1 for k in other_needs if c.lokam_call_id in bucket_id_sets[k]),
            reverse=True,
        )

        count = 0
        for call in candidates:
            if count >= need:
                break
            seen_ids.add(call.lokam_call_id)
            picks.append(call)
            count += 1
    return picks, seen_ids


def _hamilton_round(probs: BucketProbabilities, total_pool: int) -> dict[str, int]:
    """Distribute total_pool seats across NPS buckets by largest-remainder (Hamilton) method."""
    raw_quotas = {k: getattr(probs, k) * total_pool for k in NPS_BUCKET_KEYS}
    floors = {k: int(v) for k, v in raw_quotas.items()}
    residuals = {k: raw_quotas[k] - floors[k] for k in NPS_BUCKET_KEYS}
    remainder = total_pool - sum(floors.values())
    for k in sorted(NPS_BUCKET_KEYS, key=lambda x: residuals[x], reverse=True)[:remainder]:
        floors[k] += 1
    return floors


def _pick_na_calls(available: list[RawCall], count: int) -> list[RawCall]:
    """Pick up to count service-NA calls; prefer long (≥40s) with at most 1 short allowed."""
    if count <= 0:
        return []
    long_calls = [c for c in available if (c.duration_sec or 0) >= NA_MIN_DURATION_SEC]
    short_calls = [c for c in available if (c.duration_sec or 0) < NA_MIN_DURATION_SEC]
    picks = long_calls[:count]
    if len(picks) < count and short_calls:
        picks.append(short_calls[0])
    return picks


def _phase2_nps_picks(
    buckets: dict[str, list[RawCall]],
    targets: dict[str, int],
    exclude_ids: set[int],
) -> list[RawCall]:
    """Draw target calls from NPS buckets, excluding phase-1 picks; dedup within phase 2."""
    seen_ids: set[int] = set(exclude_ids)
    picks: list[RawCall] = []
    for key in NPS_BUCKET_KEYS:
        target = targets[key]
        if target <= 0:
            continue
        available = [c for c in buckets[key] if c.lokam_call_id not in seen_ids]
        selected = _pick_na_calls(available, target) if key == "service_na" else available[:target]
        for call in selected:
            if call.lokam_call_id not in seen_ids:
                seen_ids.add(call.lokam_call_id)
                picks.append(call)
    return picks


def _distribute(
    picks: list[RawCall],
    users: list[User],
    remaining: dict[int, int],
) -> list[EvalCreate]:
    """Round-robin assign picks to users; short NA calls capped at 1 per reviewer."""
    # Sort: short NA calls last so long calls fill slots first
    non_short_na = [c for c in picks if not _is_short_na(c)]
    short_na = [c for c in picks if _is_short_na(c)]
    random.shuffle(non_short_na)
    random.shuffle(short_na)
    ordered = non_short_na + short_na

    active = [u for u in users if remaining.get(u.id, 0) > 0]
    random.shuffle(active)
    rem = {u.id: remaining[u.id] for u in active}
    short_na_used: set[int] = set()
    records: list[EvalCreate] = []
    cursor = 0

    for call in ordered:
        if not active:
            break
        is_sna = _is_short_na(call)
        for offset in range(len(active)):
            pos = (cursor + offset) % len(active)
            u = active[pos]
            if is_sna and u.id in short_na_used:
                continue
            records.append(_build_eval_create(call, u.id))
            if is_sna:
                short_na_used.add(u.id)
            rem[u.id] -= 1
            if rem[u.id] == 0:
                active.pop(pos)
                cursor = pos % len(active) if active else 0
            else:
                cursor = (pos + 1) % len(active)
            break

    return records


def _interleave_by_rooftop(calls: list[RawCall]) -> list[RawCall]:
    """Round-robin interleave calls across rooftops so picks span multiple rooftops."""
    groups: dict[str, list[RawCall]] = defaultdict(list)
    for call in calls:
        key = call.rooftop_name or call.organization_name or "__unknown__"
        groups[key].append(call)
    for group in groups.values():
        random.shuffle(group)
    result: list[RawCall] = []
    iters = [iter(g) for g in groups.values()]
    while iters:
        next_iters = []
        for it in iters:
            try:
                result.append(next(it))
                next_iters.append(it)
            except StopIteration:
                pass
        iters = next_iters
    return result


def _build_eval_create(call: RawCall, user_id: int) -> EvalCreate:
    """Build an EvalCreate record from a RawCall and a user id."""
    return EvalCreate(
        call_id=call.lokam_call_id,
        assigned_to=user_id,
        call_status=call.call_status,
        lead_type=call.lead_type,
        call_type=call.call_type,
        raw_transcript=call.raw_transcript,
        formatted_transcript=call.formatted_transcript,
        recording_url=call.recording_url,
        service_record_json=call.service_record_json,
        organization_json=call.organization_json,
    )
