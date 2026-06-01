# Dashboard Safety and Truth Pass 38

**Goal:** Improve customer trust in the dashboard by fixing small, high-impact
UI safety/truth gaps that are directly testable.

**New primitives introduced:** none. This pass changes existing React UI state,
copy, and tests only. It reuses the current dashboard components, API client,
toast path, confirmation dialog, and Jest/RTL test setup. No route, schema,
backend module, env var, realtime path, notification path, MCP tool, Hermes
skill, or runtime process changes.

**Hermes-first analysis:** not applicable. This is not a business-agent, MCP,
Hermes, AI/provider, or spend-path change.

## Drift Check

- `serverFetch` already reads `vizora_auth_token`, matching the backend auth
  cookie. The previous cookie-mismatch concern is stale.
- Device bulk deletion already uses `ConfirmDialog` before the API call.
- Content bulk deletion still calls `apiClient.deleteContent` immediately from
  the selected-items toolbar.
- Dashboard recent-activity subtitles use a Unicode bullet separator; switching
  to ASCII keeps the dashboard text consistent with repo editing constraints.
  The first-run guide says "Publish & Schedule" though the native action is
  assigning playlists and schedules, not a separate publish primitive.

## Broader Customer Improvement List

1. Safer destructive actions: content bulk delete needs a confirmation barrier.
2. Truthful wording: replace publish language where the product actually assigns
   playlists/schedules; use ASCII separators in dashboard activity copy.
3. Permission clarity: keep auditing viewer/admin action visibility across
   content, playlists, schedules, and templates after pass 36.
4. Critical-path status clarity: keep dashboard health/storage cards tied to
   actual API results, not optimistic placeholders.
5. Performance follow-ups: continue investigating content streaming, upload
   memory use, pairing scans, playlist/device list pagination, and middleware
   sanitize overhead.

## Scope

1. Add a bulk-delete confirmation modal to the content page.
2. Keep the API call deferred until the user confirms.
3. Clear the modal and selection after success; keep existing error toast path.
4. Replace dashboard Unicode bullet separators with ASCII separators.
5. Rename the dashboard first-run step from "Publish & Schedule" to
   "Assign & Schedule".

## Test Plan

- Focused content page tests for the new bulk-delete confirmation barrier.
- Focused dashboard tests for clean activity separators and truthful onboarding
  copy.
- Relevant web Jest suites for content and dashboard.
- `git diff --check`.

## Risks

- Content page is a large component; keep the change minimal and avoid unrelated
  refactors.
- This pass does not resolve backend performance follow-ups. Those need separate
  measured work once the read-only performance review returns.
