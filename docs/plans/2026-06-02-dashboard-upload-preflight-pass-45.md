# Dashboard Upload Preflight Pass 45

**Goal:** Reduce first-dashboard-load duplicate API work and prevent avoidable over-quota upload attempts before the browser sends file bytes.

**Branch:** `feat/customer-dashboard-improvement-pass-45`

**New primitives introduced:** none. Reuse existing server dashboard prefetches, `apiClient.getStorageInfo()`, `uploadContentWithProgress()`, content upload queue state, and dashboard Jest suites.

**Hermes-first analysis:** checked per project convention. This is local dashboard/browser behavior, not a business-agent, MCP, Hermes runtime, or provider-spend task.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard initial API refresh suppression | none found | build in existing `DashboardClient` |
| Browser upload quota preflight | none found | build in existing content upload UI using existing storage endpoint |

Awesome-hermes-agent ecosystem check: no applicable skill or library primitive for React dashboard hydration fetch suppression or browser-side storage quota preflight; proceed with Vizora-native code.

## Scope

- Skip the automatic client refresh on `/dashboard` when server rendering already supplied summary-derived stats, content sample, playlist sample, storage info, and readiness state.
- Keep the existing client recovery behavior when any initial server payload is missing.
- Before single or queued file uploads, fetch current organization storage once and fail fast if retryable file bytes exceed available quota.
- Do not change backend quota enforcement; backend remains authoritative for races or concurrent uploads.

## Files

- Modify: `web/src/app/dashboard/page-client.tsx`
- Modify: `web/src/app/dashboard/__tests__/dashboard-page.test.tsx`
- Modify: `web/src/app/dashboard/content/page-client.tsx`
- Modify: `web/src/app/dashboard/content/__tests__/content-page.test.tsx`
- Modify: `tasks/todo.md`

## Test Plan

1. Add a dashboard test proving no mount-time summary/content/playlist/storage/health refresh happens when all server data is complete.
2. Add dashboard regression coverage proving missing initial data still triggers recovery refresh.
3. Add content tests proving single and bulk over-quota uploads do not call `uploadContentWithProgress()`.
4. Run focused web tests:
   - `pnpm --filter @vizora/web test -- --runInBand web/src/app/dashboard/__tests__/dashboard-page.test.tsx web/src/app/dashboard/content/__tests__/content-page.test.tsx`
5. Run broader web verification:
   - `pnpm --filter @vizora/web test -- --runInBand`
   - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`
   - `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PUBLIC_SOCKET_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1 BACKEND_URL=http://localhost:3000 pnpm --filter @vizora/web build`
