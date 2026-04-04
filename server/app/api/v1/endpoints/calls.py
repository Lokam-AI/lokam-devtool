from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from app.models.user import User
from app.schemas.raw_call import RawCallRead
from app.repositories import raw_call_repo
from app.services import call_sync_service

router = APIRouter(prefix="/calls", tags=["calls"])


@router.get("", response_model=list[RawCallRead])
async def list_calls(
    call_date: date = Query(...),
    source_env: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[RawCallRead]:
    """Return raw calls filtered by date and optional environment; admin+ only."""
    rows = await raw_call_repo.list_by_date(db, call_date, source_env)
    return [RawCallRead.model_validate(r) for r in rows]


@router.post("/sync")
async def sync_calls(
    call_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    """Manually trigger call sync from all active environments for the given date; admin+ only."""
    summary = await call_sync_service.sync_calls_for_date(db, call_date)
    return {"synced": summary}
