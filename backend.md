# Backend Audit — Flaws & Issues

## 1. Security

### 1.1 Hardcoded default `SECRET_KEY`
**File:** `server/app/core/config.py:14`
```python
SECRET_KEY: str = "insecure-dev-key"
```
If `SECRET_KEY` is missing from `.env`, the app starts with a known key in production. All JWTs become forgeable. Should have no default and fail fast on startup.

### 1.2 Empty default `FERNET_KEY`
**File:** `server/app/core/config.py:15`
```python
FERNET_KEY: str = ""
```
If unset, encryption is silently skipped until first use, then raises a `ValidationError` at runtime mid-request instead of at startup. Should be required with no default.

### 1.3 Cookie `secure=False` hardcoded
**File:** `server/app/api/v1/endpoints/auth.py:44`
```python
secure=False,
```
The `secure` flag is always `False`, meaning the auth cookie is sent over plain HTTP even in production. Should be `secure=settings.ENVIRONMENT != "development"`.

### 1.4 `GET /{call_id}` — wrong auth guard
**File:** `server/app/api/v1/endpoints/calls.py:57`
```python
_: User = Depends(get_current_user),
```
The docstring says "admin+ only" but the actual dependency is `get_current_user` (any authenticated user). Any reviewer can fetch any call by ID. Should be `require_admin`.

### 1.5 Silent decrypt failures expose raw ciphertext
**Files:** `server/app/services/call_sync_service.py:58-59`, `server/app/services/admin_proxy_service.py:79-80`
```python
except Exception:
    decrypted[key] = value  # raw ciphertext sent as auth header
```
If a secret fails to decrypt, the raw Fernet ciphertext is silently used as the Authorization header value. The external service call fails opaquely. Should raise a typed error.

---

## 2. Architecture Violations

### 2.1 `HTTPException` raised directly in a router
**File:** `server/app/api/v1/endpoints/calls.py:62-63`
```python
from fastapi import HTTPException
raise HTTPException(status_code=404, detail="Call not found")
```
This bypasses the registered `NotFoundError` exception handler chain. Should raise `NotFoundError` instead. The import is also inside the function body.

### 2.2 Repository-level query inside a service
**File:** `server/app/services/assignment_service.py:87-95`
`_build_reviewer_load` executes a raw SQLAlchemy `select` + `join` + `group_by` query directly inside `assignment_service`. All DB queries must live in repositories. This belongs in `eval_repo`.

### 2.3 Lazy imports inside route handlers
**Files:**
- `server/app/api/v1/endpoints/evals.py:18` — `from app.repositories import eval_repo`
- `server/app/api/v1/endpoints/admin.py:31,51` — `from app.core.encryption import encrypt_secret`
- `server/app/api/v1/endpoints/admin.py:52` — `from app.exceptions import NotFoundError`

All imports belong at module level.

---

## 3. Logic Bugs

### 3.1 Operator-precedence bug in `_categorize_calls`
**File:** `server/app/services/assignment_service.py:45`
```python
elif call.nps_score is None or call.nps_score > DETRACTOR_NPS_MAX and call.nps_score < PROMOTER_NPS_MIN:
```
`and` binds tighter than `or`, so this reads as:
```python
elif call.nps_score is None or (call.nps_score > 6 and call.nps_score < 9):
```
The intent appears correct but the missing parentheses make it a silent maintenance trap. An `nps_score` of `None` with a completed call is silently categorized as "na" rather than being flagged separately. Should be explicitly parenthesised.

### 3.2 `ConflictError` and `ValidationError` return wrong HTTP status
**File:** `server/app/main.py`
`ConflictError` and `ValidationError` are defined in `exceptions.py` but have no dedicated handlers in `main.py`. They fall through to the generic `AppError` handler which returns `400`. `ConflictError` should be `409`, `ValidationError` could be `422`. E.g., duplicate email on user create returns `400` instead of `409`.

### 3.3 `datetime.utcnow()` deprecated
**Files:** `server/app/core/security.py:27`, `server/app/services/eval_service.py:53`
`datetime.utcnow()` is deprecated since Python 3.12 and will be removed. Replace with `datetime.now(UTC)` (requires `from datetime import UTC`).

### 3.4 Timestamps stored without timezone
**Files:** `server/app/models/base.py:14-23`, `server/app/models/eval.py:51`
All `DateTime` columns use `timezone=False`. Datetimes are stored as bare UTC but have no TZ marker, which makes cross-timezone comparisons ambiguous and breaks assumptions if the DB server's timezone ever changes. Should use `timezone=True` (TIMESTAMPTZ in Postgres).

