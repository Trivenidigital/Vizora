# Pairing Active Index Pass 47

**Date:** 2026-06-02

**Branch:** `feat/dashboard-customer-readiness-pass-47`

## Goal

Remove the remaining dashboard pairing hot-path scan by indexing active pairing
codes per organization in Redis. This keeps display pairing responsive when many
pairing requests exist in a shared/demo environment.

## Source-of-Truth Check

- Current `origin/main` already streams device content with byte ranges and
  `pipeline()`, so the old media-buffering concern is stale.
- Current dashboard overview fetches `/health/ready`, so the old hard-coded
  healthy card concern is stale.
- Current health page derives status from display records and no longer uses
  random telemetry.
- `PairingService.getActivePairings()` still scans all `pairing:*` keys on
  every org dashboard request, then reads and filters them.

## New Primitives Introduced

One Redis sorted-set key prefix inside the existing pairing service:

- `pairing-active-org:{organizationId}` -> sorted set of pairing-code members
  scored by `expiresAt` epoch milliseconds, with a 5-minute sliding TTL.

No new database model, migration, NestJS module, route, env var, PM2 process,
response shape, auth guard, realtime path, MCP tool, Hermes skill, or AI spend
path.

## Hermes-First Analysis

This is request-serving middleware performance, not an agent or MCP task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard pairing Redis index | none applicable | build in existing `PairingService` |
| Pairing tenant visibility | none applicable | preserve existing service-level visibility rules |

Awesome-Hermes ecosystem check: no relevant Hermes runtime primitive applies to
an in-process NestJS Redis index for dashboard pairing reads.

## Design

- When a display requests a pairing code and its `deviceIdentifier` belongs to
  an existing unpaired display, add the code to that display organization's
  active-pairing zset.
- Keep brand-new unclaimed pairing requests out of org indexes so they remain
  visible only on the physical display polling its own code.
- Keep completed pairing records hidden from dashboard lists. On completion or
  status handoff cleanup, remove the code from the org-specific active zset when
  present.
- Change `getActivePairings(organizationId)` to prune expired zset members,
  read active code members via `ZRANGEBYSCORE`, batch-read the corresponding
  primary `pairing:{code}` records, and return pending, unexpired records whose
  stored `activePairingOrganizationId` still matches the requesting org.
- Keep the current DB ownership recheck before exposing a code. Redis is only
  the candidate source; it is not trusted as the tenant authority because display
  ownership or identifiers can change while the five-minute pairing TTL is live.
- Leave the periodic expired-request cleanup as a safety net. It can keep using
  the global scan because it is background maintenance, not a dashboard request.

## Plan

- [x] Add red pairing service coverage proving `getActivePairings()` uses the
  org-specific zset and does not call Redis `SCAN`.
- [x] Add red coverage proving indexed completed pairings are removed/hidden.
- [x] Implement active-index helpers in `PairingService`.
- [x] Update pairing request storage to index only existing unpaired displays.
- [x] Update completion and status cleanup paths to remove the index.
- [x] Run focused pairing service tests.
- [x] Run multi-vector subagent review for tenant/security and performance.
- [x] Run broader middleware verification and build.
- [ ] Open PR, wait for CI, merge if green.
- [ ] Recheck production deploy gate; deploy only if the dirty/diverged
  production checkout is made safe.

## Risks

- Missing a code in the org index would hide it from the dashboard active-list
  panel, but the display still shows the pairing code and the authenticated
  dashboard pairing form can still complete it manually.
- Leaving a stale org-index member after completion could waste a Redis read
  until TTL expiry. The service still reads the primary pairing request and skips
  completed records, so stale index members do not expose completed tokens.
- Existing active pairing requests created before this change may not appear in
  the dashboard active-list panel after deploy. TTL is five minutes; avoiding a
  fallback global scan keeps the hot path fixed.

## Verification

- Focused red/green: `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/displays/pairing.service.spec.ts`
- Broader middleware slice: `pnpm --filter @vizora/middleware test -- --runInBand middleware/src/modules/displays/pairing.service.spec.ts middleware/src/modules/displays/pairing.controller.spec.ts`
- TypeScript: `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
- Full middleware: `pnpm --filter @vizora/middleware test -- --runInBand`
- Build: `npx nx build @vizora/middleware`
