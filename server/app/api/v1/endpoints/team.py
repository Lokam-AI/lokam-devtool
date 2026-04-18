from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from app.models.user import User
from app.repositories import eval_repo, user_repo
from app.schemas.team import TeamMemberStats

router = APIRouter(prefix="/team", tags=["team"])


@router.get("", response_model=list[TeamMemberStats])
async def get_team_overview(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[TeamMemberStats]:
    """Return per-reviewer eval statistics for the team overview; admin+ only."""
    users = await user_repo.list_all_active(db)
    stats_by_user = {s.user_id: s for s in await eval_repo.get_team_stats(db)}

    result: list[TeamMemberStats] = []
    for user in users:
        s = stats_by_user.get(user.id)
        calls_assigned = s.calls_assigned if s else 0
        completed_total = s.completed_total if s else 0
        result.append(
            TeamMemberStats(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role,
                calls_assigned=calls_assigned,
                calls_pending=s.calls_pending if s else 0,
                completed_total=completed_total,
                completed_today=s.completed_today if s else 0,
                completion_pct=round(completed_total / calls_assigned * 100, 1) if calls_assigned else 0.0,
                correction_rate=round(s.corrections_made / completed_total * 100, 1) if s and completed_total else 0.0,
                avg_nps=round(s.avg_nps, 1) if s and s.avg_nps is not None else None,
            )
        )
    return result
