import asyncio
from datetime import date, datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_secret
from app.core.http_helpers import build_auth_headers
from app.repositories import bug_report_repo, env_config_repo

BUGS_EXPORT_PATH = "/api/v1/internal/bugs-export"
HTTP_TIMEOUT_SECONDS = 30


APP_ENV_NAME = "app"


async def sync_bugs_for_date(db: AsyncSession, bug_date: date) -> dict[str, int]:
    """Fetch bug reports from the app env for a date and upsert."""
    env = await env_config_repo.get_by_name(db, APP_ENV_NAME)
    envs = [env] if env is not None else []
    if not envs:
        return {}
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        counts = await asyncio.gather(
            *[_sync_single_env(db, client, env, bug_date) for env in envs]
        )
    return {env.name: count for env, count in zip(envs, counts)}


async def _sync_single_env(
    db: AsyncSession, client: httpx.AsyncClient, env: object, bug_date: date
) -> int:
    """Fetch and upsert bug reports for one environment; return count of upserted rows."""
    secrets = {k: decrypt_secret(v) if isinstance(v, str) else v for k, v in env.secrets.items()}
    headers = build_auth_headers(secrets)
    url = f"{env.base_url}{BUGS_EXPORT_PATH}"
    params = {"date": bug_date.isoformat()}

    response = await client.get(url, headers=headers, params=params)
    response.raise_for_status()
    payload = response.json()

    bugs: list[dict] = payload.get("bugs", []) if isinstance(payload, dict) else payload
    upserted = 0
    for item in bugs:
        external_created_at: datetime | None = None
        if item.get("created_at"):
            try:
                external_created_at = datetime.fromisoformat(
                    item["created_at"].replace("Z", "+00:00")
                ).replace(tzinfo=None)
            except (ValueError, AttributeError):
                pass

        await bug_report_repo.upsert(
            db,
            external_id=int(item["id"]),
            source_env=env.name,
            bug_date=bug_date,
            call_id=item.get("call_id"),
            organization_id=item.get("organization_id"),
            organization_name=item.get("organization_name"),
            rooftop_id=item.get("rooftop_id"),
            rooftop_name=item.get("rooftop_name"),
            bug_types=item.get("bug_types") or [],
            description=item.get("description"),
            submitted_by=item.get("submitted_by"),
            submitted_by_name=item.get("submitted_by_name"),
            external_created_at=external_created_at,
        )
        upserted += 1

    return upserted
