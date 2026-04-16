import argparse
import asyncio
import logging
from datetime import date, timedelta

# Silence all third-party logs before any imports
logging.basicConfig(level=logging.WARNING)

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.services.call_sync_service import sync_calls_for_date  # noqa: E402


def _parse_date() -> date:
    """Return the target date from --date YYYY-MM-DD, defaulting to yesterday."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", type=date.fromisoformat, default=None)
    args = parser.parse_args()
    return args.date or (date.today() - timedelta(days=1))


async def main() -> None:
    """Fetch call data for the target date and store it in our DB."""
    target = _parse_date()
    print(f"\n{'='*50}")
    print(f"  Call Sync — {target}")
    print(f"{'='*50}\n")

    async with AsyncSessionLocal() as session:
        try:
            summary = await sync_calls_for_date(session, target)
            await session.commit()

            total = sum(summary.values())
            print(f"\n{'—'*50}")
            print(f"  Done! {total} calls synced across {len(summary)} env(s)")
            for env_name, count in summary.items():
                print(f"    {env_name}: {count} calls")
            print(f"{'—'*50}\n")
        except Exception as e:
            await session.rollback()
            print(f"\n  ERROR: {e}\n")
            raise

if __name__ == "__main__":
    asyncio.run(main())
