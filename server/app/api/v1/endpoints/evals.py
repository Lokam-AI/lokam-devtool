from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.eval import EvalRead, EvalUpdate
from app.services import eval_service

router = APIRouter(prefix="/evals", tags=["evals"])


@router.get("/my", response_model=list[EvalRead])
async def my_evals(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[EvalRead]:
    """Return evals assigned to the current reviewer with optional pagination."""
    from app.repositories import eval_repo
    rows = await eval_repo.list_for_reviewer(db, current_user.id, limit=limit, offset=offset)
    return [EvalRead.model_validate(r) for r in rows]


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
