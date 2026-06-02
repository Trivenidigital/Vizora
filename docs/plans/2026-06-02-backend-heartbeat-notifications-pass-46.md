# Backend Heartbeat and Notification Scoping Pass 46

**Date:** 2026-06-02

**Branch:** `fix/backend-heartbeat-notifications-pass-46`

**Goal:** Fix two customer-impact backend correctness gaps: REST device heartbeats should update by verified display id, and notification read/realtime surfaces should not expose or mutate another user's personal notifications.

**New primitives introduced:** none. Reuse the existing device JWT verification helper, DisplaysService heartbeat path, Notification model, response envelope, `/api/v1` routing, and `@CurrentUser` identity extraction.

**Hermes-first analysis:** checked per project convention. These are local middleware identity/tenant-boundary fixes, not business-agent, MCP, Hermes runtime, or AI/provider-spend tasks.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| REST display heartbeat identity semantics | none found | build in existing displays controller/service path |
| Notification user visibility and mutation scoping | none found | build in existing notifications controller/service path |
| Targeted realtime notification delivery | none found | build in existing Socket.IO org-room delivery path |

Awesome-hermes-agent ecosystem check: no applicable skill/library primitive for NestJS route identity alignment, local Prisma notification filters, or Socket.IO room filtering; proceed with Vizora-native code.

## Evidence Before Code

- `middleware/src/modules/displays/displays.controller.ts` verifies the `:deviceId` route parameter as `expectedDisplayId` through `verifyCurrentDeviceToken`, whose payload `sub` is a display id and whose database lookup is `display.findUnique({ where: { id: payload.sub } })`.
- The same controller passes that route parameter to `DisplaysService.updateHeartbeat()`.
- `middleware/src/modules/displays/displays.service.ts` currently names the parameter `deviceIdentifier` and queries `where: { deviceIdentifier }`, so a normal display UUID route cannot update heartbeat unless it happens to equal the hardware identifier.
- Heartbeat verification and write are separate operations; the write site must carry the verified organization id and token hash so disable/re-pair/token-rotation races cannot set stale devices back online.
- `middleware/src/modules/notifications/notifications.controller.ts` currently passes only `organizationId` to list/count/read/dismiss methods.
- `middleware/src/modules/notifications/notifications.service.ts` currently scopes `findAll`, `findOne`, and mutations only by `organizationId`; `getUnreadCount` filters dismissed rows but still lacks user visibility; `findAll` lacks a `dismissedAt: null` predicate before pagination.
- `realtime/src/gateways/device.gateway.ts` currently emits all `notification:new` payloads to every socket in the org room, so user-targeted notifications can leak live even after REST scoping is fixed.

## Plan

- [ ] Add red display service coverage proving `updateHeartbeat(displayId)` queries and updates by display id even when the display's `deviceIdentifier` differs.
- [ ] Add red display service coverage proving heartbeat writes re-check the verified org id, token hash, and enabled state at the update site.
- [ ] Add red notification service coverage proving list/count/read/read-all/dismiss use `organizationId + currentUserId` visibility: org-wide rows (`userId: null`) plus the current user's rows only, with `dismissedAt: null` applied before pagination/mutation.
- [ ] Add red notification controller coverage proving current user id is forwarded to service methods.
- [ ] Add red realtime coverage proving `notification:new` with `userId` only emits to the matching dashboard socket.
- [ ] Implement the minimal service/controller changes.
- [ ] Implement targeted realtime delivery without changing org-wide notification broadcasts.
- [ ] Run focused middleware tests for displays and notifications.
- [ ] Run focused realtime gateway tests.
- [ ] Run multi-vector subagent diff review for identity/security and runtime/regression risk.
- [ ] Run broader middleware tests, TypeScript, lint on changed files, build, security check, and diff check.
- [ ] Open PR, wait for CI, merge if green.
- [ ] Recheck production deploy gate; deploy only if the dirty/diverged production checkout is made safe.

## Residual Non-Goals

- This pass does not add per-user read/dismiss state for org-wide notifications; those rows still have shared `read` and `dismissedAt` columns until a new per-user state table is designed.
- This pass does not add content-search indexes, pairing-list Redis scan optimization, or CI/deploy health-route fixes. They remain queued next-pass candidates.
