# Analytics Truthfulness Pass 31 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the customer-facing analytics dashboard and analytics API honest about metrics that are estimated from current state instead of measured from historical telemetry, and close analytics relation lookups that can expose cross-tenant names from malformed impression rows.

**Architecture:** Preserve the existing NestJS analytics module, `/api/v1/analytics/*` routes, response envelope, web analytics hooks, and chart components. Add non-breaking provenance fields to analytics DTOs, keep array response shapes intact, add tenant predicates to related-row lookups, and update dashboard copy/export labels so estimated values are explicitly labeled rather than presented as live measured uptime, bandwidth, shares, unique playback devices, or engagement rankings.

**Tech Stack:** NestJS 11, Prisma via `@vizora/database`, Next.js 16 App Router, React Testing Library, Jest, Nx/pnpm.

---

## New Primitives Introduced

None. This pass adds optional metadata fields to existing analytics response shapes, tenant predicates to existing relation lookups, and copy/label changes in the existing dashboard. No migration, route, module, queue, realtime path, notification path, MCP tool, Hermes skill, provider spend path, or production process.

## Hermes-First Analysis

Not applicable. This pass does not add or modify business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths. The issue is an in-process analytics DTO and dashboard truthfulness concern.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Analytics dashboard copy/provenance | none applicable | Build in existing Vizora web/API code because this is product UI/API contract work. |
| Telemetry estimation labeling | none applicable | Build in existing analytics DTOs and consumers; do not introduce an agent/runtime. |

Awesome-Hermes ecosystem check: no applicable reusable skill for NestJS analytics provenance or Vizora dashboard copy; this remains native Vizora code.

## Drift Evidence

- `middleware/src/modules/analytics/analytics.service.ts` generates device metric history from display creation/current inventory and comments that uptime categories are simulated.
- `middleware/src/modules/analytics/analytics.service.ts` documents bandwidth as estimated from content file sizes and device count.
- `web/src/app/dashboard/analytics/page-client.tsx` currently labels the page as real-time performance metrics, labels the KPI as system uptime, titles the chart as device uptime timeline, and labels bandwidth as MB/s.
- `middleware/src/modules/analytics/analytics.service.ts` looks up related content, playlists, and display names by ID only after grouping impression rows by `organizationId`, so malformed rows can expose another tenant's related-row names.
- `web/src/lib/types.ts` analytics interfaces are out of sync with the current middleware DTOs, so frontend type safety does not describe the real API contract.

## Plan

- [ ] Capture plan-review findings from two subagents before test edits.
- [ ] Add failing middleware tests for analytics provenance:
  - `getSummary` returns `uptimePercentSource: 'current_online_ratio'`.
  - `getDeviceMetrics` marks points as estimated inventory-derived availability.
  - `getBandwidthUsage` marks points as estimated transfer volume with `unit: 'MB/day'`.
  - heartbeat-derived uptime endpoints mark 95/80/20 calculations as heuristic estimates.
  - content performance marks shares as untracked and impression/completion fields as measured from proof-of-play.
  - playlist performance marks assigned display count separately from unique playback devices.
  - `exportAnalytics` preserves those provenance fields.
- [ ] Add failing middleware tests for analytics tenant isolation:
  - content performance does not map a grouped impression to content owned by another organization.
  - playlist performance does not map a grouped impression to a playlist owned by another organization.
  - content metrics top-device names do not resolve displays owned by another organization.
  - proof-of-play CSV rows do not emit cross-tenant content or display names when a malformed impression points across orgs.
- [ ] Add failing web tests for customer-facing truthfulness:
  - Page subtitle no longer says "Real-time performance metrics and insights".
  - KPI label no longer says "System Uptime"; it says "Online Now" and uses current device count copy.
  - Device timeline title/note make estimation explicit.
  - Bandwidth title/note make estimation explicit and axis no longer says `MB/s`.
  - Content and playlist chart/export labels use impressions, average completion, assigned screens, and estimated transfer wording instead of views, shares, unique devices, top engagement, or measured throughput.
  - CSV export uses "Online Now %" rather than "Uptime %".
- [ ] Implement non-breaking analytics DTO metadata fields in `middleware/src/modules/analytics/dto/analytics-response.dto.ts`.
- [ ] Populate provenance fields in `AnalyticsService` and add tenant predicates to related-row lookups without changing roles, routes, or response envelope behavior.
- [ ] Update frontend analytics types to match current API shapes and new provenance fields.
- [ ] Update dashboard copy, chart labels, and CSV labels.
- [ ] Run two subagent diff reviews before broader verification.
- [ ] Run focused middleware and web tests.
- [ ] Run broader verification: relevant full Jest suites, TypeScript, lint, builds, `git diff --check`, and security guard.
- [ ] Open PR, wait for CI, merge if green.
- [ ] Re-check deployment gate; deploy only if production dirty/diverged state is resolved or explicitly approved with a reviewed runbook.

## Acceptance Criteria

- Customers can distinguish current-state ratios from true historical uptime.
- Estimated bandwidth cannot be confused with measured network throughput.
- Content and playlist charts do not claim shares, views, unique playback devices, or top engagement when those are not tracked.
- Malformed impression rows cannot leak other-tenant content, playlist, or display names through analytics endpoints or CSV.
- Empty/error states still distinguish "no data" from API failures.
- Existing analytics endpoints remain backward-compatible for current clients.
- No new telemetry, external provider, storage system, or background process is introduced.
