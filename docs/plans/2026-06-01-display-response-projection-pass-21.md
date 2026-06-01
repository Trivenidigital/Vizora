# Display Response Projection Pass 21

Date: 2026-06-01
Branch: `feat/customer-dashboard-improvements-pass-21`

## Why Now

Recent customer-readiness passes reduced dashboard content, playlist, pairing,
and socket pressure. A fresh drift check found that authenticated display
list/detail/update endpoints still return full Prisma `Display` rows. That can
include the hashed device JWT, pairing-code fields, and transient socket IDs,
even though dashboard customers only need safe display fields.

## New primitives introduced

One shared Prisma `select` module for display list/detail responses. No new
runtime service, route, database model, migration, agent, or infrastructure
primitive.

## Hermes-first analysis

Not applicable. This pass does not add business agents, MCP tools, Hermes
skills, AI/provider calls, or spend paths.

## Current Code Evidence

- `DisplaysService.findAll()` uses `include` without `select`, so Prisma returns
  all scalar display fields plus tags.
- `DisplaysService.findOne()` returns all scalar display fields plus related
  tags, groups, and active schedules.
- `DisplaysService.update()`, `updateQrOverlay()`, and `removeQrOverlay()`
  re-read the updated display via `findUnique()` without `select`.
- The dashboard list and detail pages use display identity, status, assignment,
  location, metadata, screenshot, and presentation fields, but do not need
  stored token hashes, pairing codes, or live socket IDs.

## Plan

- Add failing middleware tests proving display response queries use explicit
  safe projections and omit `jwtToken`, `pairingCode`, `pairingCodeExpiresAt`,
  and `socketId`.
- Add a shared `display-response.select.ts` with list/detail projections that
  preserve current dashboard and service behavior.
- Replace display list/detail/update/QR re-read queries with the shared
  projections.
- Run focused display service/controller tests, middleware type/build checks,
  reviewer passes, then broader middleware verification.

## Risks

- Internal service methods call `findOne()` for operational flows, so the detail
  projection must include fields those flows need: `deviceIdentifier`,
  `organizationId`, `status`, `metadata`, `lastScreenshot`, and
  `lastScreenshotAt`.
- Dashboard/detail consumers may depend on relation shape. The select keeps
  tags, groups, active schedules, and playlist scalar summaries with the same
  relation names.
- `generatePairingToken()` is the intentional one-time plaintext token path and
  must remain unchanged.
