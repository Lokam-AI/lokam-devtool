from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.repositories import bug_report_repo
from app.schemas.bug_report import BugReportRead

router = APIRouter(prefix="/bugs", tags=["bugs"])

MAX_DATE_RANGE_DAYS = 90
PAGE_SIZE = 30


class AssignPayload(BaseModel):
    """Payload for assigning a bug to a user."""

    user_id: int | None


class ResolvePayload(BaseModel):
    """Payload for resolving or reopening a bug."""

    is_resolved: bool


@router.get("/my", response_model=list[BugReportRead])
async def list_my_bugs(
    is_resolved: bool | None = Query(default=None),
    organization_name: str | None = Query(default=None),
    bug_type: str | None = Query(default=None),
    limit: int = Query(default=PAGE_SIZE, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BugReportRead]:
    """Return bug reports assigned to the current user with optional filters; any authenticated role."""
    rows = await bug_report_repo.list_assigned_to(
        db, current_user.id, is_resolved=is_resolved,
        organization_name=organization_name, bug_type=bug_type, limit=limit, offset=offset,
    )
    return [BugReportRead.model_validate(r) for r in rows]


@router.get("/my/count")
async def count_my_bugs(
    is_resolved: bool | None = Query(default=None),
    organization_name: str | None = Query(default=None),
    bug_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    """Return count of bug reports assigned to the current user matching filters."""
    total = await bug_report_repo.count_assigned_to(
        db, current_user.id, is_resolved=is_resolved,
        organization_name=organization_name, bug_type=bug_type,
    )
    return {"count": total}


@router.get("", response_model=list[BugReportRead])
async def list_bugs(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date inclusive (YYYY-MM-DD)"),
    source_env: str | None = Query(None),
    organization_name: str | None = Query(None),
    is_resolved: bool | None = Query(default=None),
    bug_type: str | None = Query(default=None),
    limit: int = Query(default=PAGE_SIZE, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[BugReportRead]:
    """Return bug reports within an inclusive date range with optional filters and pagination; admin+ only."""
    if (date_to - date_from).days > MAX_DATE_RANGE_DAYS:
        raise HTTPException(status_code=400, detail=f"Date range exceeds {MAX_DATE_RANGE_DAYS} days.")
    rows = await bug_report_repo.list_by_date_range(
        db, date_from, date_to, source_env=source_env, organization_name=organization_name,
        is_resolved=is_resolved, bug_type=bug_type, limit=limit, offset=offset,
    )
    return [BugReportRead.model_validate(r) for r in rows]


@router.get("/count")
async def count_bugs(
    date_from: date = Query(...),
    date_to: date = Query(...),
    source_env: str | None = Query(None),
    organization_name: str | None = Query(None),
    is_resolved: bool | None = Query(default=None),
    bug_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, int]:
    """Return count of bug reports matching filters; admin+ only."""
    total = await bug_report_repo.count_by_date_range(
        db, date_from, date_to, source_env=source_env, organization_name=organization_name,
        is_resolved=is_resolved, bug_type=bug_type,
    )
    return {"count": total}


@router.get("/stats")
async def bug_stats(
    date_from: date = Query(...),
    date_to: date = Query(...),
    source_env: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    """Return summary stats (total, unique orgs/rooftops, top bug type) for a date range; admin+ only."""
    if (date_to - date_from).days > MAX_DATE_RANGE_DAYS:
        raise HTTPException(status_code=400, detail=f"Date range exceeds {MAX_DATE_RANGE_DAYS} days.")
    return await bug_report_repo.stats_by_date_range(db, date_from, date_to, source_env=source_env)


@router.patch("/{bug_id}/resolve", response_model=BugReportRead)
async def resolve_bug(
    bug_id: int,
    payload: ResolvePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BugReportRead:
    """Mark a bug as resolved or reopen it; any authenticated user."""
    bug = await bug_report_repo.resolve(db, bug_id, payload.is_resolved)
    if bug is None:
        raise HTTPException(status_code=404, detail="Bug report not found.")
    return BugReportRead.model_validate(bug)


@router.patch("/{bug_id}/assign", response_model=BugReportRead)
async def assign_bug(
    bug_id: int,
    payload: AssignPayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> BugReportRead:
    """Assign or unassign a bug report to a user; admin+ only."""
    bug = await bug_report_repo.assign(db, bug_id, payload.user_id)
    if bug is None:
        raise HTTPException(status_code=404, detail="Bug report not found.")
    return BugReportRead.model_validate(bug)
