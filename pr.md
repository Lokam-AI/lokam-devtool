feat(voice-agent): implement bug tracker and quality tagging system

# What type of PR is this? (check all applicable)
- [x] Feature
- [ ] Improvement
- [ ] Refactor
- [ ] Bug Fix
- [ ] Optimization
- [ ] Documentation Update

---

## Description

This PR implements two interconnected features for voice agent quality control:

1. **Voice Agent Bug Tracker**: A configurable bug type taxonomy (`super_configs` table) allowing superadmins to define, manage, and categorize voice agent failure modes (Transcription Error, Agent Stopped Talking, etc.) with severity levels stored as JSONB options.

2. **Call Quality Tagging**: Reviewers now tag calls with quality outcomes (AGENT_HANDLED_WELL or AGENT_FAILED) via a popover picker in the eval form, replacing the bookmark button. Quality tags sync with `is_bookmarked` to maintain backward compatibility. Tags are stored on `raw_calls` alongside optional notes.

**Key Changes**:
- New `super_configs` table (generic configurable taxonomy) with 6 seeded voice bug types
- `evals.bug_type_ids` JSONB column for tagging bugs observed during review
- `raw_calls.quality_tag` and `quality_tag_notes` columns for reviewer quality feedback
- Backend API endpoints: `GET/POST/PATCH /super-configs`, `GET/PATCH /calls/{id}/bug-type-ids`, `PATCH /calls/{id}/quality-tag`
- BugTypeConfigPage (new superadmin UI, moved to TeamPage tab) to CRUD bug types with severity
- Quality tag picker in EvalFormPage; quality tag badge in CallDetailPage
- Redesigned filter bars (CallFilterBar, BugsFilterBar) with popover strategy
- Bug Occurrences dashboard card with 7d/30d toggle
- Quality tag filter on AllCallsPage; severity filter on BugsPage
- BookmarkedCallsPage deleted; `/bookmarked` redirects to `/all-calls`
- CallDistributionPage and BugTypeConfigPage moved to TeamPage tabs

---

## ENV / DB Changes

:warning: **Database Schema Changes Required**:

- **New table**: `super_configs` (category, name, display_name, description, options JSONB, is_active, sort_order, created_at, updated_at)
  - Unique constraint: `uq_super_configs_category_name` on (category, name)
  - Index: `idx_super_configs_category_active` on (category, is_active)
  - 6 default voice_bug_type configs seeded

- **New columns on `evals`**: `bug_type_ids` (JSONB, nullable)

- **New columns on `raw_calls`**: 
  - `quality_tag` (VARCHAR(30), nullable) — values: AGENT_HANDLED_WELL, AGENT_FAILED, or null
  - `quality_tag_notes` (TEXT, nullable)

- **Migration**: `alembic/versions/j8k2l3m4n5o6_add_super_configs_and_voice_bug_tagging.py`
  - Run: `alembic upgrade head`
  - Rollback: `alembic downgrade -1`

- **No environment variables added**

---

## Screenshots / Recordings

### BugTypeConfigPage (Superadmin)
- Table displaying all voice_bug_type configs with name, display_name, description, severity level, is_active toggle
- Create modal: form inputs for name, display_name, description, severity (low/medium/high), is_active
- Edit modal: pre-populate all fields, PATCH to update
- Soft-delete: toggle is_active=false

### Quality Tag Picker (EvalFormPage)
- Popover replacing bookmark button
- Radio options: "Handled Well" (green), "Agent Failed" (red), clear (no tag)
- Stored locally until eval form submit

### Quality Tag Badge (CallDetailPage)
- Green pill: "AGENT_HANDLED_WELL"
- Red pill: "AGENT_FAILED"
- Displayed near bookmark icon in right panel

### Bug Filter Bar (BugsPage)
- BugType multi-select dropdown
- 7d / 30d toggle
- Severity filter (low/medium/high) sub-selector
- Active filter count badge

### Bug Occurrences Card (DashboardPage)
- Top 5 bug types by count
- 7d / 30d time range toggle
- Shows name, display_name, count per type

