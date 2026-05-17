import time
from collections import defaultdict

import httpx

from app.core.config import settings
from app.exceptions import DomainValidationError

METRICS_URLS: dict[str, str] = {
    "prod":       "https://api.app.lokam.ai/metrics",
    "arena":      "https://api.arena.lokam.ai/metrics",
    "playground": "https://api.playground.lokam.ai/metrics",
}


def _parse_prometheus(text: str) -> dict[str, list[tuple[dict[str, str], float]]]:
    """Parse Prometheus text format into {metric_name: [(labels, value), ...]}."""
    result: dict[str, list[tuple[dict[str, str], float]]] = defaultdict(list)
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            name_part, value_str = line.rsplit(" ", 1)
            value = float(value_str)
            if "{" in name_part:
                name, rest = name_part.split("{", 1)
                label_str = rest.rstrip("}")
                labels: dict[str, str] = {}
                for kv in label_str.split(","):
                    k, _, v = kv.partition("=")
                    labels[k.strip()] = v.strip().strip('"')
            else:
                name, labels = name_part, {}
            result[name.strip()].append((labels, value))
        except (ValueError, IndexError):
            continue
    return dict(result)


def _aggregate_histogram(
    entries: list[tuple[dict[str, str], float]],
) -> list[tuple[float, float]]:
    """
    Aggregate per-handler bucket entries into a single (le, cumulative_count) list.
    Entries with the same le are summed across all handlers.
    +Inf is excluded — use the _count metric as the true total.
    """
    by_le: dict[float, float] = defaultdict(float)
    for labels, value in entries:
        le_str = labels.get("le", "")
        if le_str == "+Inf":
            continue
        try:
            by_le[float(le_str)] += value
        except ValueError:
            continue
    return sorted(by_le.items())


def _estimated_finite_sum(sorted_buckets: list[tuple[float, float]]) -> float:
    """Estimate the total time (seconds) for requests captured in finite buckets using midpoints."""
    total = 0.0
    prev_le, prev_count = 0.0, 0.0
    for le, count in sorted_buckets:
        interval_count = count - prev_count
        if interval_count > 0:
            midpoint = (prev_le + le) / 2
            total += interval_count * midpoint
        prev_le, prev_count = le, count
    return total


def _percentile_ms(
    sorted_buckets: list[tuple[float, float]],
    total: float,
    pct: float,
    total_sum_s: float = 0.0,
) -> float:
    """
    Estimate a percentile (ms) from sorted (le_seconds, cumulative_count) pairs.
    When the target falls in the overflow bucket (beyond last finite le), uses
    total_sum_s to compute the mean of overflow requests as the estimate.
    """
    if not sorted_buckets or total == 0:
        return 0.0
    target = total * pct
    prev_count = 0.0
    prev_le = 0.0
    for le, count in sorted_buckets:
        if count >= target:
            if count == prev_count:
                return le * 1000
            frac = (target - prev_count) / (count - prev_count)
            return (prev_le + frac * (le - prev_le)) * 1000
        prev_count, prev_le = count, le

    # Target overflows finite buckets — estimate overflow mean from _sum
    overflow_count = total - prev_count
    if total_sum_s > 0 and overflow_count > 0:
        finite_sum = _estimated_finite_sum(sorted_buckets)
        overflow_sum = max(total_sum_s - finite_sum, prev_le * overflow_count)
        return round(overflow_sum / overflow_count * 1000)
    return prev_le * 1000


async def fetch_app_metrics(env: str) -> dict:
    """Fetch and parse Prometheus metrics from the given lokamspace environment."""
    if not settings.METRICS_BACKEND_TOKEN:
        raise DomainValidationError("METRICS_BACKEND_TOKEN not configured")
    url = METRICS_URLS.get(env)
    if not url:
        raise DomainValidationError(f"Unknown env: {env}")

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            url,
            headers={"Authorization": f"Bearer {settings.METRICS_BACKEND_TOKEN}"},
        )
        resp.raise_for_status()

    parsed = _parse_prometheus(resp.text)

    # Total requests and error rate from http_requests_total
    request_entries = parsed.get("http_requests_total", [])
    total_requests = sum(v for _, v in request_entries)
    error_requests = sum(v for l, v in request_entries if l.get("status", "").startswith("5"))
    error_rate = round(error_requests / total_requests * 100, 2) if total_requests else 0.0

    # Request rate = total / uptime
    uptime_entries = parsed.get("process_start_time_seconds", [])
    if uptime_entries:
        uptime_s = max(time.time() - uptime_entries[0][1], 1)
        request_rate = round(total_requests / uptime_s, 2)
    else:
        request_rate = 0.0

    # Global latency percentiles
    bucket_entries = parsed.get("http_request_duration_seconds_bucket", [])
    count_entries  = parsed.get("http_request_duration_seconds_count", [])
    sum_entries    = parsed.get("http_request_duration_seconds_sum", [])
    hist_total     = sum(v for _, v in count_entries) if count_entries else total_requests
    hist_sum_s     = sum(v for _, v in sum_entries)

    global_buckets = _aggregate_histogram(bucket_entries)
    p50 = round(_percentile_ms(global_buckets, hist_total, 0.50, hist_sum_s))
    p99 = round(_percentile_ms(global_buckets, hist_total, 0.99, hist_sum_s))

    # Active requests
    active = int(sum(v for _, v in parsed.get("http_requests_in_progress", [])))

    # Slowest routes: p99 per handler
    handler_counts: dict[str, float] = {l.get("handler", ""): v for l, v in count_entries}
    handler_sums:   dict[str, float] = {l.get("handler", ""): v for l, v in sum_entries}

    by_handler: dict[str, list[tuple[dict[str, str], float]]] = defaultdict(list)
    for labels, value in bucket_entries:
        by_handler[labels.get("handler", "unknown")].append((labels, value))

    slowest = []
    for handler, entries in by_handler.items():
        htotal = handler_counts.get(handler, 0)
        if htotal == 0:
            continue
        hsum = handler_sums.get(handler, 0.0)
        h_buckets = _aggregate_histogram(entries)
        p99_h = round(_percentile_ms(h_buckets, htotal, 0.99, hsum))
        slowest.append({"route": handler, "p99_ms": p99_h})

    slowest.sort(key=lambda x: x["p99_ms"], reverse=True)

    return {
        "request_rate_per_second": request_rate,
        "error_rate_percent": error_rate,
        "p50_latency_ms": p50,
        "p99_latency_ms": p99,
        "active_requests": active,
        "top_slowest_routes": slowest[:5],
    }
