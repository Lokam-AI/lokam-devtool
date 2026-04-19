import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import CALL_TARGETS, MAX_CALLS_PER_USER
from app.repositories import system_setting_repo
from app.schemas.assignment_config import AssignmentConfigRead, AssignmentConfigUpdate, CallTargets

SETTING_MAX_CALLS = "max_calls_per_user"
SETTING_CALL_TARGETS = "call_targets"


async def get_config(db: AsyncSession) -> AssignmentConfigRead:
    """Return current assignment config from DB, falling back to code defaults."""
    raw_max = await system_setting_repo.get(db, SETTING_MAX_CALLS)
    raw_targets = await system_setting_repo.get(db, SETTING_CALL_TARGETS)

    max_calls = int(raw_max) if raw_max is not None else MAX_CALLS_PER_USER
    targets = CallTargets(**json.loads(raw_targets)) if raw_targets is not None else CallTargets(**CALL_TARGETS)

    return AssignmentConfigRead(max_calls_per_user=max_calls, call_targets=targets)


async def update_config(db: AsyncSession, patch: AssignmentConfigUpdate) -> AssignmentConfigRead:
    """Persist changes to assignment config and return updated config."""
    if patch.max_calls_per_user is not None:
        await system_setting_repo.set(db, SETTING_MAX_CALLS, str(patch.max_calls_per_user))
    if patch.call_targets is not None:
        await system_setting_repo.set(db, SETTING_CALL_TARGETS, json.dumps(patch.call_targets.model_dump()))
    return await get_config(db)
