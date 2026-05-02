"""Backfill is_post_call_sms_survey by re-syncing all dates with existing calls.

Uses APP_BASE_URL + APP_API_KEY from .env directly, bypassing env_configs decryption.

Run from repo root:
    python scripts/backfill_sms_flag.py
"""
import asyncio
import logging
import os
import sys
from datetime import date, timedelta
from pathlib import Path

# Allow running from repo root without PYTHONPATH override
sys.path.insert(0, str(Path(__file__).parent.parent / "server"))

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "server" / ".env")
logging.basicConfig(level=logging.WARNING)

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.repositories import raw_call_repo  # noqa: E402
from app.schemas.raw_call import RawCallCreate  # noqa: E402
from app.services.call_sync_service import _flatten_post_call_sms  # noqa: E402

START_DATE = date(2026, 4, 16)
END_DATE = date(2026, 5, 1)

BASE_URL = os.environ["APP_BASE_URL"]
API_KEY = os.environ["APP_API_KEY"]
CALLS_EXPORT_PATH = "/api/v1/internal/calls-export"
SUPPORTED_LEAD_TYPE = "SERVICE_POST_RO"


async def sync_date(client: httpx.AsyncClient, target: date) -> int:
    """Fetch calls for one date and upsert into local DB; return upserted count."""
    response = await client.get(
        f"{BASE_URL}{CALLS_EXPORT_PATH}",
        headers={"Authorization": f"Bearer {API_KEY}"},
        params={"date": target.isoformat()},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    calls_data: list[dict] = payload if isinstance(payload, list) else payload.get("calls", [])

    upserted = 0
    async with AsyncSessionLocal() as db:
        for item in calls_data:
            if item.get("lead_type") != SUPPORTED_LEAD_TYPE:
                continue
            item["source_env"] = "app"
            if "id" in item and "lokam_call_id" not in item:
                item["lokam_call_id"] = item.pop("id")
            metadata = item.get("call_metadata") or {}
            if "escalation_needed" not in item:
                item["escalation_needed"] = metadata.get("escalation_needed")
            _flatten_post_call_sms(item)
            schema = RawCallCreate(**item)
            await raw_call_repo.upsert_by_lokam_call_id(db, schema)
            upserted += 1
        await db.commit()
    return upserted


async def main() -> None:
    """Re-sync every date from START_DATE to END_DATE to backfill SMS flag."""
    async with httpx.AsyncClient() as client:
        current = START_DATE
        while current <= END_DATE:
            try:
                count = await sync_date(client, current)
                print(f"{current}  {count} calls upserted")
            except Exception as e:
                print(f"{current}  ERROR: {e}")
            current += timedelta(days=1)
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
