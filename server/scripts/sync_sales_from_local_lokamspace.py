"""One-shot helper: ingest sales calls from a LOCAL lokamspace_app DB into devtool.

Usage:
    python scripts/sync_sales_from_local_lokamspace.py --days 7 --limit 200

Bypasses the HTTP /calls-export endpoint because the local lokamspace_app server
isn't running. Reads directly from `lokamspace_app` Postgres, transforms each row
to match devtool's `RawCallCreate` shape, upserts via raw_call_repo, and runs
assignment per call_date.

Safe to re-run — upsert is keyed on lokam_call_id.
"""
from __future__ import annotations

import argparse
import asyncio
import json
from collections import defaultdict
from datetime import date, timedelta

import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.repositories import raw_call_repo
from app.schemas.raw_call import RawCallCreate
from app.services import assignment_service

LOKAMSPACE_DSN = "postgresql://postgres:postgres@localhost:5432/lokamspace_app"
SOURCE_ENV = "app"


async def fetch_sales_calls(conn: asyncpg.Connection, since: date, limit: int) -> list[dict]:
    """Query lokamspace_app for sales-lead calls since `since`, with all joins for devtool."""
    rows = await conn.fetch(
        """
        SELECT
            c.id                AS lokam_call_id,
            c.start_time::date  AS call_date,
            o.name              AS organization_name,
            r.name              AS rooftop_name,
            cmp.name            AS campaign_name,
            l.type              AS lead_type,
            c.status            AS call_status,
            c.ended_reason      AS ended_reason,
            c.review_link_sent  AS review_link_sent,
            c.direction         AS direction,
            c.duration_sec      AS duration_sec,
            c.nps_score         AS nps_score,
            c.call_summary      AS call_summary,
            c.feedback_summary  AS feedback_summary,
            c.recording_url     AS recording_url,
            c.vapi_call_id      AS vapi_call_id,
            c.call_metadata     AS call_metadata,
            (c.call_metadata->>'is_dnc_request')::boolean      AS is_dnc_request,
            (c.call_metadata->>'lead_escalated')::boolean      AS lead_escalated,
            (c.call_metadata->>'escalation_needed')::boolean   AS escalation_needed,
            (c.call_metadata->>'is_incomplete_call')::boolean  AS is_incomplete_call,
            (c.call_metadata->>'incomplete_reason')             AS incomplete_reason,
            c.customer_number   AS customer_phone_raw,
            sr.customer_name    AS customer_name_raw,
            sr.id               AS service_record_id,
            sr.service_type     AS service_type,
            sr.status           AS sr_status,
            sr.vehicle_info     AS vehicle_info,
            o.id::text          AS organization_id
        FROM calls c
        JOIN leads l ON c.lead_id = l.id
        JOIN organizations o ON c.organization_id = o.id
        LEFT JOIN rooftops r ON c.rooftop_id = r.id
        LEFT JOIN campaigns cmp ON c.campaign_id = cmp.id
        LEFT JOIN servicerecords sr ON c.service_record_id = sr.id
        WHERE l.type = 'SALES_PRE_LEAD'
          AND c.status IN ('Completed', 'Missed', 'Failed')
          AND c.start_time::date >= $1
        ORDER BY c.start_time DESC
        LIMIT $2
        """,
        since,
        limit,
    )
    return [dict(r) for r in rows]


async def fetch_transcripts(conn: asyncpg.Connection, call_ids: list[int]) -> dict[int, tuple[str, str]]:
    """Return {call_id: (raw_transcript, formatted_transcript)} joined by line breaks."""
    if not call_ids:
        return {}
    rows = await conn.fetch(
        """
        SELECT call_id, role, message, cleaned_message, time
        FROM transcripts WHERE call_id = ANY($1::int[])
        ORDER BY call_id, COALESCE(time, 0)
        """,
        call_ids,
    )
    raw: dict[int, list[str]] = defaultdict(list)
    fmt: dict[int, list[str]] = defaultdict(list)
    for r in rows:
        raw[r["call_id"]].append(f"{r['role']}: {r['message']}")
        fmt[r["call_id"]].append(f"{r['role']}: {r['cleaned_message']}")
    return {cid: ("\n".join(raw[cid]), "\n".join(fmt[cid])) for cid in raw.keys()}


async def fetch_detractors(conn: asyncpg.Connection, call_ids: list[int]) -> dict[int, list[str]]:
    """Return {call_id: [detractor_tag, …]} from call_feedback rows where type='detractors'."""
    if not call_ids:
        return {}
    rows = await conn.fetch(
        """
        SELECT call_id, kpis
        FROM call_feedback
        WHERE type = 'detractors' AND call_id = ANY($1::int[]) AND kpis IS NOT NULL
        """,
        call_ids,
    )
    out: dict[int, list[str]] = defaultdict(list)
    for r in rows:
        out[r["call_id"]].append(r["kpis"])
    return dict(out)


