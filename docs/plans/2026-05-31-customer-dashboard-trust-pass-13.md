# Customer Dashboard Trust Pass 13

**Date:** 2026-05-31
**Branch:** `feat/customer-dashboard-trust-pass-13`

## Goal

Make the main dashboard more trustworthy for customer-1 by replacing fake
health/storage indicators with real repo-native data and reducing unnecessary
first-paint API pressure.

## New primitives introduced

- Dashboard-only storage info API client method for the existing
  `/api/v1/organizations/storage` endpoint.
- Dashboard readiness summary type for the existing `/api/v1/health/ready`
  endpoint.

## Hermes-first analysis

Not applicable. This pass does not add business agents, MCP tools, Hermes
skills, AI/provider calls, or spend paths.

## Customer Findings Addressed

- The dashboard says "Healthy / All systems operational" even when no real
  readiness probe has been loaded.
- Storage usage is estimated from `content count * 2.5 MB` and a hardcoded
  5 GB quota even though Vizora already tracks real storage usage and quota.
- The dashboard server fetches content/playlists for first paint, then the
  client immediately fetches the same complete paginated data again.

## Design

- Server-render the dashboard with initial content/playlists plus pagination
  completeness flags.
- Skip the client all-page content/playlist refresh on mount when the server
  response proves the first page is complete.
- Add `apiClient.getStorageInfo()` backed by existing
  `/organizations/storage`.
- Load storage info and health readiness on dashboard refresh.
- Render system status as Healthy, Degraded, Critical, or Unknown from the
  real readiness response instead of a fixed healthy card.
- Render exact storage usage/quota from storage quota data; show "Not reported"
  when unavailable.

## Tests

- Dashboard client tests for real storage usage rendering.
- Dashboard client tests for degraded/critical health rendering.
- Dashboard client tests proving content/playlists are not refetched on mount
  when SSR pagination is complete.
- Existing dashboard tests for partial refresh behavior remain valid.

## Review Results

- Customer-facing dashboard/UI review: CLEAN after fixing server-side unhealthy
  readiness handling and zero-quota storage copy.
- API/data/performance review: CLEAN after restoring the `UpgradeBanner` API
  mock and adding server-page coverage for pagination completeness.
- Follow-up UI/runtime review for the dashboard layout hydration fix: CLEAN.

## Verification Results

- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard-(page|server-page)"` — 2 suites / 18 tests pass.
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern=server-api` — 1 suite / 3 tests pass.
- `pnpm --filter @vizora/web exec tsc --noEmit --pretty false` — pass.
- `ESLINT_USE_FLAT_CONFIG=false npx eslint ...changed web files...` — 0 errors,
  19 existing `any` warnings in touched dashboard/API files.
- `npx nx build @vizora/web` — pass.
- `pnpm --filter @vizora/web test -- --runInBand` — 95 suites / 977 tests pass;
  unrelated existing act warnings remain in non-dashboard suites.
- Browser smoke against `next start` on `localhost:3001`: desktop and mobile
  dashboard render with no page errors after the dashboard layout hydration fix.
  Screenshots: `logs/dashboard-pass13-desktop.png` and
  `logs/dashboard-pass13-mobile.png`.
