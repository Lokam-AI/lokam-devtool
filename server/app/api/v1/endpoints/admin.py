from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.dependencies import get_db, require_admin, require_reviewer, require_superadmin
from app.models.user import User
from app.repositories import env_config_repo
from app.schemas.admin import ACSToggleRequest, FeatureFlagItem, FeatureFlagEnvState, FeatureFlagToggleRequest, ProxyHealthResponse, SeedRunRequest, SyncRequest, SyncResponse
from app.schemas.env_config import EnvConfigCreate, EnvConfigRead, EnvConfigUpdate
from app.services import admin_proxy_service
from app.services import posthog_service
from app.services.bug_sync_service import sync_bugs_for_date
from app.services.call_sync_service import sync_calls_for_date

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/envs", response_model=list[EnvConfigRead])
async def list_envs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> list[EnvConfigRead]:
    """Return all environment configurations; reviewer+ only."""
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
    return await admin_proxy_service.trigger_seed(
        db,
        env_name,
        mode=body.mode,
        organization_name=body.organization_name,
        rooftop_names=body.rooftop_names,
    )


@router.post("/sync", response_model=SyncResponse)
async def run_sync(
    body: SyncRequest,
    _: User = Depends(require_superadmin),
) -> SyncResponse:
    """Trigger call and bug sync for a given date; superadmin only."""
    async with AsyncSessionLocal() as call_session:
        calls = await sync_calls_for_date(call_session, body.date)
        await call_session.commit()
    async with AsyncSessionLocal() as bug_session:
        bugs = await sync_bugs_for_date(bug_session, body.date)
        await bug_session.commit()
    return SyncResponse(date=body.date, calls=calls, bugs=bugs)


@router.get("/envs/{env_name}/health", response_model=ProxyHealthResponse)
async def env_health(
    env_name: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ProxyHealthResponse:
    """Check the health of the target lokamspace environment; admin+ only."""
    return await admin_proxy_service.check_health(db, env_name)


@router.get("/feature-flags", response_model=list[FeatureFlagItem])
async def list_feature_flags(
    _: User = Depends(require_admin),
) -> list[FeatureFlagItem]:
    """List all PostHog feature flags with per-environment state; admin+ only."""
    try:
        flags = await posthog_service.list_flags()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"PostHog API error: {e}")

    result = []
    posthog_to_env = {v: k for k, v in posthog_service.ENV_NAME_TO_POSTHOG_ID.items()}
    for flag in flags:
        states = posthog_service.extract_flag_states(flag)
        environments = [
            FeatureFlagEnvState(env=posthog_to_env.get(posthog_id, posthog_id), enabled=enabled)
            for posthog_id, enabled in states.items()
            if posthog_id not in posthog_service.PROTECTED_ENVS  # never expose prod
        ]
        result.append(FeatureFlagItem(
            key=flag["key"],
            name=flag.get("name") or flag["key"],
            environments=environments,
        ))
    return result


@router.post("/feature-flags/{flag_key}/toggle", response_model=FeatureFlagItem)
async def toggle_feature_flag(
    flag_key: str,
    body: FeatureFlagToggleRequest,
    _: User = Depends(require_admin),
) -> FeatureFlagItem:
    """Toggle a PostHog feature flag for a specific environment; admin+ only. Prod is blocked."""
    try:
        updated = await posthog_service.toggle_flag(flag_key, body.env, body.enabled)
    except ValueError as e:
        raise HTTPException(status_code=403 if "not permitted" in str(e) else 503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"PostHog API error: {e}")

    states = posthog_service.extract_flag_states(updated)
    posthog_to_env = {v: k for k, v in posthog_service.ENV_NAME_TO_POSTHOG_ID.items()}
    environments = [
        FeatureFlagEnvState(env=posthog_to_env.get(posthog_id, posthog_id), enabled=enabled)
        for posthog_id, enabled in states.items()
        if posthog_id not in posthog_service.PROTECTED_ENVS  # never expose prod
    ]
    return FeatureFlagItem(
        key=updated["key"],
        name=updated.get("name") or updated["key"],
        environments=environments,
    )
