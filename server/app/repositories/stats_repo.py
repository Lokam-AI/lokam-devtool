from datetime import date, timedelta
from typing import TYPE_CHECKING

from sqlalchemy import func, case, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bug_report import BugReport
from app.models.eval import Eval
from app.models.raw_call import RawCall

if TYPE_CHECKING:
    from app.models.super_config import SuperConfig


async def get_dashboard_stats(db: AsyncSession) -> dict:
    """Return aggregate stats for the admin dashboard in a single round-trip."""
    today = date.today()

    nps_row = await db.execute(
        select(
            func.count(case((Eval.gt_nps_score >= 9, 1))).label("promoters"),
            func.count(case((Eval.gt_nps_score.between(7, 8), 1))).label("neutrals"),
            func.count(case(((Eval.gt_nps_score <= 6) & Eval.gt_nps_score.isnot(None), 1))).label("detractors"),
            func.count(case((Eval.gt_nps_score.is_(None), 1))).label("unscored"),
            func.count(case((Eval.has_corrections.is_(True) & Eval.completed_at.isnot(None), 1))).label("corrections"),
            func.count(case((Eval.completed_at.isnot(None), 1))).label("completed"),
        )
    )
    nps = nps_row.one()

    bugs_row = await db.execute(
        select(func.count().label("open"))
        .where(BugReport.is_resolved.is_(False))
    )
    open_bugs = bugs_row.scalar_one()

    call_sync_row = await db.execute(
        select(
            func.max(RawCall.synced_at).label("last_sync"),
            func.count(case((func.date(RawCall.synced_at) == today, 1))).label("today"),
        )
    )
    call_sync = call_sync_row.one()

    bug_sync_row = await db.execute(
        select(
            func.max(BugReport.synced_at).label("last_sync"),
            func.count(case((func.date(BugReport.synced_at) == today, 1))).label("today"),
        )
    )
    bug_sync = bug_sync_row.one()

    correction_rate = (
        round(nps.corrections / nps.completed * 100, 1) if nps.completed else 0.0
    )

    return {
        "nps": {
            "promoters": nps.promoters,
            "neutrals":  nps.neutrals,
            "detractors": nps.detractors,
            "unscored":  nps.unscored,
        },
        "correction_rate": correction_rate,
        "open_bugs": open_bugs,
        "sync": {
            "last_call_sync": call_sync.last_sync.isoformat() if call_sync.last_sync else None,
            "calls_today":    call_sync.today,
            "last_bug_sync":  bug_sync.last_sync.isoformat() if bug_sync.last_sync else None,
            "bugs_today":     bug_sync.today,
        },
    }


async def get_bug_type_stats(
    db: AsyncSession,
    configs: "list[SuperConfig]",
    days: int = 7,
) -> list[dict]:
    """Return occurrence counts for each bug type over the given number of days."""
    since = date.today() - timedelta(days=days)
    results = []
    for cfg in configs:
        count_row = await db.execute(
            select(func.count())
            .where(BugReport.bug_date >= since)
            .where(BugReport.bug_types.contains([cfg.name]))
        )
        results.append({
            "id": cfg.id,
            "name": cfg.name,
            "display_name": cfg.display_name,
            "is_active": cfg.is_active,
            "count": count_row.scalar_one(),
            "days": days,
        })
    return sorted(results, key=lambda x: x["count"], reverse=True)
