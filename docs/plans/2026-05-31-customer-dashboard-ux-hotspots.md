# Customer Dashboard UX Hotspots Plan

**Goal:** Fix two customer-visible dashboard issues: existing-device pairing shows `N/A` because the frontend expects the wrong field, and bulk uploads are sequential, progress-blind, and can upload files under the wrong type.

**New primitives introduced:** none. This reuses the existing dashboard client, `ApiClient`, `/content/upload` XHR progress path, and `/displays/:id/pair` response.

**Hermes-first analysis:** not applicable; this pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

## Evidence

- `middleware/src/modules/displays/displays.service.ts` returns `pairingToken`, `expiresIn`, `displayId`, and `deviceIdentifier` from existing-device pairing.
- `web/src/lib/api/displays.ts` types `generatePairingToken()` as `{ pairingCode: string }`.
- `web/src/app/dashboard/devices/page-client.tsx` renders `response.pairingCode || 'N/A'`, so customers cannot see the returned token.
- `web/src/app/dashboard/content/page-client.tsx` stores only `{ file, status, progress }` in the queue.
- Bulk upload uses `apiClient.createContent({ type: uploadForm.type, file })`, so queued files can be uploaded with a different type if the customer changes the selector after queuing.
- Bulk upload runs sequentially and never uses the existing `uploadContentWithProgress()` helper.

## Design

1. Pairing contract
   - Update `generatePairingToken()` return type to include the backend fields, with optional `pairingCode` only as a legacy fallback.
   - Render `pairingToken || pairingCode || 'N/A'`.
   - Rename modal copy from "Pairing Code" to "Pairing Token" and show the actual expiry returned by the backend when available.

2. Bulk upload queue
   - Add a per-item `type` captured when files are dropped.
   - Disable the content-type selector, dropzone, clear, and item remove buttons while uploads are running.
   - Use `apiClient.uploadContentWithProgress()` for queued files so each row receives progress updates.
   - Upload with a small bounded worker pool (`BULK_UPLOAD_CONCURRENCY = 3`) to improve throughput without firing unbounded uploads.
   - Preserve the modal on partial failure, show success/error counts, and refresh content if at least one file uploaded.

3. Tests
   - Add a devices page regression test proving the pairing modal renders backend `pairingToken`, not `N/A`.
   - Add content page tests proving queued files keep their original type after the selector changes and use `uploadContentWithProgress`.
   - Add a content page test proving Clear All/remove controls are disabled while queued upload is in progress.

## Verification

- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="devices-page|content-page"`
- `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`
- `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 npx nx build @vizora/web`
- Multi-agent review before broader tests.

## Deploy Gate

Deployment remains blocked until production `/opt/vizora/app` dirty/diverged work is classified. This branch must not pull/reset/stash/restart production services.
