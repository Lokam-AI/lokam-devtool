import asyncio
from datetime import date, timedelta

from app.core.database import AsyncSessionLocal
from app.services.call_sync_service import sync_calls_for_date

async def main() -> None:
    """Fetch call data from yesterday and store it in our DB."""
    # Always fetch for yesterday
    yesterday = date.today() - timedelta(days=1)
    print(f"Starting call sync for date: {yesterday}")

    async with AsyncSessionLocal() as session:
        try:
            # Sync calls from all active environments
            summary = await sync_calls_for_date(session, yesterday)
            # Commit the session since the service methods might not commit themselves directly
            await session.commit()
            print(f"Sync complete for {yesterday}. Summary of upserted/assigned calls: {summary}")
        except Exception as e:
            await session.rollback()
            print(f"Error during sync: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(main())