### Call Filter Bar (AllCallsPage)
- Redesigned: Search + Date + Filters(n) popover + Sort
- Bookmarked filter + Quality Tag sub-filter (nested, visible only when Bookmarked=true)
- Sub-filter options: All, Handled Well, Agent Failed

---

## QA Instructions

### Setup
1. Run migration: `alembic upgrade head` (creates super_configs table, adds columns, seeds 6 bug types)
2. Start backend: `uvicorn` pointing to updated DB
3. Start frontend: `npm run dev`
4. Log in as superadmin user

### Test 1: Bug Type Management (Superadmin)
1. Navigate to **Team Page → Bug Type Config** tab
2. Verify table shows 6 seeded bug types (Transcription Error, Agent Stopped Talking, Incorrect Escalation, Duplicate Response, Script Deviation, Call Drop)
3. Click **Create Bug Type**:
   - Fill: name="Custom Bug", display_name="Custom Bug Type", description="Test", severity="high", is_active=true
   - Submit; verify 201 response and row appears in table
4. Click **Edit** on any bug type:
   - Change severity to "medium", is_active to false
   - Save; verify PATCH succeeds
5. Verify list filters correctly: GET `/api/v1/super-configs?category=voice_bug_type` returns all (superadmin) or active-only (reviewer)

### Test 2: Quality Tag Picker (Reviewer)
1. Navigate to **All Calls → pick any call**
2. Open **Eval Form**
3. In eval form, find the **bookmark/quality tag button** (replaced old bookmark icon)
4. Click to open popover; select **"Handled Well"** (green)
5. Verify tag persists in local state (not yet submitted)
6. Submit eval form
7. Verify PATCH to `/api/v1/calls/{call_id}/quality-tag` includes `quality_tag="AGENT_HANDLED_WELL"`
8. Navigate back to call detail; verify quality tag badge displays green "Handled Well" pill
9. Open eval form again, clear tag, submit; verify quality_tag=null and is_bookmarked=false

### Test 3: Call Filtering by Quality Tag (Reviewer)
1. Navigate to **All Calls**
2. Open filter popover
3. Enable **Bookmarked** filter
4. Verify **Quality Tag** sub-filter appears with options: All, Handled Well, Agent Failed
5. Select **Quality Tag = "Handled Well"**
6. Verify URL shows `?is_bookmarked=true&quality_tag=AGENT_HANDLED_WELL`
7. Verify list shows only calls with quality_tag="AGENT_HANDLED_WELL"
8. Change sub-filter to **Agent Failed**; verify list updates (only AGENT_FAILED calls)
9. Disable Bookmarked filter; verify Quality Tag sub-filter disappears

### Test 4: Bug Type Tagging (Reviewer in Eval Form)
1. Open **Eval Form** on any call
2. Scroll to **Bug Type Tags** section
3. Verify multi-select popover lists all active voice_bug_types (6 defaults)
4. Select **Transcription Error** and **Agent Stopped Talking**
5. Submit eval
6. Verify PATCH to `/api/v1/calls/{call_id}/bug-type-ids` includes selected IDs
7. Navigate to **Bugs Page → filter by Bug Type**; verify call appears in results for both selected types

### Test 5: Bug Dashboard & Filtering (Reviewer)
1. Navigate to **Dashboard**
2. Verify **Bug Occurrences** card displays top 5 bug types by count with 7d toggle active
3. Click **30d** toggle; verify bug counts update (counts reset to 30-day range)
4. Navigate to **Bugs Page**
5. Verify filter bar: BugType selector, Days (7d/30d), Severity sub-filter
6. Select **BugType = "Transcription Error"**, **Days = 30**, **Severity = "high"**
7. Verify URL: `?bug_type=<id>&days=30&severity=high`
8. Verify list shows only bugs matching all filters
9. Verify column shows severity level (low/medium/high) for each bug type

### Test 6: Navigation Changes (All Roles)
1. Verify **BookmarkedCallsPage** no longer exists; `/bookmarked` redirects to `/all-calls`
2. Verify **CallDistributionPage** accessible via **Team Page → Call Distribution** tab (not in sidebar)
3. Verify **BugTypeConfigPage** accessible via **Team Page → Bug Type Config** tab (superadmin only)
4. Verify **SUPERADMIN_NAV** items removed from AppSidebar (Admin/Superadmin users should no longer see sidebar shortcuts to these pages)

