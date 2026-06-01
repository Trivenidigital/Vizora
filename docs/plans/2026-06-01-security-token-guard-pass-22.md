# Security Token Guard Pass 22

**Date:** 2026-06-01
**Branch:** `feat/customer-dashboard-improvements-pass-22`

## Why Now

After PR #144 merged with green CI, the next customer-readiness review found a
small but high-severity release hygiene gap: several manual verification
scripts committed long-lived JWT-looking tokens. This pass removes those token
values and adds a CI guard so the same class of secret regression fails before
merge.

## New Primitives Introduced

One repository-local security scan script:
`scripts/security/check-no-hardcoded-jwts.js`.

No new runtime service, route, database model, migration, agent, MCP tool,
Hermes skill, provider, or infrastructure primitive.

## Hermes-First Analysis

Not applicable. This pass does not introduce or modify business agents, MCP
tools, Hermes skills, AI/provider calls, or spend paths.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Secret hygiene guard | none applicable | Build repository-local static guard; no agent runtime needed. |

Awesome-Hermes-agent ecosystem check: not applicable because this is CI/repo
secret hygiene, not an agent capability.

## Drift Check

Evidence from `pnpm security:no-hardcoded-jwts` red run before remediation:

- `realtime/test-content-delivery.js:7`
- `realtime/test-content-delivery.js:8`
- `realtime/test-device-realtime.js:4`
- `realtime/test-end-to-end-streaming.js:7`
- `scripts/test-thumbnails-http.js:94`

The existing security audit job was advisory because `pnpm audit` uses
`continue-on-error`; it did not block this secret class.

## Scope

- Replace committed manual-script JWTs with required environment variables.
- Keep manual script behavior explicit: missing tokens fail fast with a clear
  message.
- Preserve local manual workflows by deriving playlist data from the
  authenticated API state where possible instead of requiring a repo-hardcoded
  playlist ID.
- Add a repository scan script that checks tracked text files for full
  JWT-shaped tokens.
- Run that script in the main CI security job and the scheduled security audit
  workflow before the advisory dependency audit.

## Manual Script Inputs

- `realtime/test-device-realtime.js`: `VIZORA_TEST_DEVICE_TOKEN`
- `realtime/test-end-to-end-streaming.js`: `VIZORA_TEST_DEVICE_TOKEN`
- `realtime/test-content-delivery.js`: `VIZORA_TEST_DEVICE_TOKEN`,
  `VIZORA_TEST_USER_TOKEN`; optional `VIZORA_TEST_DEVICE_IDENTIFIER`,
  `VIZORA_TEST_PLAYLIST_ID`, `VIZORA_TEST_CONTENT_ID`
- `scripts/test-thumbnails-http.js`: `VIZORA_TEST_DEVICE_TOKEN`

Fresh user/device tokens must belong to the same local organization and test
data set. If no playlist is available locally, set `VIZORA_TEST_PLAYLIST_ID` or
create a local playlist first.

The env source of truth is updated in `.env.example` and `CLAUDE.md`. There is
no tracked `AGENTS.md` file in this worktree to update.

## Out Of Scope

- Rotating any real token or secret. If these tokens were ever valid in shared
  or production-like environments, operator-owned revocation/rotation remains
  required.
- Making `pnpm audit` blocking. The dependency vulnerability backlog is larger
  than this pass and needs separate dependency-risk triage.
- Production deploy. Current production checkout is dirty/diverged and remains
  unsafe to deploy over.

## Verification Plan

- `pnpm security:no-hardcoded-jwts`
- `node --check scripts/security/check-no-hardcoded-jwts.js`
- `node --check` on each modified manual script.
- Realtime unit suite, because three changed scripts live under `realtime/`.
- `git diff --check`
- Multi-vector reviewer pass before broader tests:
  - Security/CI reviewer.
  - Script/runtime usability reviewer.
