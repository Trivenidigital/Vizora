# Dashboard Summary Performance Pass 15

Date: 2026-05-31
Branch: `feat/customer-dashboard-pass-15`

## Context

PR #137 moved the content library to bounded server-side pagination and
filtering. The next customer-visible dashboard performance issue is now the
overview page: it still performs all-page content and playlist refreshes on the
client when the server-rendered first page is incomplete. For real customer
libraries, this recreates the same "load every row to show one dashboard" risk
that Pass 14 removed from the content library.

## New primitives introduced

Extend the existing `GET /api/v1/analytics/summary` response with two aggregate
dashboard counters:

- `processingContent`
- `activePlaylists`

No new service, module, worker, PM2 process, env var, or datastore is added.

## Hermes-first analysis

Not applicable. This pass does not add business agents, MCP tools, Hermes
skills, AI/provider calls, or spend paths.

## Customer Dashboard Improvement List

Ranked repo-side improvements a paying customer would notice:

1. **Overview speed at scale** — the dashboard overview should show totals
   from aggregate endpoints and load only recent activity samples, not every
   content/playlist row.
2. **Recent activity trust** — activity cards should use fresh bounded samples
   and device realtime state without blocking the page on large libraries.
3. **Pairing confidence** — pairing pages should keep copy and token lifecycle
   clear; most recent work already closed the obvious pairing-code drift.
4. **Content upload confidence** — uploads now use disk-backed temp files and
   bounded concurrency; future work is resumable/direct upload, which is larger.
5. **Critical-path smoke confidence** — prod smoke remains operator-gated, but
   repo-side smoke should stay aligned with upload, pairing, streaming, playlist,
   and schedule paths.

## Selected Slice

Replace dashboard overview all-page content/playlist refreshes with:

- `GET /analytics/summary` for aggregate totals.
- `GET /content?page=1&limit=3` for recent content activity.
- `GET /playlists?page=1&limit=3` for recent playlist activity.
- Existing storage and readiness probes unchanged.

The analytics summary remains tenant-scoped through the existing
`CurrentUser('organizationId')` path. Summary read access should include
`viewer`, matching the read-only nature of dashboard overview counts.

## Implementation Plan

- Add failing backend tests proving summary returns `processingContent` and
  `activePlaylists` using aggregate/count queries.
- Add failing dashboard tests proving overview does not fetch beyond the first
  small sample page and gets totals from `getAnalyticsSummary`.
- Extend analytics summary DTO/types and controller role access.
- Update dashboard server component and client component to pass/use
  `initialStats` and refresh via summary + bounded samples.
- Run focused middleware/web tests, reviewer checks, broader affected tests,
  build, CI, merge.

## Deploy Gate

Production deployment remains blocked because `/opt/vizora/app` is dirty and
diverged with unclassified local work. No prod pull, reset, stash, env edit,
service restart, DB mutation, or deploy should happen until that state is
preserved/promoted intentionally.
