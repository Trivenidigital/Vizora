# Dashboard Role Truth Pass 43

Date: 2026-06-02
Branch: `feat/dashboard-role-truth-pass-43`

## Goal

Fix customer-visible dashboard trust issues that are repo-side and testable:

- Schedules must not advertise create/edit/duplicate/delete workflows to roles
  the backend rejects.
- Support chat must not silently remove customer text when a support request or
  message send fails, and retry must not duplicate durable support records.
- Realtime Docker builds must carry a generated Prisma client into the runtime
  image without relying on dev-only Prisma CLI availability there.

## New primitives introduced

One explicit dashboard permission pair: `canManageSchedules` and
`canDeleteSchedules`.

One support retry idempotency primitive: optional `clientMutationId` on
`support_requests` and `support_messages`, with scoped unique indexes for
durable retry deduplication.

No env var, runtime process, notification path, realtime substrate, MCP tool,
Hermes skill, provider spend path, or parallel infrastructure.

## Hermes-first analysis

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard role-based action gating | none found | build in existing web permission helper |
| Support chat failed-message state | none found | build in existing support chat provider/panel |
| Support retry idempotency | none found | build in existing support API/service with Prisma indexes |

Awesome-hermes-agent ecosystem check: no applicable runtime/library primitive
for React dashboard role gating or local support-chat failure state; proceed
with Vizora-native code.

## Drift Check

`web/src/app/dashboard/devices/page-client.tsx` already uses
`getDashboardPermissions` for pairing and device mutations, so the older device
pairing finding is stale and is not reopened in this pass.

`middleware/src/modules/schedules/schedules.controller.ts` gates schedule
create/update/duplicate/conflict-check to admin/manager and delete to admin.
`web/src/app/dashboard/schedules/page-client.tsx` currently renders schedule
mutation controls without checking role, so this is the concrete residual gap.

`SupportChatProvider` still removes the optimistic message on failed existing
conversation sends and clears messages on failed new conversation sends. This
is the concrete support-chat residual gap.

## Implementation Plan

1. Add red tests for schedule viewer/manager/admin action visibility.
2. Add red tests for failed support sends preserving visible customer text and
   retry/error context.
3. Extend `getDashboardPermissions` with schedule manage/delete permissions.
4. Gate schedule create/edit/duplicate/calendar-slot actions by
   `canManageSchedules`, and delete by `canDeleteSchedules`.
5. Preserve failed support messages as visible retryable/error bubbles instead
   of deleting them.
6. Review fix: use the existing backend schedule duplicate endpoint instead of
   duplicate-as-prefilled-create.
7. Review fix: prevent manager multi-device create batches that would require
   admin-only delete rollback.
8. Review fix: add support client mutation ids so failed-send retry is
   idempotent across ambiguous POST failures.
9. Review fix: generate the realtime Prisma client in the Docker builder stage
   and keep nested local workspace dependencies out of Docker build context.
10. Run focused web/middleware tests, broader relevant tests,
   typecheck/build/hygiene.
11. Dispatch orthogonal reviewers before PR/CI/merge.

## Deployment

Do not deploy unless production checkout is reconciled and safe. Current prod
state is dirty/diverged and blocks automated deploys.
