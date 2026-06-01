# Pairing Active List Performance Pass 16

Date: 2026-05-31
Branch: `feat/device-content-streaming-pass-16`

## Context

The next customer-visible performance target is the pairing path. The old
device-content concern that middleware buffered media into memory is stale on
current `origin/main`: `DeviceContentController` already opens MinIO streams,
supports range requests, handles 304 validators before stream acquisition, and
uses `pipeline(stream, res)`.

The residual repo-side bottleneck is `PairingService.getActivePairings()`. It
scans Redis pairing keys, then reads each key and, for unclaimed devices, queries
the display table one request at a time. A busy customer install or shared demo
environment can turn the dashboard pairing panel into serial Redis and DB work.

Production deployment remains blocked by dirty/diverged prod-local state. This
pass is repo-side until the deploy gate is made safe.

## New Primitives Introduced

No new service, module, Redis topology, schema, env var, or PM2 process.

Small helper logic inside existing `PairingService` only:

- batch Redis value reads for scanned pairing keys with `MGET`
- batch display ownership lookup with a single tenant-preserving `findMany`

## Hermes-First Analysis

Not applicable. This pass does not add business agents, MCP tools, Hermes
skills, AI/provider calls, spend paths, or customer-lifecycle/support automation.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Device pairing dashboard performance | none applicable | Use existing NestJS pairing service and Redis substrate. |
| Redis read batching | none applicable | Build in the existing middleware service; Hermes is not in request serving. |

Awesome-Hermes ecosystem check: no relevant runtime serving or Redis batching
primitive applies to this middleware hot path.

## Drift Check

Current repo evidence:

- `middleware/src/modules/content/device-content.controller.ts` parses byte
  ranges, sets `Accept-Ranges`, and streams via `pipeline(stream, res)`.
- `middleware/src/modules/content/device-content.controller.spec.ts` covers
  range responses, 304-before-stream behavior, stale cache recovery, stream
  acquisition failure handling, and max-size rejection.
- `middleware/src/modules/displays/pairing.service.ts` still scans pairing keys,
  then calls `getPairingRequest()` and `display.findUnique()` inside the loop.

## Selected Fix

- Keep the existing pairing-key scan, TTL checks, and response shape.
- Read all scanned Redis values in one `MGET` call and parse them by key.
- For unclaimed pairing requests, lookup existing display ownership with one
  `display.findMany({ deviceIdentifier: { in: [...] } })` query.
- Preserve existing visibility semantics:
  - completed pairings show only to their organization
  - unclaimed pairings show when the device is brand new or already belongs to
    the current organization
  - expired or malformed Redis values are skipped

## Acceptance Criteria

- `getActivePairings()` no longer performs one Redis GET per scanned key when a
  Redis client is available.
- `getActivePairings()` performs at most one display ownership query for
  unclaimed active requests.
- Completed organization-scoped pairings do not trigger a display ownership
  query.
- Existing active/expired pairing tests continue to pass.
- No auth, tenant, pairing-token, or response-envelope behavior changes.

## Verification Plan

- Add failing unit tests for batched active-pairing reads and display ownership
  lookup.
- Run focused `pairing.service` tests for red/green.
- Run a reviewer gate before broader tests.
- Run the displays middleware test slice, then broader middleware verification
  and build if the diff review is clean.

## Deploy Gate

Do not deploy from this pass while `/opt/vizora/app` is dirty/diverged with
unclassified production-local work. No prod pull, reset, stash, service restart,
env edit, DB mutation, or deploy should happen until that state is preserved or
explicitly promoted with a reviewed runbook.
