from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin, require_reviewer, require_superadmin
from app.exceptions import ConflictError, NotFoundError
from app.models.user import User
from app.repositories import super_config_repo
from app.schemas.super_config import SuperConfigCreate, SuperConfigRead, SuperConfigUpdate

router = APIRouter(prefix="/super-configs", tags=["super-configs"])


@router.get("", response_model=list[SuperConfigRead])
async def list_super_configs(
    category: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> list[SuperConfigRead]:
    """Return super_config options for a category; active-only for reviewers, all for admins."""
    active_only = current_user.role == "reviewer"
    rows = await super_config_repo.list_by_category(db, category, active_only=active_only)
    return [SuperConfigRead.model_validate(r) for r in rows]


@router.post("", response_model=SuperConfigRead, status_code=201)
async def create_super_config(
    body: SuperConfigCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superadmin),
) -> SuperConfigRead:
    """Create a new super_config option; superadmin only."""
    try:
        row = await super_config_repo.create(db, body)
    except Exception as exc:
        if "uq_super_configs_category_name" in str(exc):
            raise ConflictError(f"A config named '{body.name}' already exists in category '{body.category}'")
        raise
    return SuperConfigRead.model_validate(row)


@router.patch("/{config_id}", response_model=SuperConfigRead)
async def update_super_config(
    config_id: int,
    body: SuperConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superadmin),
) -> SuperConfigRead:
    """Update a super_config option by id; superadmin only."""
    row = await super_config_repo.update(db, config_id, body)
    if row is None:
        raise NotFoundError(f"SuperConfig {config_id} not found")
    return SuperConfigRead.model_validate(row)
