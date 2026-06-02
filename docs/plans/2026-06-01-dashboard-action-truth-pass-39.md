# Dashboard Action Truth Pass 39

**Goal:** Prevent customer dashboard users from seeing controls that their role
cannot execute, and make primary list-load failures explicit instead of falling
through to empty states.

**New primitives introduced:** one small frontend permission helper. No backend
route, schema, env var, realtime substrate, notification path, MCP tool, Hermes
skill, provider spend path, or runtime process changes.

**Hermes-first analysis:** not applicable. This is dashboard UI state and tests,
not a business-agent, MCP, Hermes, AI/provider, or spend-path change.

## Drift Check

- Schedules already has a persistent `loadError` panel and suppresses its empty
  state while schedule data failed to load.
- Content, devices, and playlists still rely on toast-only primary list-load
  failures, so failed loads can look like truthful empty lists.
- Backend role contracts are already explicit with `@Roles`: content, devices,
  and playlists allow most create/update/assignment actions for admin/manager,
  but deletes are admin-only. Viewers are read-only on these list pages except
  content moderation/approval proposal affordances already exposed by backend.

## Scope

1. Add a shared web permission helper that mirrors the relevant backend role
   contracts for content, devices, playlists, and emergency override actions.
2. Gate content list actions: upload/folders/move/edit/push/add-to-playlist for
   admin/manager, delete for admin only, review for admin/manager, flag remains
   available where backend permits it.
3. Gate devices list actions: pair/edit/assign/group for admin/manager, delete
   and emergency override for admin only, fleet commands for admin/manager, and
   make inline playlist assignment read-only for viewers.
4. Gate playlist list actions: create/edit/assign/duplicate for admin/manager,
   playlist delete and playlist-item remove for admin only.
5. Add persistent primary load-error panels with Retry on content, devices, and
   playlists, and suppress misleading empty states while those errors are active.

## Test Plan

- Permission helper unit tests for admin, manager, viewer, and missing user.
- Focused React tests for viewer/manager/admin action visibility on content,
  devices, and playlists.
- Focused React tests proving primary list-load errors render an inline alert and
  do not render an empty-state message.
- Focused page suites, full web Jest suite, web build, diff check, and
  hardcoded-JWT scan before PR.

## Risks

- These pages are large. Keep changes localized to role booleans and existing
  render branches.
- Hiding controls improves truthfulness but backend authorization remains the
  source of enforcement.
