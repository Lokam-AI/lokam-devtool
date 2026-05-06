"""
PostHog Feature Flag Management Service.

Talks directly to the PostHog Management API to list and toggle
feature flags. Uses the personal API key (phx_...) for read/write access.

Read flow:  devtool → PostHog Management API → returns flag states
Write flow: devtool → PostHog Management API → updates rollout_percentage
            → lokamspace Lambda picks up the new value on next run (~2 min)
"""

import httpx

from app.core.config import settings

# Environments that must never be toggled from code.
# Production flags are managed exclusively via the PostHog dashboard.
PROTECTED_ENVS = {"prod", "app", "production"}

# Maps devtool env_name (stored in DB) → PostHog distinct_id (used in flag conditions)
ENV_NAME_TO_POSTHOG_ID: dict[str, str] = {
    "playground": "dev",
    "arena": "qa",
    "app": "prod",
}


def _headers() -> dict:
    """Authorization headers for PostHog Management API."""
    return {
        "Authorization": f"Bearer {settings.POSTHOG_PERSONAL_API_KEY}",
        "Content-Type": "application/json",
    }


def _api_base() -> str:
    return f"{settings.POSTHOG_HOST}/api/projects/{settings.POSTHOG_PROJECT_ID}"


async def list_flags() -> list[dict]:
    """Fetch all feature flags from PostHog for this project."""
    if not settings.POSTHOG_PERSONAL_API_KEY or not settings.POSTHOG_PROJECT_ID:
        raise ValueError("POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID must be configured")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{_api_base()}/feature_flags/", headers=_headers(), params={"limit": 100})
        r.raise_for_status()
    return r.json().get("results", [])


async def toggle_flag(flag_key: str, env_name: str, enabled: bool) -> dict:
    """
    Set a flag's rollout to 100% (enabled) or 0% (disabled) for a given environment.

    env_name: devtool environment name (e.g. "playground", "arena")
    Production environments are blocked — use the PostHog dashboard for prod changes.
    Returns the updated flag object.
    """
    posthog_env = ENV_NAME_TO_POSTHOG_ID.get(env_name, env_name)

    if posthog_env in PROTECTED_ENVS:
        raise ValueError(
            f"Toggling feature flags for '{env_name}' is not permitted from code. "
            "Use the PostHog dashboard for production changes."
        )

    if not settings.POSTHOG_PERSONAL_API_KEY or not settings.POSTHOG_PROJECT_ID:
        raise ValueError("POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID must be configured")

    # Find the flag
    flag = None
    for f in await list_flags():
        if f["key"] == flag_key:
            flag = f
            break
    if flag is None:
        raise ValueError(f"Flag '{flag_key}' not found in PostHog")

    # Find and update the condition group for this environment
    filters = flag.get("filters", {})
    groups = list(filters.get("groups", []))
    idx = _find_condition_index(groups, posthog_env)

    if idx == -1:
        raise ValueError(
            f"No PostHog condition found for env='{posthog_env}' in flag '{flag_key}'. "
            f"Add a condition with distinct_id = '{posthog_env}' in the PostHog dashboard."
        )

    groups[idx] = {**groups[idx], "rollout_percentage": 100 if enabled else 0}

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.patch(
            f"{_api_base()}/feature_flags/{flag['id']}/",
            headers=_headers(),
            json={"filters": {**filters, "groups": groups}},
        )
        r.raise_for_status()
    return r.json()


def extract_flag_states(flag: dict) -> dict[str, bool]:
    """
    Extract per-environment enabled state from a raw PostHog flag object.
    Returns a dict mapping posthog distinct_id → enabled bool.
    e.g. {"dev": True, "qa": False, "prod": True}
    """
    states: dict[str, bool] = {}
    for group in flag.get("filters", {}).get("groups", []):
        for prop in group.get("properties", []):
            if prop.get("key") == "distinct_id":
                for env in prop.get("value") or []:
                    states[env] = group.get("rollout_percentage", 0) == 100
    return states


def _find_condition_index(groups: list, posthog_env: str) -> int:
    """Return the index of the condition group targeting distinct_id == posthog_env, or -1."""
    for i, group in enumerate(groups):
        for prop in group.get("properties", []):
            if prop.get("key") == "distinct_id" and posthog_env in (prop.get("value") or []):
                return i
    return -1
