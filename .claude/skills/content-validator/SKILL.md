---
name: content-validator
description: Validates Vizora deployment readiness by checking content integrity, display configs, schedule conflicts, and storage quotas
level: 2
tools:
  - Bash
  - Read
  - Task
  - TaskCreate
  - TaskUpdate
  - TaskList
---

# Content Validator — Orchestration Skill

Automated deployment readiness checker for the Vizora digital signage platform. Runs 30 validation rules across content, displays, schedules, and storage to determine if content is safe to push to customer displays.

## When to Use

- Before deploying content changes to production displays
- After bulk content uploads or schedule changes
- As a pre-flight check before going live with a new location
- When debugging "blank screen" or "wrong content" reports

## Orchestration Flow

```
/validate [scope] [--token TOKEN]
    │
    ├── 1. infra-checker → 01-health-check.ts
    │       If UNHEALTHY → STOP, report infrastructure failure
    │
    ├── 2. Obtain JWT (user provides or prompt for login)
    │
    ├── 3. Run in parallel (all read-only):
    │   ├── content-auditor  → 02-content-validator.ts
    │   ├── display-inspector → 03-display-config-validator.ts
    │   └── schedule-analyzer → 04-schedule-validator.ts
    │
    └── 4. report-compiler → 05-report-generator.ts
            Output: READY | DEGRADED | NOT READY
```

## Step-by-Step Instructions

### Step 1: Health Check

Run the infrastructure health check first. If the API is down, nothing else works.

```bash
npx tsx .claude/skills/content-validator/scripts/01-health-check.ts --base-url http://localhost:3000
```

- If exit code = 2 (unhealthy): **STOP HERE**. Report the infrastructure failure and do not proceed.
- If exit code = 1 (degraded): Warn the user but continue.
- If exit code = 0 (healthy): Proceed.

### Step 2: Obtain Authentication

The validator scripts need a JWT token for authenticated endpoints. Options:

1. **User provides token**: `--token <JWT>` passed to `/validate`
2. **Login via API**: POST to `/api/v1/auth/login` with credentials
3. **Cookie-based**: If running in a context with active cookies

Ask the user for their preferred method if no token is provided.

### Step 3: Run Validators in Parallel

Launch three subagents simultaneously using the Task tool:

1. **content-auditor** — runs `02-content-validator.ts`
2. **display-inspector** — runs `03-display-config-validator.ts`
3. **schedule-analyzer** — runs `04-schedule-validator.ts`

Each script outputs JSON to stdout. Save each result to a temp file:
```bash
npx tsx .claude/skills/content-validator/scripts/02-content-validator.ts \
  --base-url http://localhost:3000 --token $TOKEN > /tmp/vizora-content.json

npx tsx .claude/skills/content-validator/scripts/03-display-config-validator.ts \
  --base-url http://localhost:3000 --token $TOKEN > /tmp/vizora-display.json

npx tsx .claude/skills/content-validator/scripts/04-schedule-validator.ts \
  --base-url http://localhost:3000 --token $TOKEN > /tmp/vizora-schedule.json
```

### Step 4: Generate Report

Aggregate all results into a final report:
```bash
npx tsx .claude/skills/content-validator/scripts/05-report-generator.ts \
  --input /tmp/vizora-content.json \
  --input /tmp/vizora-display.json \
  --input /tmp/vizora-schedule.json
```

Present the markdown report to the user.

## Readiness Levels

| Level | Criteria | Action |
|-------|----------|--------|
| **READY** | 0 critical, 0 warnings | Safe to deploy |
| **DEGRADED** | 0 critical, 1+ warnings | Review warnings, deploy at discretion |
| **NOT READY** | 1+ critical issues | Must fix criticals before deployment |

## Scope Options

The `/validate` command supports optional scope filtering:

- `/validate` — full validation (all categories)
- `/validate content` — content + storage only
- `/validate displays` — displays + playlists only
- `/validate schedules` — schedules only
- `/validate --base-url http://prod:3000` — validate against a different environment

## Reference Files

- [Validation Rules Catalog](./validation-rules.md) — all 30 rules with severity and logic
- [Report Format](./report-format.md) — report template and severity definitions

## Constraints

- **Read-only**: All scripts use only GET requests. No data is ever modified.
- **No AI API costs**: All validation is deterministic TypeScript. No LLM calls.
- **Timeout**: Each script has a 30-second timeout. Total validation <2 minutes.
- **Entity cap**: Maximum 500 entities per category to prevent runaway queries.
- **Zero dependencies**: Scripts use only Node.js built-in `fetch` (v18+).
