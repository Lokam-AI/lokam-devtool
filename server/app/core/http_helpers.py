"""Shared helpers for outbound HTTP calls to lokamspace environments."""


def build_auth_headers(secrets: dict) -> dict[str, str]:
    """Build HTTP auth headers from a decrypted secrets dict."""
    headers: dict[str, str] = {}
    if "bearer_token" in secrets:
        headers["Authorization"] = f"Bearer {secrets['bearer_token']}"
    elif "api_key" in secrets:
        headers["Authorization"] = f"Bearer {secrets['api_key']}"
    return headers
