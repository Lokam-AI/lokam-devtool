# Lokam Dev Tool — Architecture & Design

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend | FastAPI (Python 3.10+) | Same as lokamspace, team expertise |
| Frontend | React + Vite + TypeScript | Same as lokamspace |
| Database | PostgreSQL | Same as lokamspace |
| ORM | SQLAlchemy (async) | Same patterns as lokamspace |
| Migrations | Alembic | Same as lokamspace |
| Auth | JWT (HS256) + httpOnly cookies | Proven pattern from lokamspace |
| Styling | Tailwind CSS + Shadcn/UI | Same as lokamspace client |

## Project Structure

```
lokam-devtool/
├── server/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py          # login, password change
│   │   │   │   ├── admin.py         # env config CRUD, proxy to lokamspace
│   │   │   │   ├── calls.py         # raw_calls listing, sync trigger
│   │   │   │   ├── evals.py         # eval CRUD, submit evaluations
│   │   │   │   ├── users.py         # user CRUD (admin only)
│   │   │   │   └── health.py        # dev tool health check
│   │   │   └── router.py
│   │   ├── models/
│   │   │   ├── base.py              # Same base pattern as lokamspace
│   │   │   ├── user.py
│   │   │   ├── raw_call.py
│   │   │   ├── eval.py
│   │   │   └── env_config.py
│   │   ├── schemas/                  # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── call_sync_service.py  # Fetches from lokamspace, stores, assigns
│   │   │   ├── assignment_service.py # Round-robin logic
│   │   │   ├── eval_service.py       # Eval CRUD + corrections tracking
│   │   │   ├── admin_proxy_service.py# Proxies admin actions to lokamspace envs
│   │   │   └── user_service.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py           # JWT + bcrypt (same as lokamspace)
│   │   │   ├── database.py
│   │   │   └── encryption.py         # Fernet for env secrets
│   │   ├── dependencies.py
│   │   └── main.py
│   ├── alembic/
│   ├── requirements.txt
│   └── .env
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── AdminControls.tsx
│   │   │   ├── MyCalls.tsx
│   │   │   ├── EvalForm.tsx
│   │   │   ├── TeamOverview.tsx
│   │   │   └── UserManagement.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                 LOKAM DEV TOOL                       │
│                                                      │
│  ┌────────────┐       ┌──────────────┐  ┌─────────┐ │
│  │  React SPA │◄─────▶│  FastAPI     │─▶│Postgres │ │
│  │            │ REST  │  Backend     │◀─│         │ │
│  │ - Login    │       │              │  │ users   │ │
│  │ - Dashboard│       │ - Auth       │  │raw_calls│ │
│  │ - Admin    │       │ - CallSync   │  │ evals   │ │
│  │ - MyCalls  │       │ - Evals      │  │env_cfgs │ │
│  │ - EvalForm │       │ - AdminProxy │  └─────────┘ │
│  │ - Team     │       │ - Users      │              │
│  └────────────┘       └──────┬───────┘              │
│                              │                       │
└──────────────────────────────┼───────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │ Lokamspace   │   │ Lokamspace   │   │ Lokamspace   │
   │ DEV          │   │ STAGING      │   │ PROD         │
   │              │   │              │   │              │
   │ /internal/*  │   │ /internal/*  │   │ /internal/*  │
   └──────────────┘   └──────────────┘   └──────────────┘
```

## Core Flows

### 1. Daily Call Sync

```
Schedule: Configurable (default: once daily at 6 AM UTC)
Trigger: Background task in FastAPI lifespan OR manual trigger from admin UI

Steps:
1. For each active env_config (or just prod — configurable):
   a. GET {base_url}/api/v1/internal/calls-export?date={today}
      Headers: Authorization: Bearer {secrets.api_key}
   b. Response: array of call objects with masked PII
   c. Upsert into raw_calls (deduplicate on lokam_call_id)
2. Run assignment:
   a. Get all active reviewers
   b. Get all unassigned raw_calls for today
   c. Round-robin: assign calls evenly, create eval records
      - Each eval: call_id set, all gt_ fields NULL, status=pending
   d. Target: 10-20 calls per reviewer (configurable via MAX_CALLS_PER_REVIEWER env var, default 20)
3. Log sync results (count synced, count assigned, any errors)
```

