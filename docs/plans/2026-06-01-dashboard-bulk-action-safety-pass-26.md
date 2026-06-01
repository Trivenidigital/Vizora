# Dashboard Bulk-Action Safety Pass 26

**Goal:** Prevent destructive device bulk actions from firing without confirmation and make success feedback reflect authoritative backend counts.

**New primitives introduced:** none. This pass reuses the existing dashboard client pages, existing `ConfirmDialog`, existing display bulk REST endpoints, and existing response envelope/API client behavior.

**Hermes-first analysis:** not applicable. This pass does not add or modify business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

## Customer/Performance Findings From Pass 26 Review

1. Playlist cards expose a `Publish` action that only updates the playlist name, so customers can believe content is live when nothing changed on any display.
2. Device pairing copy conflicts between Help, the first-device pair page, and per-device repair tokens.
3. Dashboard overview guidance disappears after the first device, even if content, playlist, assignment, and schedule readiness are incomplete.
4. "Live on screen" actions rely mostly on toast feedback instead of visible delivery/preview confirmation.
5. Schedule conflict warnings remain advisory and conflict verification failures do not block or require explicit acknowledgement.
6. Devices/playlists/schedules still use load-all client-side pagination patterns with a hard 1,000-item cap.
7. Analytics page performs seven independent initial API loads; an aggregate endpoint/hook can reduce this to one route-level request.
8. Display image playback fetches images into JS blobs and bypasses the display preload/cache path.
9. Content bulk delete is one-click and handles partial failures poorly.
10. Device bulk actions ignore backend result counts and bulk delete has no confirmation.
11. Shared confirmation dialogs close before async destructive actions finish.
12. Dashboard auth/layout can render a protected shell after a syntactically valid but invalid cookie.

## Build Scope

This PR fixes findings 10 and 11. Findings 1-9 and 12 remain backlog for subsequent autonomous passes.

## Files

- Modify `web/src/components/ConfirmDialog.tsx`: await async confirmation handlers, disable buttons while pending, and close only after the handler resolves.
- Modify `web/src/components/__tests__/ConfirmDialog.test.tsx`: prove the dialog stays open while async confirmation is pending and closes after success.
- Modify `web/src/app/dashboard/devices/page-client.tsx`: add a bulk-delete confirmation dialog, use `{ deleted }`, `{ updated }`, and `{ added }` result counts in success toasts, and await reloads before clearing action loading.
- Modify `web/src/app/dashboard/devices/__tests__/devices-page.test.tsx`: prove bulk delete waits for confirmation and that bulk action toasts use backend counts.

## Plan

- [ ] Add failing `ConfirmDialog` async-confirmation test.
- [ ] Add failing devices page tests for bulk-delete confirmation and backend count toasts.
- [ ] Implement the shared confirmation pending state.
- [ ] Implement device bulk-action safety and authoritative feedback.
- [ ] Run focused web tests for `ConfirmDialog` and devices page.
- [ ] Request multi-vector review focused on UX/destructive-action safety and regression risk.
- [ ] Run broader web verification and open/merge PR if clean.
