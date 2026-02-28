---
description: Validate Vizora deployment readiness — checks content, displays, schedules, and storage
allowed-tools: Bash, Read, Task, Grep, Glob, TaskCreate, TaskUpdate, TaskList
---

# /validate — Deployment Readiness Check

Run the Vizora content validator to check if content is ready for customer displays.

**Usage:** `/validate [scope] [--token TOKEN] [--base-url URL]`

## Arguments

- `scope` (optional): `content`, `displays`, `schedules`, or omit for full validation
- `--token TOKEN`: JWT auth token (will prompt if not provided)
- `--base-url URL`: API URL (default: `http://localhost:3000`)

## Instructions

You MUST use the `content-validator` skill at `.claude/skills/content-validator/SKILL.md` to execute this command. Load the skill and follow its orchestration flow exactly:

1. Run health check (no auth needed)
2. Obtain JWT token
3. Run validators in parallel (or single scope if specified)
4. Generate and present the readiness report

$ARGUMENTS will contain anything the user typed after `/validate`.

Parse the arguments to extract:
- Scope filter (first positional arg, if any)
- `--token` flag value
- `--base-url` flag value

If no token is provided and authenticated endpoints are needed, ask the user how they'd like to authenticate:
1. Provide a JWT token directly
2. Log in with email/password (you'll call the login API)
3. Use an existing session cookie

Present the final report in markdown format. If the result is NOT READY, highlight every critical issue and its recommended fix.
