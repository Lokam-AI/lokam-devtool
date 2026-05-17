import asyncio
import json
import re
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

# App Runner normalises all Loki stream labels to level="info".
# Filter and parse level from the log line content instead.
# Log format: "2026-05-17 14:58:53,779 - logger.name - LEVEL - message"
_LEVEL_PATTERNS: dict[str, str] = {
    "debug":    "- DEBUG -",
    "info":     "- INFO -",
    "warning":  "- WARNING -",
    "error":    "- ERROR -",
    "critical": "- CRITICAL -",
}


def _parse_level(line: str, fallback: str) -> str:
    """Extract log level from '... - LEVEL - ...' formatted log lines."""
    for lvl in ("CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"):
        if f" - {lvl} - " in line:
            return lvl.lower()
    return fallback


def _extract_message(line: str) -> str:
    """Extract just the message portion from a structured log line."""
    for lvl in ("CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"):
        marker = f" - {lvl} - "
        idx = line.find(marker)
        if idx != -1:
            return line[idx + len(marker):]
    return line


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
    """Build a LogQL query using stream labels for env/service and line filters for level."""
    label_pairs = []
    if envs:
        label_pairs.append(f'env=~"{"|".join(envs)}"')
    if services:
        label_pairs.append(f'service=~"{"|".join(services)}"')

    stream_selector = "{" + ", ".join(label_pairs) + "}" if label_pairs else "{}"

    pipeline_parts = []
    if levels:
        prefixes = [_LEVEL_PATTERNS.get(l, l.upper() + ":") for l in levels]
        if len(prefixes) == 1:
            pipeline_parts.append(f'|= "{prefixes[0]}"')
        else:
            pattern = "|".join(re.escape(p) for p in prefixes)
            pipeline_parts.append(f'|~ "({pattern})"')

    if search:
        pipeline_parts.append(f'|= `{search}`')

    if pipeline_parts:
        return f'{stream_selector} {" ".join(pipeline_parts)}'
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
                message = body.get("message", line)
            except (json.JSONDecodeError, TypeError):
                body = {}
                message = _extract_message(line)
            entries.append({
                "timestamp": int(ts_ns) // 1_000_000,
                "level": _parse_level(line, labels.get("level", "info")),
                "service": labels.get("service", "unknown"),
                "message": message,
                "raw": body,
            })

    entries.sort(key=lambda e: e["timestamp"], reverse=True)
    return entries


async def count_logs(
    envs: list[str],
    hours: int,
) -> int:
    """Return the total log count for the given envs/time window using a Loki metric query."""
    stream_selector = f'{{env=~"{"|".join(envs)}"}}'  if envs else "{}"
    logql = f"sum(count_over_time({stream_selector}[{hours}h]))"

    now_ns = int(datetime.now(timezone.utc).timestamp() * 1e9)

    async with _loki_client() as client:
        resp = await client.get(
            "/loki/api/v1/query",
            params={"query": logql, "time": str(now_ns)},
        )
        resp.raise_for_status()
        data = resp.json()

    result = data.get("data", {}).get("result", [])
    if not result:
        return 0
    return int(float(result[0].get("value", [0, "0"])[1]))


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
                        message = body.get("message", line)
                    except (json.JSONDecodeError, TypeError):
                        body = {}
                        message = _extract_message(line)

                    entry = {
                        "timestamp": int(ts_ns) // 1_000_000,
                        "level": _parse_level(line, labels.get("level", "info")),
                        "service": labels.get("service", "unknown"),
                        "message": message,
                        "raw": body,
                    }
                    yield f"data: {json.dumps(entry)}\n\n"

            # Trim seen set to avoid unbounded growth
            if len(seen) > 5000:
                seen.clear()

        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

        await asyncio.sleep(2)