def mask_phone(p: str | None) -> str | None:
    """Mask middle digits of a phone number for PII compliance."""
    if not p:
        return None
    if len(p) <= 4:
        return p
    return f"{p[:2]}{'*' * (len(p) - 4)}{p[-2:]}"


def mask_name(n: str | None) -> str | None:
    """Mask all but first/last letter of a name for PII compliance."""
    if not n:
        return None
    if len(n) <= 2:
        return n
    return f"{n[0]}{'*' * (len(n) - 2)}{n[-1]}"


def build_payload(
    row: dict,
    transcripts: dict[int, tuple[str, str]],
    detractors_by_call: dict[int, list[str]],
) -> RawCallCreate:
    """Map a lokamspace_app row to a devtool RawCallCreate payload."""
    call_id = row["lokam_call_id"]
    raw_t, fmt_t = transcripts.get(call_id, (None, None))
    detractors = detractors_by_call.get(call_id) or None
    # asyncpg returns JSONB as a raw string by default; parse so devtool's JSONB column
    # stores it as a native object (otherwise call_metadata->>'lead_escalated' won't work).
    raw_metadata = row["call_metadata"]
    call_metadata = json.loads(raw_metadata) if isinstance(raw_metadata, str) else raw_metadata
    service_record_json = None
    if row["service_record_id"] is not None:
        service_record_json = {
            "id": row["service_record_id"],
            "service_type": row["service_type"],
            "status": row["sr_status"],
            "vehicle_info": row["vehicle_info"],
            "customer_name_masked": mask_name(row["customer_name_raw"]),
        }
    organization_json = {"id": row["organization_id"], "name": row["organization_name"]}

    return RawCallCreate(
        lokam_call_id=call_id,
        call_date=row["call_date"],
        organization_name=row["organization_name"],
        rooftop_name=row["rooftop_name"],
        campaign_name=row["campaign_name"],
        lead_type=row["lead_type"],
        call_type="sales",
        call_status=row["call_status"],
        ended_reason=row["ended_reason"],
        review_link_sent=row["review_link_sent"],
        direction=row["direction"],
        duration_sec=row["duration_sec"],
        nps_score=row["nps_score"],
        call_summary=row["call_summary"],
        feedback_summary=row["feedback_summary"],
        detractors=detractors,
        is_dnc_request=row["is_dnc_request"],
        escalation_needed=row["escalation_needed"],
        lead_escalated=row["lead_escalated"],
        is_incomplete_call=row["is_incomplete_call"],
        incomplete_reason=row["incomplete_reason"],
        raw_transcript=raw_t,
        formatted_transcript=fmt_t,
        recording_url=row["recording_url"],
        vapi_call_id=row["vapi_call_id"],
        call_metadata=call_metadata,
        customer_name_masked=mask_name(row["customer_name_raw"]),
        customer_phone_masked=mask_phone(row["customer_phone_raw"]),
        service_record_json=service_record_json,
        organization_json=organization_json,
        source_env=SOURCE_ENV,
    )


async def upsert_all(db: AsyncSession, payloads: list[RawCallCreate]) -> None:
    """Upsert every payload via the existing repo helper."""
    for p in payloads:
        await raw_call_repo.upsert_by_lokam_call_id(db, p)


async def main(days: int, limit: int) -> None:
    """Pull sales calls from lokamspace_app, upsert into devtool, run assignment per date."""
    since = date.today() - timedelta(days=days)
    print(f"Fetching SALES_PRE_LEAD calls since {since} (limit={limit})…")
    conn = await asyncpg.connect(LOKAMSPACE_DSN)
    try:
        rows = await fetch_sales_calls(conn, since, limit)
        call_ids = [r["lokam_call_id"] for r in rows]
        transcripts = await fetch_transcripts(conn, call_ids)
        detractors_by_call = await fetch_detractors(conn, call_ids)
    finally:
        await conn.close()
    print(
        f"Found {len(rows)} sales calls, "
        f"{len(transcripts)} with transcripts, "
        f"{len(detractors_by_call)} with detractors."
    )

    if not rows:
        return

    payloads = [build_payload(r, transcripts, detractors_by_call) for r in rows]
    dates = sorted({p.call_date for p in payloads})

    async with AsyncSessionLocal() as db:
        await upsert_all(db, payloads)
        await db.commit()
    print(f"Upserted {len(payloads)} rows into raw_calls.")

    total_evals = 0
    for d in dates:
        async with AsyncSessionLocal() as db:
            n = await assignment_service.assign_calls_for_date(db, d, source_env=SOURCE_ENV)
            await db.commit()
        total_evals += n
        print(f"  assigned {n} evals for {d}")
    print(f"Total new evals created: {total_evals}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=7, help="Look back this many days from today")
    parser.add_argument("--limit", type=int, default=200, help="Max rows to fetch")
    args = parser.parse_args()
    asyncio.run(main(args.days, args.limit))
