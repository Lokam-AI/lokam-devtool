from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.repositories import eval_repo
from app.schemas.call_with_eval import CallWithEvalRead
from app.schemas.eval import EvalRead, EvalUpdate
from app.schemas.raw_call import RawCallRead
from app.services import eval_service

router = APIRouter(prefix="/evals", tags=["evals"])

PAGE_SIZE = 30


@router.get("/my", response_model=list[EvalRead])
async def my_evals(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    call_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[EvalRead]:
    """Return evals assigned to the current reviewer with optional pagination and call filter."""
    rows = await eval_repo.list_for_reviewer(db, current_user.id, call_id=call_id, limit=limit, offset=offset)
    return [EvalRead.model_validate(r) for r in rows]


@router.get("/my/calls", response_model=list[CallWithEvalRead])
async def my_calls(
    eval_status: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    search: str | None = Query(default=None),
    organization_name: str | None = Query(default=None),
    nps_filter: str | None = Query(default=None),
    post_call_sms: str | None = Query(default=None),
    sort_by: str = Query(default="date"),
    sort_dir: str = Query(default="desc"),
    limit: int = Query(default=PAGE_SIZE, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CallWithEvalRead]:
    """Return paginated call+eval pairs for the current reviewer with optional filters."""
    pairs = await eval_repo.list_calls_for_reviewer(
        db, current_user.id, eval_status, date_from, date_to,
        search, organization_name, nps_filter, post_call_sms, sort_by, sort_dir, limit, offset,
    )
    return [
        CallWithEvalRead(call=RawCallRead.model_validate(raw), eval=EvalRead.model_validate(ev))
        for ev, raw in pairs
    ]


@router.get("/my/calls/count")
async def my_calls_count(
    eval_status: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    search: str | None = Query(default=None),
    organization_name: str | None = Query(default=None),
    nps_filter: str | None = Query(default=None),
    post_call_sms: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    """Return count of call+eval pairs for the current reviewer matching filters."""
    total = await eval_repo.count_calls_for_reviewer(
        db, current_user.id, eval_status, date_from, date_to, search, organization_name, nps_filter, post_call_sms,
    )
    return {"count": total}


@router.get("/my/calls/stats")
async def my_calls_stats(
    eval_status: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    search: str | None = Query(default=None),
    organization_name: str | None = Query(default=None),
    nps_filter: str | None = Query(default=None),
    post_call_sms: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return avg_duration_sec for call+eval pairs assigned to the current reviewer matching filters."""
    return await eval_repo.stats_calls_for_reviewer(
        db, current_user.id, eval_status, date_from, date_to, search, organization_name, nps_filter, post_call_sms,
    )


@router.get("/{eval_id}", response_model=EvalRead)
async def get_eval(
    eval_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EvalRead:
    """Return a single eval form with raw call context; reviewers may only access their own."""
    return await eval_service.get_eval_form(
        db,
        eval_id,
        requesting_user_id=current_user.id,
        requesting_role=current_user.role,
    )


@router.patch("/{eval_id}", response_model=EvalRead)
async def submit_eval(
    eval_id: int,
    body: EvalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EvalRead:
    """Submit ground-truth corrections for an eval; marks it completed."""
    return await eval_service.submit_eval(
        db,
        eval_id,
        body,
        requesting_user_id=current_user.id,
        requesting_role=current_user.role,
    )