### Test 7: API Endpoints
```bash
# List bug types (category=voice_bug_type)
GET /api/v1/super-configs?category=voice_bug_type
# Expected: 200, list of SuperConfigRead objects

# Create new bug type (superadmin)
POST /api/v1/super-configs
Body: {"category": "voice_bug_type", "name": "Test", "severity": "medium"}
# Expected: 201, SuperConfigRead with id

# Update bug type (superadmin)
PATCH /api/v1/super-configs/{id}
Body: {"is_active": false}
# Expected: 200, updated SuperConfigRead

# Get bug type IDs for a call
GET /api/v1/calls/{call_id}/bug-type-ids
# Expected: 200, list of BugTypeWithName objects

# Set quality tag on a call
PATCH /api/v1/calls/{call_id}/quality-tag
Body: {"quality_tag": "AGENT_HANDLED_WELL", "quality_tag_notes": "Call handled well"}
# Expected: 200, RawCallRead with updated quality_tag & is_bookmarked=true

# Clear quality tag
PATCH /api/v1/calls/{call_id}/quality-tag
Body: {"quality_tag": null}
# Expected: 200, is_bookmarked=false

# Filter calls by quality tag
GET /api/v1/calls/list?quality_tag=AGENT_HANDLED_WELL
# Expected: 200, list filtered by quality_tag

# Filter bugs by severity
GET /api/v1/bugs/list?severity=high
# Expected: 200, list filtered (via super_config subquery)
```

:white_check_mark: Tested on **Chrome** on **macOS**

---

## Self-Review Checklist
- [x] I have tested the changes introduced in this PR
- [x] I have removed console.logs and debug logic before raising this PR
- [x] I have added/updated tests where possible
- [x] Code coverage target (≥ 70%) maintained
- [x] All routes return typed Pydantic response_model (no ORM models exposed)
- [x] All service methods are async and properly typed
- [x] Dependencies injected via Depends() in routes
- [x] Error handling uses typed exception hierarchy (AppError)
- [x] No magic literals; all constants named
- [x] Functions follow single-responsibility principle (~20 lines max)
- [x] Guard clauses and early returns used (no deep nesting)
- [x] Database migrations tested and reversible

---

## Review Process

**Two reviewers are required before merging:**

1. **Ramees (Functionality Review)**
   - Does this functionality map to the product requirements (voice agent quality monitoring)?
   - Is the bug type taxonomy extensible and superadmin-friendly?
   - Does quality tagging improve reviewer UX and maintain backward compatibility with bookmarks?
   - Do filters work correctly across pages (AllCalls, Bugs, Dashboard)?
   - Are there any data consistency issues (e.g., quality_tag sync with is_bookmarked)?
   - Impact on existing features (e.g., eval submission, bug reports, dashboard)?

2. **Suggested Reviewer (Code Quality Review)**
   - Check FastAPI endpoint structure (dependencies, response models, error handling)
   - Review SQLAlchemy ORM models and Alembic migration
   - Verify React hooks (useSuperConfigs, useCallTags) and component composition
   - Check TypeScript types and API contract consistency
   - Ensure no circular dependencies or breaking changes
   - Verify test coverage on critical paths (bug type CRUD, quality tag filtering)

---

## :white_check_mark: Merge Requirements

- At least **2 approvals required**:
  - :heavy_check_mark: **Ramees** (Functionality Review)
  - :heavy_check_mark: **One suggested reviewer** (Code Quality Review)

- PR can be merged **only after**:
  - [x] Database migration validated (create/seed/drop tested)
  - [x] API endpoints tested (all 7+ endpoints working)
  - [x] Frontend pages tested (BugTypeConfigPage, EvalFormPage, AllCallsPage, BugsPage, DashboardPage)
  - [x] Filtering and sorting verified across all pages
  - [x] Navigation changes validated (redirects, tab structure)
  - [x] Self-review checklist completed
  - [x] No console.logs or debug code remaining
  - [x] Code follows CLAUDE.md conventions (async/await, type hints, single-responsibility)

