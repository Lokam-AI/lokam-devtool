from datetime import date

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_secret
from app.core.http_helpers import build_auth_headers
from app.repositories import env_config_repo, raw_call_repo
from app.schemas.raw_call import RawCallCreate
from app.services import assignment_service

CALLS_EXPORT_PATH = "/api/v1/internal/calls-export"
HTTP_TIMEOUT_SECONDS = 30


async def sync_calls_for_date(db: AsyncSession, call_date: date) -> dict[str, int]:
    """Fetch calls from all active envs for a date, upsert them, and assign to reviewers."""
    envs = await env_config_repo.list_active(db)
    summary: dict[str, int] = {}
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        for env in envs:
            count = await _sync_single_env(db, client, env, call_date)
            summary[env.name] = count
    return summary


async def _sync_single_env(db: AsyncSession, client: httpx.AsyncClient, env: object, call_date: date) -> int:
    """Fetch, upsert, and assign calls for one environment; return count of upserted rows."""
    secrets = _decrypt_env_secrets(env.secrets)
    headers = build_auth_headers(secrets)
    url = f"{env.base_url}{CALLS_EXPORT_PATH}"
    params = {"date": call_date.isoformat()}

    response = await client.get(url, headers=headers, params=params)
    response.raise_for_status()
    payload = response.json()

    calls_data: list[dict] = payload if isinstance(payload, list) else payload.get("calls", [])
    upserted = 0
    for item in calls_data:
        item["source_env"] = env.name
        if "id" in item and "lokam_call_id" not in item:
            item["lokam_call_id"] = item.pop("id")
        schema = RawCallCreate(**item)
        await raw_call_repo.upsert_by_lokam_call_id(db, schema)
        upserted += 1

    await assignment_service.assign_calls_for_date(db, call_date, source_env=env.name)
    return upserted


def _decrypt_env_secrets(secrets: dict) -> dict:
    """Decrypt all string values in the secrets dict using Fernet; raise on failure."""
    return {k: decrypt_secret(v) if isinstance(v, str) else v for k, v in secrets.items()}


