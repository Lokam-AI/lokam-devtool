import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_secret
from app.exceptions import NotFoundError
from app.repositories import env_config_repo
from app.schemas.admin import ProxyHealthResponse

ACS_PATH = "/admin/acs-toggle"
SEED_PATH = "/admin/seed"
HEALTH_PATH = "/health"
HTTP_TIMEOUT_SECONDS = 30


async def toggle_acs(db: AsyncSession, env_name: str, *, enabled: bool) -> dict:
    """Proxy an ACS toggle request to the target lokamspace environment."""
    env = await _get_env_or_raise(db, env_name)
    secrets = _decrypt_secrets(env.secrets)
    headers = _build_headers(secrets)
    url = f"{env.base_url}{ACS_PATH}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        response = await client.post(url, headers=headers, json={"enabled": enabled})
        response.raise_for_status()
        return response.json()


async def trigger_seed(db: AsyncSession, env_name: str, *, confirm: bool) -> dict:
    """Proxy a seed-run trigger to the target lokamspace environment."""
    env = await _get_env_or_raise(db, env_name)
    secrets = _decrypt_secrets(env.secrets)
    headers = _build_headers(secrets)
    url = f"{env.base_url}{SEED_PATH}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        response = await client.post(url, headers=headers, json={"confirm": confirm})
        response.raise_for_status()
        return response.json()


async def check_health(db: AsyncSession, env_name: str) -> ProxyHealthResponse:
    """Return the health status of the target lokamspace environment."""
    env = await _get_env_or_raise(db, env_name)
    secrets = _decrypt_secrets(env.secrets)
    headers = _build_headers(secrets)
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
    """Decrypt all string values in the secrets dict."""
    result: dict = {}
    for key, value in secrets.items():
        if isinstance(value, str):
            try:
                result[key] = decrypt_secret(value)
            except Exception:
                result[key] = value
        else:
            result[key] = value
    return result


def _build_headers(secrets: dict) -> dict[str, str]:
    """Build HTTP auth headers from decrypted secrets."""
    headers: dict[str, str] = {}
    if "api_key" in secrets:
        headers["X-API-Key"] = secrets["api_key"]
    if "bearer_token" in secrets:
        headers["Authorization"] = f"Bearer {secrets['bearer_token']}"
    return headers
