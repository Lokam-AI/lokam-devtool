import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_secret
from app.core.http_helpers import build_auth_headers
from app.exceptions import NotFoundError
from app.repositories import env_config_repo
from app.schemas.admin import ProxyHealthResponse

ACS_PATH = "/api/v1/internal/acs/toggle"
SEED_PATH = "/api/v1/internal/seed/run"
HEALTH_PATH = "/api/v1/internal/health"
HTTP_TIMEOUT_SECONDS = 120


async def toggle_acs(db: AsyncSession, env_name: str, *, enabled: bool) -> dict:
    """Proxy an ACS toggle request to the target lokamspace environment."""
    env = await _get_env_or_raise(db, env_name)
    secrets = _decrypt_secrets(env.secrets)
    headers = build_auth_headers(secrets)
    url = f"{env.base_url}{ACS_PATH}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        response = await client.post(url, headers=headers, json={"enabled": enabled})
        response.raise_for_status()
        return response.json()


async def trigger_seed(
    db: AsyncSession,
    env_name: str,
    *,
    mode: str,
    organization_name: str,
    rooftop_names: list[str],
) -> dict:
    """Proxy a seed-run trigger to the target lokamspace environment."""
    env = await _get_env_or_raise(db, env_name)
    secrets = _decrypt_secrets(env.secrets)
    headers = build_auth_headers(secrets)
    url = f"{env.base_url}{SEED_PATH}"
    payload = {"mode": mode, "organization_name": organization_name, "rooftop_names": rooftop_names}
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()


async def check_health(db: AsyncSession, env_name: str) -> ProxyHealthResponse:
    """Return the health status of the target lokamspace environment."""
    env = await _get_env_or_raise(db, env_name)
    secrets = _decrypt_secrets(env.secrets)
    headers = build_auth_headers(secrets)
    url = f"{env.base_url}{HEALTH_PATH}"
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
            response = await client.get(url, headers=headers)
            status = "healthy" if response.is_success else "degraded"
            detail = None if response.is_success else response.text
    except httpx.RequestError as exc:
        status = "unreachable"
        detail = str(exc)
    return ProxyHealthResponse(env_name=env_name, status=status, detail=detail)


async def _get_env_or_raise(db: AsyncSession, env_name: str) -> object:
    """Return the EnvConfig for env_name or raise NotFoundError."""
    env = await env_config_repo.get_by_name(db, env_name)
    if env is None:
        raise NotFoundError(f"Environment '{env_name}' not found")
    return env


def _decrypt_secrets(secrets: dict) -> dict:
    """Decrypt all string values in the secrets dict; raise on failure."""
    result: dict = {}
    for key, value in secrets.items():
        result[key] = decrypt_secret(value) if isinstance(value, str) else value
    return result


