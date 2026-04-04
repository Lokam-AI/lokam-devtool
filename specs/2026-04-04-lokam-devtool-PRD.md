# Lokam Dev Tool — Product Requirements Document

## Context

Lokam is a multi-tenant call intelligence platform. The AI generates NPS scores, call summaries, and feedback for every call. There is no systematic way to verify the accuracy of these AI outputs, nor a centralized place for devs to execute admin operations (ACS toggles, seed scripts) across environments.

This dev tool solves both problems: a **call monitoring queue** for human evaluation of AI outputs, and an **admin control panel** for operational actions across dev/staging/prod.

## Goals

1. **Improve AI accuracy** — build a ground-truth dataset by having humans review AI-generated call evaluations daily
2. **Centralize admin ops** — one dashboard to control ACS, run seeds, and monitor system health across all environments
3. **Track disagreements** — identify calls where AI and human evaluators disagree, creating training data for future model improvements

## Scope (v1)

### In Scope
- Auth (email/password, superadmin + admin + reviewer roles)
- Admin Control Panel (ACS toggle, seed script runner, system health per env)
- Daily call data sync from lokamspace (via new internal API endpoint)
- Round-robin auto-assignment of calls to reviewers
- Eval form for all gt_ fields (NPS, summary, feedback, detractors, positives, booleans)
- "My Calls" view for reviewers
- Team Overview for admins
- Corrections tracking (has_corrections flag, exportable eval data)
- Call recording playback and download (direct VAPI URLs)

### Out of Scope (v1)
- Bug report system (future — customers + internal, queued for v2)
- Email invites for new reviewers (manual credential sharing for now)
- Pushing corrections back to lokamspace DB
- Advanced analytics / reporting on eval trends

## Users

| Role | Access | Count (est.) |
|------|--------|--------------|
| Superadmin | Everything + user role management (promote/demote admins and reviewers) | 1 |
| Admin | Admin controls, user creation, team overview, call review. Cannot change user roles. | 2-3 |
| Reviewer | Limited: my calls, eval form only | 5-15 |

## User Stories

### Superadmin
- As a superadmin, I can do everything an admin can do
- As a superadmin, I can promote a reviewer to admin or demote an admin to reviewer
- As a superadmin, I can create admin accounts (admins can only create reviewer accounts)

### Admin
- As an admin, I can toggle ACS on/off for all rooftops in any environment from one dashboard
- As an admin, I can trigger seed scripts in any environment and see the output
- As an admin, I can monitor system health (active calls, queue depth, DynamoDB slots) per environment
- As an admin, I can create reviewer accounts with email + temporary password
- As an admin, I can see team progress: who completed how many evals today
- As an admin, I can review calls myself (same as a reviewer)

### Reviewer
- As a reviewer, I log in and see my assigned calls for today
- As a reviewer, I open a call and see the full context (transcript, summary, metadata) and listen to the call recording
- As a reviewer, I evaluate each AI output (correct/incorrect) and provide ground-truth corrections
- As a reviewer, I submit my evaluation and move to the next call

## Data Flow

```
Lokamspace (per env)
    │
    │  GET /api/v1/internal/calls-export?date=YYYY-MM-DD
    │  (secured with internal API key, PII masked at source)
    │
    ▼
Dev Tool Backend
    │
    ├── Store in raw_calls table
    ├── Round-robin assign to active reviewers
    └── Create eval records (gt_ fields = NULL, status = pending)
    │
    ▼
Reviewer opens "My Calls"
    │
    ├── Sees 10-20 assigned calls
    ├── Opens eval form
    ├── For each gt_ field: "Correct?" → Yes (copy AI value) / No (enter correction)
    └── Submits → eval marked completed, has_corrections computed
```

## PII Handling

- The `/calls-export` endpoint masks `customer_name` and `customer_number` before returning
- Dev tool DB never contains real PII
- Only these two fields are masked; all other call data comes through as-is

## Non-Functional Requirements

- **Availability:** Internal tool, standard business hours. No SLA needed.
- **Performance:** <20 concurrent users. Standard request/response times sufficient.
- **Security:** JWT auth with httpOnly cookies. Env secrets stored encrypted in DB.
- **Deployment:** Docker Compose for local dev. AWS (EC2/ECS) for production.
