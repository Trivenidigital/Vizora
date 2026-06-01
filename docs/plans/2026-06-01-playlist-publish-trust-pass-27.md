# Playlist Publish Trust Pass 27

**Goal:** Replace the playlist page's misleading publish action with a real device-assignment flow or clearly block when assignment cannot happen.

**New primitives introduced:** none. This pass reuses the existing dashboard playlists page, loaded display list, `apiClient.bulkAssignPlaylist`, middleware display bulk assignment endpoint, and realtime display notification path.

**Hermes-first analysis:** not applicable. This pass does not add or modify business agents, MCP tools, Hermes skills, AI/provider calls, or spend paths.

## Problem

The playlist card currently exposes `Publish`, but the handler only calls `updatePlaylist(playlist.id, { name: playlist.name })` and shows `Playlist published successfully`. That does not assign the playlist, schedule it, push content, or change a meaningful publish state. Customers can believe content is live when nothing changed on any display.

## Build Scope

- Replace fake publish behavior with an assignment modal that lets the operator choose target devices.
- Block assignment with clear messages when the playlist has no items, devices are still loading, device loading failed, or there are no paired devices.
- Use `bulkAssignPlaylist` and show the backend `{ updated }` count in the success toast.
- Use assignment copy instead of live-delivery copy, and make non-online targets explicit as updating when they come online.
- Refresh devices after assignment so card device counts update.

## Files

- Modify `web/src/app/dashboard/playlists/page-client.tsx`: add assignment modal state, target selection, real bulk assignment, and safer button copy.
- Modify `web/src/app/dashboard/playlists/__tests__/playlists-page.test.tsx`: cover no fake PATCH, modal target selection, backend count toast, non-online copy, device-load guards, in-flight close protection, and empty prerequisites.
- Modify shared display status types and `DeviceStatusIndicator` so the frontend reflects backend statuses (`online`, `offline`, `pairing`, `error`).
- Modify `tasks/todo.md`: track Pass 27 plan/evidence.

## Plan

- [x] Add failing playlist tests for fake publish removal and real device assignment.
- [x] Implement assignment modal and bulk assignment using existing display API method.
- [x] Run focused playlist tests.
- [x] Request two review vectors before broader tests: customer trust/UX and runtime/API safety.
- [x] Run broader web verification.
- [ ] PR, CI, merge if clean.
- [ ] Re-check production deploy gate; deploy only if prod checkout is safe.
