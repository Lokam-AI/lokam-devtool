# Lokam DevTool — Backend Execution Tracker

## DONE
- DB models: `User`, `RawCall`, `Eval`, `EnvConfig` (SQLAlchemy 2.x async)
- Pydantic v2 schemas: Create / Update / Read for all 4 models + `auth.py`, `admin.py`
- Alembic: `alembic.ini`, `env.py`, initial migration applied
- Core config (`pydantic-settings`), async DB engine, `AppError` hierarchy
- `setup_local_db.sh` for local DB lifecycle
- **Phase 1**: `security.py` (JWT/bcrypt), `encryption.py` (Fernet), `dependencies.py`, `main.py` (FastAPI + CORS + error handlers), `api/v1/router.py`
- **Phase 2**: Repository layer — `user_repo`, `raw_call_repo`, `eval_repo`, `env_config_repo`
- **Phase 3**: Service layer — `auth_service`, `user_service`, `assignment_service` (round-robin), `call_sync_service`, `eval_service`, `admin_proxy_service`
- **Phase 4**: API endpoints — `auth`, `users`, `calls`, `evals`, `admin`, `health`
- **Phase 5**: `app/cli.py` — `create-superadmin` + seeds 3 default env configs
- **Phase 7**: 41 passing tests (models + schemas + services + API endpoints)

---

## PLAN

### Phase 1 — App Foundation
*FastAPI entry point, JWT/bcrypt/Fernet, dependency injection, global error handlers*

| # | File | What it does |
|---|------|-------------|
| 1.1 | `server/app/core/security.py` | `hash_password`, `verify_password` (bcrypt); `create_access_token`, `decode_access_token` (JWT HS256, httpOnly cookie) |
| 1.2 | `server/app/core/encryption.py` | `encrypt_secret`, `decrypt_secret` (Fernet) for `env_configs.secrets` |
| 1.3 | `server/app/dependencies.py` | `get_db`, `get_current_user`, `require_admin`, `require_superadmin` FastAPI Depends |
| 1.4 | `server/app/main.py` | FastAPI app, lifespan, CORS, mount `/api/v1` router, register error handlers for `AppError` subclasses |
| 1.5 | `server/app/api/v1/router.py` | Assembles all endpoint routers under `/api/v1` |

---

### Phase 2 — Repository Layer
*All DB queries live here. Services call repos, never the session directly.*

| # | File | Key methods |
|---|------|-------------|
| 2.1 | `server/app/repositories/user_repo.py` | `get_by_id`, `get_by_email`, `list_active_reviewers`, `create`, `update`, `soft_delete` |
| 2.2 | `server/app/repositories/raw_call_repo.py` | `upsert_by_lokam_call_id`, `list_by_date`, `get_unassigned_for_date` |
| 2.3 | `server/app/repositories/eval_repo.py` | `create_bulk`, `get_by_id`, `list_for_reviewer`, `list_for_team_overview`, `update` |
| 2.4 | `server/app/repositories/env_config_repo.py` | `get_by_name`, `list_active`, `create`, `update` |

---

### Phase 3 — Service Layer
*Business logic only. No HTTP concerns. Raises `AppError` subclasses.*

| # | File | Responsibilities |
|---|------|-----------------|
| 3.1 | `server/app/services/auth_service.py` | `login` (verify creds → JWT), `change_password` (verify old, hash new, clear `must_change_password`) |
| 3.2 | `server/app/services/user_service.py` | `create_user` (hash pw, enforce role rules), `update_user`, `list_users` |
| 3.3 | `server/app/services/assignment_service.py` | Round-robin: distribute unassigned calls evenly across active reviewers, cap at `MAX_CALLS_PER_REVIEWER` (default 20), create `Eval` records |
| 3.4 | `server/app/services/call_sync_service.py` | For each active `env_config`: GET lokamspace `/calls-export?date=`, upsert into `raw_calls`, call `assignment_service` |
| 3.5 | `server/app/services/eval_service.py` | `get_eval_form` (with raw_call context), `submit_eval` (compute `has_corrections`, set `completed_at`), `get_next_pending` |
| 3.6 | `server/app/services/admin_proxy_service.py` | Decrypt secrets, proxy ACS toggle / seed run / health check to target lokamspace env |

---

### Phase 4 — API Endpoints
*Routers only. No business logic. Always use `response_model`. Inject via `Depends`.*

| # | File | Routes |
|---|------|--------|
| 4.1 | `server/app/api/v1/endpoints/auth.py` | `POST /auth/login`, `POST /auth/logout`, `POST /auth/change-password` |
| 4.2 | `server/app/api/v1/endpoints/users.py` | `GET /users`, `POST /users`, `GET /users/{id}`, `PATCH /users/{id}` — admin+ only |
| 4.3 | `server/app/api/v1/endpoints/calls.py` | `GET /calls` (filter by date/env), `POST /calls/sync` (manual trigger) — admin+ only |
| 4.4 | `server/app/api/v1/endpoints/evals.py` | `GET /evals/my` (reviewer's pending), `GET /evals/{id}`, `PATCH /evals/{id}` (submit) |
| 4.5 | `server/app/api/v1/endpoints/admin.py` | `GET/POST/PATCH /admin/envs` (env config CRUD), `POST /admin/envs/{name}/acs`, `POST /admin/envs/{name}/seed`, `GET /admin/envs/{name}/health` |
| 4.6 | `server/app/api/v1/endpoints/health.py` | `GET /health` — unauthenticated liveness check |

---

### Phase 5 — CLI & Seed
| # | File | Purpose |
|---|------|---------|
| 5.1 | `server/app/cli.py` | `python -m app.cli create-superadmin --email --name` — bootstraps first superadmin; also seeds 3 default `env_configs` (dev/staging/prod) |

---

### Phase 6 — Schemas (additions)
*New schemas needed for auth and admin proxy responses (not covered by existing CRUD schemas)*

| # | File | Schemas |
|---|------|---------|
| 6.1 | `server/app/schemas/auth.py` | `LoginRequest`, `TokenResponse`, `ChangePasswordRequest` |
| 6.2 | `server/app/schemas/admin.py` | `ACSToggleRequest`, `SeedRunRequest`, `ProxyHealthResponse` |

---

### Phase 7 — Tests
*Integration and unit tests to cover the new layers*

| # | File | Covers |
|---|------|--------|
| 7.1 | `server/tests/services/test_auth_service.py` | login success/failure, password change, `must_change_password` cleared |
| 7.2 | `server/tests/services/test_assignment_service.py` | round-robin distribution, MAX_CALLS_PER_REVIEWER cap |
| 7.3 | `server/tests/services/test_eval_service.py` | `has_corrections` computed correctly on submit |
| 7.4 | `server/tests/api/test_auth_endpoints.py` | login sets cookie, logout clears it, 401 on bad creds |
| 7.5 | `server/tests/api/test_evals_endpoints.py` | reviewer sees only their evals, submit advances to next |

---

## IN PROGRESS
*(nothing — all planned phases complete)*

## NOT STARTED
- Observability (structured logging per request, sync job logs)
- Background scheduler (APScheduler for daily 6 AM UTC call sync)
- Docker Compose (`server` + `postgres` services)
- Load & failure testing

## BLOCKED / NEEDS DECISION
- lokamspace `/calls-export` endpoint — needs to be built on the lokamspace side before `call_sync_service` can be tested end-to-end
