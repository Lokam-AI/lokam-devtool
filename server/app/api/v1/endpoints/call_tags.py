from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_reviewer
from app.exceptions import NotFoundError
from app.models.eval import Eval
from app.models.raw_call import RawCall
from app.models.user import User
from app.repositories import raw_call_repo, super_config_repo
from app.schemas.raw_call import QualityTagUpdate, RawCallRead
from app.schemas.super_config import SuperConfigRead

router = APIRouter(prefix="/calls", tags=["call-tags"])

VALID_QUALITY_TAGS = ("AGENT_HANDLED_WELL", "AGENT_FAILED")


class BugTypeIdsUpdate(BaseModel):
    """Payload for replacing the bug_type_ids list on an eval."""

    bug_type_ids: list[int]


class BugTypeWithName(BaseModel):
    """A resolved bug type id + name pair."""

    id: int
    name: str
    display_name: str | None = None
    is_active: bool


async def _get_eval_for_call(db: AsyncSession, call_id: int) -> Eval:
    """Return the most recent eval for the given call_id or raise NotFoundError."""
    result = await db.execute(
        select(Eval)
        .where(Eval.call_id == call_id)
        .order_by(Eval.id.desc())
        .limit(1)
    )
    ev = result.scalar_one_or_none()
    if ev is None:
        raise NotFoundError(f"No eval found for call {call_id}")
    return ev


@router.get("/{call_id}/bug-type-ids", response_model=list[BugTypeWithName])
async def get_bug_type_ids(
    call_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> list[BugTypeWithName]:
    """Return the resolved bug types tagged on a call's eval."""
    ev = await _get_eval_for_call(db, call_id)
    ids: list[int] = ev.bug_type_ids or []
    configs = await super_config_repo.get_by_ids(db, ids)
    config_map = {c.id: c for c in configs}
    return [
        BugTypeWithName(
            id=cid,
            name=config_map[cid].name if cid in config_map else f"[deleted:{cid}]",
            display_name=config_map[cid].display_name if cid in config_map else None,
            is_active=config_map[cid].is_active if cid in config_map else False,
        )
        for cid in ids
    ]


@router.patch("/{call_id}/bug-type-ids")
async def update_bug_type_ids(
    call_id: int,
    body: BugTypeIdsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> dict:
    """Replace the bug_type_ids list on the call's eval."""
    ev = await _get_eval_for_call(db, call_id)
    ev.bug_type_ids = body.bug_type_ids
    await db.flush()
    return {"call_id": call_id, "bug_type_ids": ev.bug_type_ids}


@router.patch("/{call_id}/quality-tag", response_model=RawCallRead)
async def set_quality_tag(
    call_id: int,
    body: QualityTagUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> RawCallRead:
    """Set or clear the quality tag on a call and sync is_bookmarked accordingly."""
    if body.quality_tag is not None and body.quality_tag not in VALID_QUALITY_TAGS:
        raise NotFoundError(f"Invalid quality_tag. Must be one of {VALID_QUALITY_TAGS}")
    row = await raw_call_repo.get_by_lokam_call_id(db, call_id)
    if row is None:
        raise NotFoundError(f"Call {call_id} not found")
    row.quality_tag = body.quality_tag
    row.quality_tag_notes = body.quality_tag_notes
    row.is_bookmarked = body.quality_tag is not None
    await db.flush()
    await db.refresh(row)
    return RawCallRead.model_validate(row)
