from datetime import date, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_async_session as get_db
from app.services.bug_sync_service import sync_bugs_for_date
from app.services.call_sync_service import sync_calls_for_date

router = APIRouter(prefix="/internal", tags=["internal"])


def _verify_sync_secret(x_sync_secret: str = Header(...)) -> None:
    """Reject requests that don't carry the correct sync secret header."""
    if x_sync_secret != settings.SYNC_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/sync", dependencies=[Depends(_verify_sync_secret)])
async def trigger_sync(db: AsyncSession = Depends(get_db)) -> dict:
    """Run call and bug sync for yesterday. Called by EventBridge Scheduler."""
    target = date.today() - timedelta(days=1)

    call_summary = await sync_calls_for_date(db, target)
    await db.commit()

    bug_summary = await sync_bugs_for_date(db, target)
    await db.commit()

    return {
        "date": target.isoformat(),
        "calls": call_summary,
        "bugs": bug_summary,
    }