### 2. Eval Submission

```
1. Reviewer opens eval form for a call
2. UI displays: AI value for each field + "Correct?" toggle
3. For each field:
   - If "Yes" → gt_ field = copy of AI value from raw_call
   - If "No" → gt_ field = reviewer's corrected value
4. On submit:
   a. Update eval record with all gt_ values
   b. Set eval_status = "completed", completed_at = now()
   c. Compute has_corrections = true if ANY gt_ field differs from raw_call value
   d. Return next pending eval for this reviewer (auto-advance)
```

### 3. Admin Proxy Actions

```
1. Admin selects environment from dropdown
2. Action buttons call dev tool backend
3. Dev tool backend:
   a. Looks up env_config for selected env
   b. Decrypts secrets
   c. Forwards request to lokamspace internal endpoint:
      - ACS toggle: POST {base_url}/api/v1/internal/acs/toggle
        Body: { "enabled": true/false }
      - Seed script: POST {base_url}/api/v1/internal/seed/run
        Body: { "mode": "--check-and-seed" }
      - Health: GET {base_url}/api/v1/internal/health
   d. Returns lokamspace response to frontend
```

## Auth Design

- **JWT tokens** with HS256, stored in httpOnly cookies (same as lokamspace)
- **Token payload:** `{ sub: email, role: "superadmin"|"admin"|"reviewer", jti: uuid, exp: timestamp }`
- **Password hashing:** bcrypt via passlib
- **First-time login:** `must_change_password` flag forces password change on first login
- **Role hierarchy:** superadmin > admin > reviewer
  - **superadmin:** all admin powers + can change user roles (promote/demote)
  - **admin:** admin controls, user creation (reviewers only), team overview, call review
  - **reviewer:** my calls + eval form only
- **Role enforcement:** FastAPI dependency injection (`get_superadmin_user`, `get_admin_user`, `get_current_user`)
- **Bootstrapping:** First superadmin created via CLI seed command. Only superadmin can promote others to admin.

## Lokamspace Changes Required

New internal endpoints to add to lokamspace (secured with API key auth):

### GET /api/v1/internal/calls-export
- **Auth:** Bearer token (internal API key, validated via `require_vendor_key("internal")`)
- **Query params:** `date` (YYYY-MM-DD), optional `rooftop_id`
- **Response:** Array of call objects with:
  - All call fields (including `recording_url` — direct VAPI URL for audio playback)
  - Associated call_feedback
  - Associated service_record context
  - `customer_name` masked (e.g., "J***n")
  - `customer_number` masked (e.g., "***-***-1234")
- **Filters:** Only completed calls for the given date

### POST /api/v1/internal/acs/toggle
- **Auth:** Internal API key
- **Body:** `{ "enabled": boolean }`
- **Action:** Updates ACS scheduler state (enable/disable the EventBridge rule or set a feature flag)

### POST /api/v1/internal/seed/run
- **Auth:** Internal API key
- **Body:** `{ "mode": "--check-and-seed" | "--force-recreate" | "--dry-run" }`
- **Action:** Triggers seed script execution, returns output

### GET /api/v1/internal/health
- **Auth:** Internal API key
- **Response:** `{ "acs_active_calls": N, "sqs_queue_depth": N, "dynamodb_slots_used": N, "workers_running": N }`

## Security Considerations

- Internal API keys stored encrypted (Fernet) in env_configs.secrets
- Dev tool should be deployed on an internal network or behind VPN — not public internet
- All admin actions are logged with user, action, target env, timestamp
- PII masked at source (lokamspace export endpoint) — dev tool DB is PII-free
- CORS restricted to dev tool frontend origin only
