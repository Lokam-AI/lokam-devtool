"""
Backfill is_dnc_request, is_incomplete_call, and incomplete_reason on raw_calls
from the call_metadata JSONB column.

These fields live in call_metadata but were not being extracted by the sync
service. Run this once per environment after deploying the sync fix.

Usage:
    python backfill_call_metadata_flags.py [--dry-run]
"""

import argparse
import asyncio
import logging

from sqlalchemy import text

from app.core.database import engine

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

BACKFILL_STATEMENTS = [
    (
        "is_dnc_request",
        """
        UPDATE raw_calls
        SET is_dnc_request = (call_metadata->>'is_dnc_request')::boolean
        WHERE call_metadata ? 'is_dnc_request'
          AND is_dnc_request IS DISTINCT FROM (call_metadata->>'is_dnc_request')::boolean
        """,
    ),
    (
        "is_incomplete_call",
        """
        UPDATE raw_calls
        SET is_incomplete_call = (call_metadata->>'is_incomplete_call')::boolean
        WHERE call_metadata ? 'is_incomplete_call'
          AND is_incomplete_call IS DISTINCT FROM (call_metadata->>'is_incomplete_call')::boolean
        """,
    ),
    (
        "incomplete_reason",
        """
        UPDATE raw_calls
        SET incomplete_reason = call_metadata->>'incomplete_reason'
        WHERE call_metadata ? 'incomplete_reason'
          AND incomplete_reason IS DISTINCT FROM call_metadata->>'incomplete_reason'
        """,
    ),
]


async def run(dry_run: bool) -> None:
    """Execute backfill updates and report row counts."""
    async with engine.begin() as conn:
        for field, sql in BACKFILL_STATEMENTS:
            if dry_run:
                count_sql = text(f"""
                    SELECT COUNT(*) FROM raw_calls
                    WHERE call_metadata ? '{field}'
                      AND {field}::text IS DISTINCT FROM call_metadata->>'{field}'
                """)
                result = await conn.execute(count_sql)
                count = result.scalar()
                log.info(f"[DRY RUN] {field}: {count} rows would be updated")
            else:
                result = await conn.execute(text(sql))
                log.info(f"{field}: {result.rowcount} rows updated")


def main() -> None:
    """Parse args and run backfill."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report counts without writing")
    args = parser.parse_args()

    asyncio.run(run(args.dry_run))
    log.info("Done.")


if __name__ == "__main__":
    main()
