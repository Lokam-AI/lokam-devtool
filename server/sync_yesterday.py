import asyncio
import logging
from datetime import date, timedelta

# Silence SQLAlchemy engine logs BEFORE importing anything that creates the engine
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.engine.Engine").setLevel(logging.WARNING)

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.services.call_sync_service import sync_calls_for_date  # noqa: E402


async def main() -> None:
    """Fetch call data from yesterday and store it in our DB."""
    yesterday = date.today() - timedelta(days=1)
    print(f"\n{'='*50}")
    print(f"  Call Sync — {yesterday}")
    print(f"{'='*50}\n")

    async with AsyncSessionLocal() as session:
        try:
            summary = await sync_calls_for_date(session, yesterday)
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
