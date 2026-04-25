import asyncio
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


APP_ENV_NAME = "app"


async def sync_calls_for_date(db: AsyncSession, call_date: date) -> dict[str, int]:
    """Fetch calls from the app env for a date, upsert, and assign."""
    env = await env_config_repo.get_by_name(db, APP_ENV_NAME)
    envs = [env] if env is not None else []
    if not envs:
        return {}
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        counts = await asyncio.gather(
            *[_sync_single_env(db, client, env, call_date) for env in envs]
        )
    return {env.name: count for env, count in zip(envs, counts)}


async def _sync_single_env(db: AsyncSession, client: httpx.AsyncClient, env: object, call_date: date) -> int:
    """Fetch, upsert, and assign calls for one environment; return count of upserted rows."""
    secrets = _decrypt_env_secrets(env.secrets)
    headers = build_auth_headers(secrets)
    url = f"{env.base_url}{CALLS_EXPORT_PATH}"
    params = {"date": call_date.isoformat()}

    response = await client.get(url, headers=headers, params=params)
    response.raise_for_status()
    payload = response.json()

    SUPPORTED_LEAD_TYPE = "SERVICE_POST_RO"

    calls_data: list[dict] = payload if isinstance(payload, list) else payload.get("calls", [])
    upserted = 0
    for item in calls_data:
        if item.get("lead_type") != SUPPORTED_LEAD_TYPE:
            continue
        item["source_env"] = env.name
        if "id" in item and "lokam_call_id" not in item:
            item["lokam_call_id"] = item.pop("id")
        metadata = item.get("call_metadata") or {}
        if "escalation_needed" not in item:
            item["escalation_needed"] = metadata.get("escalation_needed")
        schema = RawCallCreate(**item)
        if _is_post_call_sms(schema.overall_feedback):
            continue
        await raw_call_repo.upsert_by_lokam_call_id(db, schema)
        upserted += 1

    await assignment_service.assign_calls_for_date(db, call_date, source_env=env.name)
    return upserted


POST_CALL_SMS_MARKER = "post-call sms"


def _is_post_call_sms(overall_feedback: str | None) -> bool:
    """Return True if overall_feedback indicates a post-call SMS interaction."""
    return bool(overall_feedback and POST_CALL_SMS_MARKER in overall_feedback.lower())


def _decrypt_env_secrets(secrets: dict) -> dict:
    """Decrypt all string values in the secrets dict using Fernet; raise on failure."""
    return {k: decrypt_secret(v) if isinstance(v, str) else v for k, v in secrets.items()}


