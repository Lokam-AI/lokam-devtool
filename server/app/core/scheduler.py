import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from app.core.database import AsyncSessionLocal
from app.services.bug_sync_service import sync_bugs_for_date
from app.services.call_sync_service import sync_calls_for_date

logger = logging.getLogger(__name__)


def _seconds_until_next_midnight_utc() -> float:
    """Return seconds from now until the next 00:00 UTC."""
    now = datetime.now(timezone.utc)
    next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return (next_midnight - now).total_seconds()


async def _run_sync(target: date) -> None:
    """Run call and bug sync for target date inside independent DB sessions."""
    async with AsyncSessionLocal() as db:
        summary = await sync_calls_for_date(db, target)
        await db.commit()
        logger.info("call sync done date=%s counts=%s", target, summary)

    async with AsyncSessionLocal() as db:
        summary = await sync_bugs_for_date(db, target)
        await db.commit()
        logger.info("bug sync done date=%s counts=%s", target, summary)


async def daily_sync_loop() -> None:
    """Sleep until 00:00 UTC, sync yesterday's data, then repeat."""
    while True:
        delay = _seconds_until_next_midnight_utc()
        logger.info("next sync in %.0f seconds", delay)
        await asyncio.sleep(delay)

        yesterday = date.today() - timedelta(days=1)
        try:
            await _run_sync(yesterday)
        except Exception:
            logger.exception("daily sync failed for %s", yesterday)
