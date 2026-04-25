from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

PAGE_SIZE = 30

from app.dependencies import get_current_user, get_db, require_admin, require_reviewer
from app.exceptions import NotFoundError
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


@router.get("/all", response_model=list[RawCallRead])
async def list_all_calls(
    source_env: str | None = Query(default=None),
    call_status: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    search: str | None = Query(default=None),
    organization_name: str | None = Query(default=None),
    nps_filter: str | None = Query(default=None),
    sort_by: str = Query(default="date"),
    sort_dir: str = Query(default="desc"),
    limit: int = Query(default=PAGE_SIZE, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> list[RawCallRead]:
    """Return all raw calls with optional filters and pagination; reviewer+ only."""
    rows = await raw_call_repo.list_all(
        db, source_env, call_status, date_from, date_to,
        search, organization_name, nps_filter, sort_by, sort_dir, limit, offset,
    )
    return [RawCallRead.model_validate(r) for r in rows]


@router.get("/all/count")
async def count_all_calls(
    source_env: str | None = Query(default=None),
    call_status: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    search: str | None = Query(default=None),
    organization_name: str | None = Query(default=None),
    nps_filter: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> dict[str, int]:
    """Return count of all raw calls matching filters; reviewer+ only."""
    total = await raw_call_repo.count_all(
        db, source_env, call_status, date_from, date_to, search, organization_name, nps_filter,
    )
    return {"count": total}


@router.get("/all/stats")
async def stats_all_calls(
    source_env: str | None = Query(default=None),
    call_status: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    search: str | None = Query(default=None),
    organization_name: str | None = Query(default=None),
    nps_filter: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> dict:
    """Return avg_duration_sec and avg_nps across all raw calls matching filters; reviewer+ only."""
    return await raw_call_repo.stats_all(
        db, source_env, call_status, date_from, date_to, search, organization_name, nps_filter,
    )


@router.get("/{call_id}", response_model=RawCallRead)
async def get_call(
    call_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> RawCallRead:
    """Return a single raw call by lokam_call_id; admin+ only."""
    row = await raw_call_repo.get_by_lokam_call_id(db, call_id)
    if not row:
        raise NotFoundError(f"Call {call_id} not found")
    return RawCallRead.model_validate(row)


@router.post("/sync")
async def sync_calls(
    call_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    """Manually trigger call sync from all active environments for the given date; admin+ only."""
    summary = await call_sync_service.sync_calls_for_date(db, call_date)
    return {"synced": summary}
