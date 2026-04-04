from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin, require_superadmin
from app.models.user import User
from app.repositories import env_config_repo
from app.schemas.admin import ACSToggleRequest, ProxyHealthResponse, SeedRunRequest
from app.schemas.env_config import EnvConfigCreate, EnvConfigRead, EnvConfigUpdate
from app.services import admin_proxy_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/envs", response_model=list[EnvConfigRead])
async def list_envs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[EnvConfigRead]:
    """Return all environment configurations; admin+ only."""
    rows = await env_config_repo.list_all(db)
    return [EnvConfigRead.model_validate(r) for r in rows]


@router.post("/envs", response_model=EnvConfigRead, status_code=201)
async def create_env(
    body: EnvConfigCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superadmin),
) -> EnvConfigRead:
    """Create a new environment configuration; superadmin only."""
    from app.core.encryption import encrypt_secret
    encrypted_secrets = {k: encrypt_secret(v) if isinstance(v, str) else v for k, v in body.secrets.items()}
    env = await env_config_repo.create(
        db,
        name=body.name,
        base_url=body.base_url,
        secrets=encrypted_secrets,
        is_active=body.is_active,
    )
    return EnvConfigRead.model_validate(env)


@router.patch("/envs/{env_name}", response_model=EnvConfigRead)
async def update_env(
    env_name: str,
    body: EnvConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superadmin),
) -> EnvConfigRead:
    """Update an environment configuration; superadmin only."""
    from app.core.encryption import encrypt_secret
    from app.exceptions import NotFoundError

    env = await env_config_repo.get_by_name(db, env_name)
    if env is None:
        raise NotFoundError(f"Environment '{env_name}' not found")
    changes = body.model_dump(exclude_none=True)
    if "secrets" in changes:
        changes["secrets"] = {
            k: encrypt_secret(v) if isinstance(v, str) else v
            for k, v in changes["secrets"].items()
        }
    updated = await env_config_repo.update_env(db, env, **changes)
    return EnvConfigRead.model_validate(updated)


@router.post("/envs/{env_name}/acs")
async def toggle_acs(
    env_name: str,
    body: ACSToggleRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    """Proxy an ACS toggle to the target lokamspace environment; admin+ only."""
    return await admin_proxy_service.toggle_acs(db, env_name, enabled=body.enabled)


@router.post("/envs/{env_name}/seed")
async def run_seed(
    env_name: str,
    body: SeedRunRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    """Proxy a seed run to the target lokamspace environment; admin+ only."""
    return await admin_proxy_service.trigger_seed(db, env_name, confirm=body.confirm)


@router.get("/envs/{env_name}/health", response_model=ProxyHealthResponse)
async def env_health(
    env_name: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ProxyHealthResponse:
    """Check the health of the target lokamspace environment; admin+ only."""
    return await admin_proxy_service.check_health(db, env_name)
