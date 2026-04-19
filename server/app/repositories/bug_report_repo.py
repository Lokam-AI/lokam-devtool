from datetime import date, datetime
from datetime import date as date_type

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bug_report import BugReport

MANUAL_SOURCE_ENV = "manual"


async def create_manual(
    db: AsyncSession,
    *,
    call_id: int | None,
    organization_name: str | None,
    rooftop_name: str | None,
    bug_types: list[str],
    description: str | None,
    submitted_by: int,
    submitted_by_name: str,
) -> BugReport:
    """Insert a manually filed bug report; external_id is set to -id after flush."""
    bug = BugReport(
        external_id=0,
        source_env=MANUAL_SOURCE_ENV,
        bug_date=date_type.today(),
        call_id=call_id,
        organization_name=organization_name,
        rooftop_name=rooftop_name,
        bug_types=bug_types or None,
        description=description,
        submitted_by=submitted_by,
        submitted_by_name=submitted_by_name,
        assigned_to=submitted_by,
        external_created_at=datetime.utcnow(),
    )
    db.add(bug)
    await db.flush()
    bug.external_id = -bug.id
    return bug


async def upsert(
    db: AsyncSession,
    *,
    external_id: int,
    source_env: str,
    bug_date: date,
    call_id: int | None,
    organization_id: str | None,
    organization_name: str | None,
    rooftop_id: str | None,
    rooftop_name: str | None,
    bug_types: list | None,
    description: str | None,
    submitted_by: int | None,
    submitted_by_name: str | None,
    external_created_at: datetime | None,
) -> BugReport:
    """Insert or update a BugReport row keyed on (external_id, source_env)."""
    values = dict(
        external_id=external_id,
        source_env=source_env,
        bug_date=bug_date,
        call_id=call_id,
        organization_id=organization_id,
        organization_name=organization_name,
        rooftop_id=rooftop_id,
        rooftop_name=rooftop_name,
        bug_types=bug_types,
        description=description,
        submitted_by=submitted_by,
        submitted_by_name=submitted_by_name,
        external_created_at=external_created_at,
    )
    updatable = {k: v for k, v in values.items() if k not in ("external_id", "source_env")}
    stmt = (
        insert(BugReport)
        .values(**values)
        .on_conflict_do_update(
            constraint="uq_bug_reports_external_id_env",
            set_=updatable,
        )
        .returning(BugReport)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


def _apply_bug_date_filters(
    query: object,
    date_from: date,
    date_to: date,
    source_env: str | None,
    organization_name: str | None,
    is_resolved: bool | None,
    bug_type: str | None,
) -> object:
    """Apply shared filter clauses to a BugReport select query."""
    query = query.where(BugReport.bug_date >= date_from, BugReport.bug_date <= date_to)
    if source_env is not None:
        query = query.where(BugReport.source_env == source_env)
    if organization_name is not None:
        query = query.where(BugReport.organization_name == organization_name)
    if is_resolved is not None:
        query = query.where(BugReport.is_resolved == is_resolved)
    if bug_type is not None:
        query = query.where(BugReport.bug_types.contains([bug_type]))
    return query


async def list_by_date_range(
    db: AsyncSession,
    date_from: date,
    date_to: date,
    source_env: str | None = None,
    organization_name: str | None = None,
    is_resolved: bool | None = None,
    bug_type: str | None = None,
    limit: int = 30,
    offset: int = 0,
) -> list[BugReport]:
    """Return BugReport rows within an inclusive date range with optional filters and pagination."""
    query = select(BugReport)
    query = _apply_bug_date_filters(query, date_from, date_to, source_env, organization_name, is_resolved, bug_type)
    result = await db.execute(
        query.order_by(BugReport.bug_date.desc(), BugReport.id.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def count_by_date_range(
    db: AsyncSession,
    date_from: date,
    date_to: date,
    source_env: str | None = None,
    organization_name: str | None = None,
    is_resolved: bool | None = None,
    bug_type: str | None = None,
) -> int:
    """Return count of BugReport rows matching filters."""
    query = select(func.count(BugReport.id))
    query = _apply_bug_date_filters(query, date_from, date_to, source_env, organization_name, is_resolved, bug_type)
    result = await db.execute(query)
    return result.scalar_one()


async def stats_by_date_range(
    db: AsyncSession,
    date_from: date,
    date_to: date,
    source_env: str | None = None,
) -> dict:
    """Return summary stats (unique orgs, rooftops, top bug type) for a date range."""
    rows = await list_by_date_range(db, date_from, date_to, source_env=source_env, limit=10000, offset=0)
    unique_orgs = len({r.organization_name for r in rows if r.organization_name})
    unique_rooftops = len({r.rooftop_id for r in rows if r.rooftop_id})
    type_counts: dict[str, int] = {}
    for r in rows:
        for t in (r.bug_types or []):
            type_counts[t] = type_counts.get(t, 0) + 1
    top_bug_type = max(type_counts, key=type_counts.__getitem__) if type_counts else None
    return {
        "total_bugs": len(rows),
        "unique_orgs": unique_orgs,
        "unique_rooftops": unique_rooftops,
        "top_bug_type": top_bug_type,
    }


async def resolve(
    db: AsyncSession,
    bug_id: int,
    is_resolved: bool,
) -> BugReport | None:
    """Set the is_resolved flag on a BugReport; return None if not found."""
    result = await db.execute(select(BugReport).where(BugReport.id == bug_id))
    bug = result.scalar_one_or_none()
    if bug is None:
        return None
    bug.is_resolved = is_resolved
    return bug


async def assign(
    db: AsyncSession,
    bug_id: int,
    user_id: int | None,
) -> BugReport | None:
    """Set or clear the assigned_to field on a BugReport; return None if not found."""
    result = await db.execute(select(BugReport).where(BugReport.id == bug_id))
    bug = result.scalar_one_or_none()
    if bug is None:
        return None
    bug.assigned_to = user_id
    return bug


async def list_assigned_to(
    db: AsyncSession,
    user_id: int,
    is_resolved: bool | None = None,
    organization_name: str | None = None,
    bug_type: str | None = None,
    limit: int = 30,
    offset: int = 0,
) -> list[BugReport]:
    """Return BugReport rows assigned to the given user with optional filters and pagination."""
    query = select(BugReport).where(BugReport.assigned_to == user_id)
    if is_resolved is not None:
        query = query.where(BugReport.is_resolved == is_resolved)
    if organization_name is not None:
        query = query.where(BugReport.organization_name == organization_name)
    if bug_type is not None:
        query = query.where(BugReport.bug_types.contains([bug_type]))
    result = await db.execute(
        query.order_by(BugReport.bug_date.desc(), BugReport.id.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def count_assigned_to(
    db: AsyncSession,
    user_id: int,
    is_resolved: bool | None = None,
    organization_name: str | None = None,
    bug_type: str | None = None,
) -> int:
    """Return count of BugReport rows assigned to the given user matching filters."""
    query = select(func.count(BugReport.id)).where(BugReport.assigned_to == user_id)
    if is_resolved is not None:
        query = query.where(BugReport.is_resolved == is_resolved)
    if organization_name is not None:
        query = query.where(BugReport.organization_name == organization_name)
    if bug_type is not None:
        query = query.where(BugReport.bug_types.contains([bug_type]))
    result = await db.execute(query)
    return result.scalar_one()


async def list_all(
    db: AsyncSession,
    source_env: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[BugReport]:
    """Return BugReport rows ordered by most recent date first."""
    query = select(BugReport)
    if source_env is not None:
        query = query.where(BugReport.source_env == source_env)
    query = query.order_by(BugReport.bug_date.desc(), BugReport.id.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())
