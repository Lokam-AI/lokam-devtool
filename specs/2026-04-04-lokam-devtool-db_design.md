# Lokam Dev Tool — Database Design

## Overview

Separate PostgreSQL database from lokamspace. 4 tables for v1. Schema designed to be self-contained and exportable for ML training pipelines.

## ER Diagram

```
┌──────────┐       ┌────────────┐       ┌──────────┐
│  users   │       │ raw_calls  │       │env_configs│
│──────────│       │────────────│       │──────────│
│ id (PK)  │       │ id (PK)    │       │ id (PK)  │
│ email    │       │ lokam_call │       │ name     │
│ password │       │ _id (UQ)   │       │ base_url │
│ name     │       │ call_date  │       │ secrets  │
│ role     │       │ nps_score  │       │ is_active│
│ is_active│       │ transcript │       └──────────┘
│ must_chg │       │ ...        │
│ _password│       └─────┬──────┘
└────┬─────┘             │
     │                   │ 1:N
     │              ┌────┴──────┐
     │              │   evals   │
     │              │───────────│
     │   assigned   │ id (PK)   │
     └──────────────│ call_id   │
          N:1       │ (FK)      │
                    │assigned_to│
                    │ (FK)      │
                    │ gt_*      │
                    │ eval_     │
                    │ status    │
                    └───────────┘
```

## Table Definitions

### 1. users

