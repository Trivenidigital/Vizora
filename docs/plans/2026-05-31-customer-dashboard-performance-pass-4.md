# Customer Dashboard + Performance Pass 4

Date: 2026-05-31
Branch: `feat/customer-dashboard-performance-pass`

## Goal

Move Vizora closer to customer-1 readiness by fixing repo-side issues found in the fresh customer, performance, and adversarial scans after PRs #123-#125 merged.

## New primitives introduced

None planned. Reuse existing Electron display client, NestJS controllers/services, realtime gateway, display web components, response envelope, and critical smoke script.

## Hermes-first analysis

This pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Display pairing/runtime | none applicable | Use existing Electron and middleware pairing paths. |
| Device schedule authorization | none applicable | Use existing device JWT and schedules controller/service. |
| Display content-error telemetry | none applicable | Use existing web display and realtime error path with redaction. |
| Customer dashboard upload UX | none applicable | Use existing Next dashboard content page and upload API client. |

Awesome-hermes-agent ecosystem check: not applicable to these display/dashboard/runtime fixes; no agent orchestration or skill runtime is being introduced.

## Findings Synthesized

High-priority buildable issues from reviewer scans:

- Electron display pairing does not unwrap Vizora's `{ success, data }` response envelope.
- `GET /api/v1/schedules/active/:displayId` accepts any valid same-org device JWT instead of enforcing the token subject matches the requested display.
- Display content-error messages can include authenticated media URLs with `token=` query params and then persist/export them via realtime Redis/Sentry.
- Critical smoke pairing-complete parsing still reads `display.id` instead of enveloped `data.display.id`.

Broader customer/performance backlog to address after this security/runtime bundle:

- Bulk upload queue is sequential, lacks per-file progress, and can upload queued files under the wrong content type after type changes.
- Existing-device dashboard "Pair" flow renders `pairingCode` although the API returns `pairingToken`.
- Schedule conflict warnings render but are never populated from `check-conflicts`.
- Mobile dashboard tables and builders need scroll/card fallbacks.
- Large dashboard list pages still fetch all pages and render full lists client-side.
- Streaming upload and cache-aware device media delivery remain larger architecture/performance follow-ups.

## Scoped Patch Plan

- Add Electron pairing envelope unwrapping and tests with enveloped pairing request/status fixtures.
- Enforce device JWT `sub === :displayId` in active schedule endpoint; reject missing/mismatched device identities and add controller tests.
- Validate active schedule display lookup as active same-org display before returning schedules.
- Redact `token` query params before web display UI/error strings, realtime Redis error storage, and Sentry extras; add focused unit tests.
- Fix critical smoke pairing-complete display id parsing with a backward-compatible fallback.

## Review and Verification

- Run focused tests for display device client, schedules controller/service, web display renderer, realtime gateway/heartbeat, and smoke syntax.
- Dispatch multiple read-only reviewers on the diff before broad tests.
- Run broader affected package tests/builds after review findings are clean or fixed.
- Open PR, wait for CI, merge only if clean.
- Re-check production deploy gate after merge. Do not deploy while `/opt/vizora/app` remains dirty/diverged.
