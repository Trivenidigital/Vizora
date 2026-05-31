# Performance Readiness Pass 9 Plan

**Goal:** Fix a bounded set of customer-critical playback, pairing, and display recovery defects found by the pass 9 performance reviewers.

**Architecture:** Keep the work inside existing Vizora-native surfaces: `DeviceContentController`, realtime `DeviceGateway`, browser display hooks, and Electron display client. This pass intentionally avoids new infrastructure, new queues, new tables, and new agent/Hermes paths.

**Tech Stack:** NestJS middleware, Socket.IO realtime gateway, Next.js display client, Electron display client, Jest.

---

## Scope

**New primitives introduced:** none. The only new code should be small helper methods/constants inside existing modules.

**Hermes-first analysis:** not applicable to the selected implementation because this pass does not add business agents, MCP tools, Hermes skills, AI provider calls, or spend paths.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Device playback HTTP caching/ranges | none applicable | Build in existing middleware controller |
| Realtime heartbeat persistence | none applicable | Build in existing realtime gateway |
| Display pairing/token recovery | none applicable | Build in existing display clients |

Awesome-Hermes ecosystem verdict: not applicable; these are first-party runtime correctness/performance paths, not agent skills.

## Reviewer Findings

- Middleware/storage reviewer found large upload buffering, unsupported multi-range behavior, missing conditional validators, unbounded template data-source reads, and template refresh overlap risk.
- Pairing/realtime reviewer found stale Postgres heartbeats causing false offline status, `clear_cache` unpairing browser displays, and stale-token errors not resetting display clients.
- Frontend/dashboard reviewer found large content library all-fetching/rendering, bulk upload memory pressure, duplicate dashboard sockets, playlist index eager builder load, dashboard overview count fan-out, and pairing help copy drift.

## Selected Fix Bundle

This PR will fix the bounded items with tight regression coverage:

1. Device media requests reject unsupported multi-range headers with `416` instead of streaming the full object.
2. Device media responses set validators (`ETag`, `Last-Modified`) and honor authenticated `If-None-Match` / `If-Modified-Since` by returning `304` before opening a MinIO stream.
3. Device media successful responses use `private, no-cache` so displays can revalidate without serving stale protected media blindly.
4. Realtime heartbeat handling refreshes Postgres `lastHeartbeat` on a throttle while preserving the existing Redis-fast path.
5. Realtime stale-status cleanup treats `deviceSockets` keys as device IDs.
6. Browser display `clear_cache` clears the browser media cache without deleting pairing credentials.
7. Browser and Electron displays treat server `device_token_stale` / `device_not_found` socket errors as terminal pairing errors and reset stored device tokens.

## Deferred Follow-Ups

These are important but too large for this PR:

- Disk-backed/streaming upload pipeline and per-type frontend upload caps.
- Server-backed content library pagination/search and thumbnail virtualization/lazy loading.
- Shared dashboard socket provider to collapse duplicate Socket.IO clients.
- Playlist index summary payload and removal of dead builder-modal code.
- Dashboard overview summary/read-model endpoint.
- Pairing help copy update.
- Template/widget data-source response caps and template refresh overlap guard.
- Single-display queued push response contract.
- Electron media cache invalidation for replaced content.

## Verification Plan

Focused tests:

- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern=device-content.controller`
- `pnpm --filter @vizora/realtime test -- --runInBand --testPathPattern=device.gateway`
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="display"`
- `pnpm --filter @vizora/display test -- --runInBand device-client.spec.ts`

Broader checks after subagent code review:

- Middleware, realtime, web, and display type checks/builds where affected.
- `git diff --check`.
- PR CI before merge.

Deployment remains blocked unless the production checkout is clean/safe after merge.