---

## 4. Duplicated Code (DRY Violations)

### 4.1 Identical secret-decrypt helpers
`call_sync_service._decrypt_env_secrets` and `admin_proxy_service._decrypt_secrets` are the same function copy-pasted. Extract to a shared utility.

### 4.2 Identical header-build helpers
`call_sync_service._build_auth_headers` and `admin_proxy_service._build_headers` are identical. Extract to a shared utility.

---

## 5. Performance Issues

### 5.1 Sequential env sync instead of `asyncio.gather()`
**File:** `server/app/services/call_sync_service.py:19-22`
```python
for env in envs:
    count = await _sync_single_env(db, client, env, call_date)
```
Env syncs are independent; they should run concurrently with `asyncio.gather()`. This is also required by the project's own CLAUDE.md rule.

### 5.2 N+1 `refresh` in `create_bulk`
**File:** `server/app/repositories/eval_repo.py:14-16`
```python
for ev in evals:
    await db.refresh(ev)
```
One round-trip per eval. For large assignment batches this is expensive. A single `RETURNING *` and bulk-fetch or relying on `expire_on_commit=False` is enough.

### 5.3 New `httpx.AsyncClient` per request in proxy service
**File:** `server/app/services/admin_proxy_service.py:20,37,53`
Each proxy function creates and tears down its own `AsyncClient`. Connection pooling is wasted. A single client should be created at app lifespan and injected, or at least shared across the module.

### 5.4 Missing composite indexes
- `raw_calls`: no `(call_date, source_env)` composite index, but nearly every query filters on both.
- `evals`: no `(assigned_to, eval_status)` composite index, but the most frequent query filters on exactly these two columns.

---

## 6. Dead Code / Unused Functions

| Symbol | File | Problem |
|--------|------|---------|
| `get_async_session` | `core/database.py` | Never imported by routes; `dependencies.get_db` is used instead. Two session factories cause confusion. |
| `eval_service.get_next_pending` | `services/eval_service.py:59` | Implemented but no router endpoint calls it. |
| `eval_repo.list_for_team_overview` | `repositories/eval_repo.py:35` | Implemented but never called. |
| `raw_call_repo.get_by_id` | `repositories/raw_call_repo.py:87` | Internal-ID lookup never used; `get_by_lokam_call_id` is used everywhere. |
| `user_repo.soft_delete` | `repositories/user_repo.py:51` | No delete-user endpoint exists. |

---

## 7. Naming Conflicts with Builtins

**File:** `server/app/exceptions.py`
- `PermissionError` shadows Python's built-in `PermissionError`.
- `ValidationError` shadows Pydantic's `ValidationError`.

Any code that catches the built-in will silently catch the app's domain exception or vice versa. Rename to e.g. `AppPermissionError` / `AppValidationError`, or at minimum ensure no code does a bare `except PermissionError`.

---

## 8. Missing Input Validation

### 8.1 No password minimum length
**Files:** `server/app/schemas/auth.py:33`, `server/app/schemas/user.py:12`
`new_password` and `password` fields have no `min_length` constraint. Empty string passwords are accepted, hashed, and stored.

### 8.2 Mutable default in `EnvConfigCreate`
**File:** `server/app/schemas/env_config.py:12`
```python
secrets: dict[str, Any] = {}
```
Pydantic handles this safely, but `{}` as a field default is an anti-pattern. Use `default_factory=dict`.

### 8.3 Unvalidated `mode` string in `SeedRunRequest`
**File:** `server/app/schemas/admin.py:13`
`mode` is a free-form `str` forwarded directly to the downstream service with no enum validation. An invalid mode gets sent silently.

---

## 9. Concurrency / Race Condition

### 9.1 Duplicate eval assignment under concurrent sync
**File:** `server/app/services/assignment_service.py`
`get_unassigned_for_date` uses a subquery to find calls without Evals, then `create_bulk` inserts them. Two concurrent `/sync` calls for the same date will both see the same unassigned calls and create duplicate Evals. There is no unique constraint on `(call_id, assigned_to)` in the `evals` table and no advisory lock around the assignment transaction.

---

## 10. Type Safety

| Location | Issue |
|----------|-------|
| `call_sync_service._sync_single_env` | `env: object` — should be `EnvConfig` |
| `admin_proxy_service._get_env_or_raise` | returns `object` — should return `EnvConfig` |
| `eval_service._compute_has_corrections` | `raw_call: object` — should be `RawCall` |
