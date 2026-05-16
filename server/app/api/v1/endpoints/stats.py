from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_admin
from app.models.user import User
from app.repositories import stats_repo, super_config_repo
from app.repositories.stats_repo import get_bug_type_stats

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/dashboard")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Return aggregate NPS, bug, sync, and correction-rate stats for the dashboard."""
    return await stats_repo.get_dashboard_stats(db)


@router.get("/bug-types")
async def get_bug_type_occurrence_stats(
    days: int = Query(default=7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[dict]:
    """Return per-bug-type occurrence counts for the given day window; admin+ only."""
    configs = await super_config_repo.list_by_category(db, "voice_bug_type", active_only=False)
    return await get_bug_type_stats(db, configs, days=days)
