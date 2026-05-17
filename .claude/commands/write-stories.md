# Write Dev Story & PR Template

Generate a filled-in Dev Story (`dev.txt`) and PR template (`pr.md`) for the current task based on recent git history and conversation context.

## Your Task

Immediately use the Task tool with:
- **subagent_type**: "general-purpose"
- **model**: "haiku"
- **prompt**: Full instructions below for the agent to gather context, fill both templates, and save the files

The agent must:
1. Run git commands to understand recent work
2. Identify: ticket ID, branch name, what changed and why, security/bug/feature nature, affected files
3. Write `dev.txt` using the Dev Story template below
4. Write `pr.md` using the PR Template below
5. Both files go in the project root: `/Users/sinanshamsudheen/code/lokamspace/`

---

## Dev Story Template (save to `dev.txt`)

```markdown
# [Type] Short title describing the work

📝 **Description**

One paragraph: what this ticket does and why it exists.

**What:**

Bullet list of the concrete changes made (grouped by theme if needed).

**Why:**

Bullet list of the problems these changes solve, with consequences of not fixing them.

[One closing sentence on why this matters for the product/users.]

---

✅ **Acceptance Criteria**

### [Group Name]
* Criterion written as a verifiable, present-tense statement
* Each criterion must be independently testable
* Include specific values, endpoint paths, HTTP codes, field names where relevant

[Repeat groups for each logical area of the work]

---

🔗 **Related Links**

* [Relevant doc or report]
* Branch: `branch-name`
```

---

## PR Template (save to `pr.md`)

```markdown
<An apt 4-6 word title which starts with the 'Conventional Commits type' such as feat(api): , fix(api): etc>

# What type of PR is this? (check all applicable)
- [ ] Refactor
- [ ] Feature
- [ ] Improvement
- [ ] Bug Fix
- [ ] Optimization
- [ ] Documentation Update
---
## Description
_Describe the purpose of this pull request and what changes it includes._
---
## ENV / DB Changes
:warning: _If this PR introduces any **environment variable** or **database schema changes**, highlight them here._
- [ ] ENV changes
- [ ] DB changes
- Details: _Add notes on what changed and what needs to be updated in deployments_
---
## Screenshots / Recordings
_Add any relevant screenshots or screen recordings here. Describe visual or functional changes._
---
## QA Instructions
1. _Step-by-step guide for QA to test the changes_

:white_check_mark: Tested on **[Brave]** on **[Linux]**
---
## Self-Review Checklist
- [ ] I have tested the changes introduced in this PR
- [ ] I have removed console.logs and debug logic before raising this PR
- [ ] I have added/updated tests where possible
- [ ] Code coverage target (≥ 70%) maintained
---
## Review Process
**Two reviewers are required before merging:**
1. **Ramees (Functionality Review)**
   - Does this functionality map to the product requirements?
   - Is it working as expected?
   - Does it impact anything else?
   - Any changes needed for BAU (business as usual)?
2. **Suggested Reviewer (Code Review)**
   - Check code quality and structure
   - Review changed files
   - Ensure nothing unintended breaks (no hidden issues or regressions)
_Add the GitHub-suggested reviewer(s) for code review._
---
## :white_check_mark: Merge Requirements
- At least **2 approvals required**:
  - :heavy_check_mark: **Ramees** (Functionality Review)
  - :heavy_check_mark: **One suggested reviewer** (Code Quality Review)
- PR can be merged **only after**:
  - [ ] ENV/DB changes (if any) are clearly documented
  - [ ] QA instructions are verified
  - [ ] Self-review checklist is completed
```

---

## Agent Workflow

1. Gather context:
   - `git log --oneline -20` — recent commits
   - `git branch --show-current` — current branch
   - `git diff playground...HEAD --stat` — files changed vs main branch
   - Read `bug_report.md` or relevant planning docs if they exist in the project root

2. Identify:
   - Ticket ID (from branch name or commit messages, e.g. LOK2-911)
   - Type: Security / Bug Fix / Feature / Improvement
   - What changed and why
   - Affected subsystems (auth, DB, frontend, webhooks, etc.)
   - Any acceptance criteria implied by the changes

3. Fill the Dev Story:
   - Title format: `[Security] ...` or `[Bug Fix] ...` or `[Feature] ...`
   - Description must explain the "what" and "why" concretely
   - Acceptance criteria must be grouped by logical area and written as verifiable statements with specifics (HTTP codes, field names, endpoint paths)

4. Fill the PR Template:
   - Check the correct PR type boxes (Bug Fix, Optimization, Feature, etc.)
   - Description: explain the "why" and "what" clearly — list each fix/change with context
   - ENV/DB Changes: explicitly state if none, or list any migrations/env vars added
   - Screenshots/Recordings: note if no visual changes, or describe what changed in the UI
   - QA Instructions: numbered step-by-step, one item per testable behaviour — cover happy path and error cases
   - Self-Review: check items that genuinely apply
   - Leave reviewer names as placeholders if unknown

5. Write both files:
   - `dev.txt` → `/Users/sinanshamsudheen/code/lokamspace/dev.txt`
   - `pr.md` → `/Users/sinanshamsudheen/code/lokamspace/pr.md`

## Important Notes

- Be specific: use exact endpoint paths, HTTP status codes, cookie names, field names
- QA test cases must be independently executable — no "and then test the rest"
- Dev acceptance criteria must be verifiable by a non-author
- Do not leave placeholder text unfilled — every section must have real content
- Both files are for human review, not committed to git