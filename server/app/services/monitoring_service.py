import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncGenerator

import httpx

from app.core.config import settings
from app.exceptions import DomainValidationError

SERVICES = [
    {"id": "main-backend",              "label": "Main Backend (App Runner)"},
    {"id": "data-ingestion",            "label": "Data Ingestion"},
    {"id": "call-initiator",            "label": "Call Initiator Worker"},
    {"id": "acs-scheduler",             "label": "ACS Scheduler"},
    {"id": "acs-worker",                "label": "ACS Worker"},
    {"id": "issue-escalation",          "label": "Issue Escalation"},
    {"id": "service-advisor-eviction",  "label": "Service Advisor Eviction"},
    {"id": "dnc-export",                "label": "DNC Export"},
    {"id": "reports-sender",            "label": "Reports Sender"},
    {"id": "dms-sync",                  "label": "DMS Sync"},
    {"id": "insights-analyzer",         "label": "Insights Analyzer"},
    {"id": "advisor-insights",          "label": "Advisor Insights"},
    {"id": "playground-refresh",        "label": "Playground Refresh"},
]

LEVEL_ORDER = ["debug", "info", "warning", "error", "critical"]


def _loki_client() -> httpx.AsyncClient:
    if not settings.LOKI_QUERY_URL:
        raise DomainValidationError("Loki credentials not configured")
    return httpx.AsyncClient(
        base_url=settings.LOKI_QUERY_URL,
        auth=(settings.LOKI_USERNAME, settings.LOKI_API_KEY),
        timeout=30,
    )


ENVS = [
    {"id": "prod",       "label": "Production"},
    {"id": "arena",      "label": "Arena (QA)"},
    {"id": "playground", "label": "Playground (Dev)"},
]


def _build_query(services: list[str], levels: list[str], envs: list[str], search: str) -> str:
    label_pairs = []

    if envs:
        label_pairs.append(f'env=~"{"| ".join(envs)}"')
    # no env filter = all envs

    if services:
        label_pairs.append(f'service=~"{"| ".join(services)}"')
    if levels:
        label_pairs.append(f'level=~"{"| ".join(levels)}"')

    stream_selector = "{" + ", ".join(label_pairs) + "}" if label_pairs else "{}"

    if search:
        return f'{stream_selector} |= `{search}`'
    return stream_selector


async def query_logs(
    services: list[str],
    levels: list[str],
    envs: list[str],
    start_ns: int,
    end_ns: int,
    search: str,
    limit: int = 200,
) -> list[dict]:
    logql = _build_query(services, levels, envs, search)

    async with _loki_client() as client:
        resp = await client.get(
            "/loki/api/v1/query_range",
            params={
                "query": logql,
                "start": str(start_ns),
                "end": str(end_ns),
                "limit": limit,
                "direction": "backward",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    entries = []
    for stream in data.get("data", {}).get("result", []):
        labels = stream.get("stream", {})
        for ts_ns, line in stream.get("values", []):
            try:
                body = json.loads(line)
            except (json.JSONDecodeError, TypeError):
                body = {"message": line}
            entries.append({
                "timestamp": int(ts_ns) // 1_000_000,
                "level": labels.get("level", body.get("levelname", "info")).lower(),
                "service": labels.get("service", "unknown"),
                "message": body.get("message", line),
                "raw": body,
            })

    entries.sort(key=lambda e: e["timestamp"], reverse=True)
    return entries


async def stream_logs(
    services: list[str],
    levels: list[str],
    envs: list[str],
) -> AsyncGenerator[str, None]:
    logql = _build_query(services, levels, envs, "")
    seen: set[str] = set()

    while True:
        now_ns = int(datetime.now(timezone.utc).timestamp() * 1e9)
        start_ns = now_ns - int(5e9)  # last 5 seconds

        try:
            async with _loki_client() as client:
                resp = await client.get(
                    "/loki/api/v1/query_range",
                    params={
                        "query": logql,
                        "start": str(start_ns),
                        "end": str(now_ns),
                        "limit": 100,
                        "direction": "forward",
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            for stream in data.get("data", {}).get("result", []):
                labels = stream.get("stream", {})
                for ts_ns, line in stream.get("values", []):
                    key = f"{ts_ns}:{line[:64]}"
                    if key in seen:
                        continue
                    seen.add(key)

                    try:
                        body = json.loads(line)
                    except (json.JSONDecodeError, TypeError):
                        body = {"message": line}

                    entry = {
                        "timestamp": int(ts_ns) // 1_000_000,
                        "level": labels.get("level", body.get("levelname", "info")).lower(),
                        "service": labels.get("service", "unknown"),
                        "message": body.get("message", line),
                        "raw": body,
                    }
                    yield f"data: {json.dumps(entry)}\n\n"

            # Trim seen set to avoid unbounded growth
            if len(seen) > 5000:
                seen.clear()

        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

        await asyncio.sleep(2)
