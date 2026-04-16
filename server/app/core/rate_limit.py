"""Simple in-process sliding-window rate limiter for login attempts."""

import time
from collections import defaultdict, deque

from fastapi import Request

from app.exceptions import AppError

MAX_ATTEMPTS = 10
WINDOW_SECONDS = 60

_buckets: dict[str, deque[float]] = defaultdict(deque)


class RateLimitError(AppError):
    """Raised when a client exceeds the allowed request rate."""


def _client_ip(request: Request) -> str:
    """Return the best-effort client IP from the request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_login_rate(request: Request) -> None:
    """Raise RateLimitError if the client IP has exceeded MAX_ATTEMPTS in the last WINDOW_SECONDS."""
    ip = _client_ip(request)
    now = time.monotonic()
    bucket = _buckets[ip]

    # Evict timestamps outside the sliding window
    while bucket and bucket[0] < now - WINDOW_SECONDS:
        bucket.popleft()

    if len(bucket) >= MAX_ATTEMPTS:
        raise RateLimitError(
            f"Too many login attempts. Try again in {WINDOW_SECONDS} seconds."
        )

    bucket.append(now)