```sql
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'reviewer',
        -- CONSTRAINT: role IN ('superadmin', 'admin', 'reviewer')
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### 2. raw_calls

Stores the daily call data fetched from lokamspace. One row per call. Never modified after insert (append-only).

```sql
CREATE TABLE raw_calls (
    id                      SERIAL PRIMARY KEY,
    lokam_call_id           INTEGER NOT NULL UNIQUE,
    -- Context
    organization_name       VARCHAR(150),
    rooftop_name            VARCHAR(150),
    campaign_name           VARCHAR(150),
    -- Call metadata
    call_status             VARCHAR(20),
    direction               VARCHAR(10),
    duration_sec            INTEGER,
    call_date               DATE NOT NULL,
    -- AI outputs (the fields reviewers will evaluate)
    nps_score               INTEGER,
    call_summary            TEXT,
    overall_feedback        TEXT,
    positive_mentions       JSONB,
    detractors              JSONB,
    is_incomplete_call      BOOLEAN,
    incomplete_reason       TEXT,
    is_dnc_request          BOOLEAN,
    escalation_needed       BOOLEAN,
    -- Transcripts & Recording
    raw_transcript          TEXT,
    formatted_transcript    TEXT,
    recording_url           TEXT,  -- Direct VAPI URL for audio playback/download
    -- Structured context
    service_record_json     JSONB,
    organization_json       JSONB,
    call_metadata           JSONB,
    -- PII (masked at source)
    customer_name_masked    VARCHAR(100),
    customer_phone_masked   VARCHAR(20),
    -- Sync tracking
    source_env              VARCHAR(20) DEFAULT 'prod',
    synced_at               TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raw_calls_call_date ON raw_calls(call_date);
CREATE INDEX idx_raw_calls_lokam_call_id ON raw_calls(lokam_call_id);
CREATE INDEX idx_raw_calls_source_env ON raw_calls(source_env);
```

### 3. evals

Ground-truth evaluation records. One per call per reviewer assignment. The `gt_` prefix columns hold the reviewer's corrected values.

**Column semantics:**
- `gt_` columns start as NULL (not yet reviewed)
- When reviewer agrees with AI: `gt_` value = copy of AI value from raw_calls
- When reviewer disagrees: `gt_` value = reviewer's corrected value
- `has_corrections` = TRUE if any `gt_` value differs from the corresponding raw_calls value

```sql
CREATE TABLE evals (
    id                      SERIAL PRIMARY KEY,
    call_id                 INTEGER NOT NULL REFERENCES raw_calls(id) ON DELETE CASCADE,
    -- Denormalized context (for self-contained eval export)
    call_status             VARCHAR(20),
    raw_transcript          TEXT,
    formatted_transcript    TEXT,
    recording_url           TEXT,  -- Direct VAPI URL (denormalized from raw_calls)
    service_record_json     JSONB,
    organization_json       JSONB,
    formatted_tags          JSONB,
    -- Ground-truth fields (reviewer corrections)
    gt_call_summary         TEXT,
    gt_nps_score            INTEGER,
    gt_overall_feedback     TEXT,
    gt_positive_mentions    JSONB,
    gt_detractors           JSONB,
    gt_is_incomplete_call   BOOLEAN,
    gt_incomplete_reason    TEXT,
    gt_is_dnc_request       BOOLEAN,
    gt_escalation_needed    BOOLEAN,
    -- Scenario tagging
    scenario_tags           JSONB,
    scenario_tags_str       TEXT,
    -- Assignment & status
    assigned_to             INTEGER NOT NULL REFERENCES users(id),
    eval_status             VARCHAR(20) NOT NULL DEFAULT 'pending',
        -- CONSTRAINT: eval_status IN ('pending', 'in_progress', 'completed')
    has_corrections         BOOLEAN DEFAULT FALSE,
    completed_at            TIMESTAMP,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evals_assigned_to ON evals(assigned_to);
CREATE INDEX idx_evals_eval_status ON evals(eval_status);
CREATE INDEX idx_evals_call_id ON evals(call_id);
CREATE INDEX idx_evals_has_corrections ON evals(has_corrections) WHERE has_corrections = TRUE;
CREATE INDEX idx_evals_completed_at ON evals(completed_at);
```

### 4. env_configs

Connection config for each lokamspace environment.

```sql
CREATE TABLE env_configs (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) NOT NULL UNIQUE,
        -- e.g., 'dev', 'staging', 'prod'
    base_url        TEXT NOT NULL,
        -- e.g., 'https://staging.lokam.io'
    secrets         JSONB NOT NULL DEFAULT '{}',
        -- Encrypted at application layer (Fernet)
        -- Structure: { "api_key": "...", ... }
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Key Design Decisions

### 1. Denormalized evals table
The evals table copies transcript and context data from raw_calls. This is intentional:
- Evals can be exported as a self-contained dataset for ML training
- No joins needed when displaying the eval form
- raw_calls is append-only and never modified; evals evolve independently

### 2. has_corrections flag
Rather than scanning all gt_ fields to find disagreements, a boolean flag is computed on submission. This enables fast queries like "show me all calls where the reviewer disagreed with the AI."

### 3. Masked PII at source
customer_name_masked and customer_phone_masked are stored as pre-masked strings. The dev tool DB never contains real PII. Masking happens in the lokamspace /calls-export endpoint before data leaves lokamspace.

### 4. source_env column on raw_calls
Supports syncing from multiple environments (primarily prod, but dev/staging calls can be synced for testing the tool itself).

### 5. No foreign key to lokamspace
lokam_call_id is stored as an integer reference but NOT as a foreign key (separate databases). It serves as a deduplication key during sync.

## Indexes Strategy

| Table | Index | Purpose |
|-------|-------|---------|
| users | email | Login lookup |
| users | role | Filter by role |
| raw_calls | call_date | Daily call listing |
| raw_calls | lokam_call_id | Dedup during sync |
| evals | assigned_to | "My Calls" query |
| evals | eval_status | Filter pending/completed |
| evals | has_corrections (partial) | Find disagreements |
| evals | completed_at | Progress tracking |

## Future Schema (v2 — Bug Reports)

Placeholder for the bug report system. Not built in v1 but the schema will accommodate:

```
bug_reports:
  id, title, description, severity, status,
  reported_by (FK users or external),
  assigned_to (FK users),
  environment, steps_to_reproduce,
  created_at, updated_at, resolved_at
```
