import argparse
import asyncio
import logging
from datetime import date, timedelta

# Silence all third-party logs before any imports
logging.basicConfig(level=logging.WARNING)

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.services.bug_sync_service import sync_bugs_for_date  # noqa: E402
from app.services.call_sync_service import sync_calls_for_date  # noqa: E402


def _parse_date() -> date:
    """Return the target date from --date YYYY-MM-DD, defaulting to yesterday."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", type=date.fromisoformat, default=None)
    args = parser.parse_args()
    return args.date or (date.today() - timedelta(days=1))


async def main() -> None:
    """Fetch call and bug data for the target date and store in DB."""
    target = _parse_date()

    async with AsyncSessionLocal() as call_session:
        try:
            call_summary = await sync_calls_for_date(call_session, target)
            await call_session.commit()
            total = sum(call_summary.values())
            print(f"\n{'='*50}")
            print(f"  Call Sync — {target}")
            print(f"{'='*50}")
            print(f"\n{'—'*50}")
            print(f"  Done! {total} calls synced across {len(call_summary)} env(s)")
            for env_name, count in call_summary.items():
                print(f"    {env_name}: {count} calls")
            print(f"{'—'*50}\n")
        except Exception as e:
            await call_session.rollback()
            print(f"\n  ERROR (calls): {e}\n")
            raise

    async with AsyncSessionLocal() as bug_session:
        try:
            bug_summary = await sync_bugs_for_date(bug_session, target)
            await bug_session.commit()
            total = sum(bug_summary.values())
            print(f"\n{'='*50}")
            print(f"  Bug Sync — {target}")
            print(f"{'='*50}")
            print(f"\n{'—'*50}")
            print(f"  Done! {total} bugs synced across {len(bug_summary)} env(s)")
            for env_name, count in bug_summary.items():
                print(f"    {env_name}: {count} bugs")
            print(f"{'—'*50}\n")
        except Exception as e:
            await bug_session.rollback()
            print(f"\n  ERROR (bugs): {e}\n")
            raise

if __name__ == "__main__":
    asyncio.run(main())
