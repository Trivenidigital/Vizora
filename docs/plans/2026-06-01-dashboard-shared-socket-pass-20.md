# Dashboard Shared Socket Performance Pass 20

Date: 2026-06-01
Branch: `feat/dashboard-customer-improvements-pass-20`

## Why Now

Recent performance passes reduced content, playlist, pairing, and dashboard
payload pressure. The remaining current-branch dashboard hot path is realtime:
notification bell, device status context, page-level `useRealtimeEvents`, and
device preview each call `useSocket` independently. A customer sitting on the
dashboard can therefore create multiple Socket.IO client connections for one
org, multiplying reconnect attempts and realtime listener work.

## New primitives introduced

One dashboard-scoped `SocketProvider` in the existing `useSocket` module. It
does not add a new transport, gateway, event type, process, or backend route.

## Hermes-first analysis

Not applicable. This pass does not add business agents, MCP tools, Hermes
skills, AI/provider calls, or spend paths.

## Current Code Evidence

- `useSocket` constructs a new Socket.IO client for every hook instance.
- `NotificationBell` uses `useNotifications`, which calls `useSocket`.
- `DeviceStatusProvider` calls `useSocket` to listen for device status events.
- Dashboard pages call `useRealtimeEvents`, which calls `useSocket`.
- `DevicePreviewModal` calls `useSocket` for screenshot events.
- `DashboardLayout` already has the authenticated user/org context needed to
  provide one shared dashboard socket.

## Plan

- Add focused tests proving multiple dashboard consumers under `SocketProvider`
  share one Socket.IO client and still register independent listeners.
- Keep standalone `useSocket` behavior for callers outside the provider and for
  explicit custom options such as `autoConnect: false` or custom URLs.
- Wrap dashboard chrome and page content in `SocketProvider user={user}` so the
  notification bell, device status provider, page realtime hooks, and preview
  modal share the same org-scoped socket.
- Preserve existing auth, room-join, reconnect cooldown, and callback APIs.
- Run focused hook/layout tests, then broader web verification and build.

## Risks

- Realtime listeners from independent components must not overwrite each other.
  Mitigation: provider returns the same `on/off` API and tests register multiple
  listeners on one client.
- Explicit standalone socket use must remain possible. Mitigation: `useSocket`
  falls back to the standalone lifecycle for `autoConnect: false`, custom URLs,
  and custom reconnection options.
- The dashboard layout renders before auth resolves. Mitigation: provider uses
  `autoConnect: !!user` and reconnects only when the user/org becomes available.
