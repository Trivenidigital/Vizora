# Fleet Control — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Scope:** L6 (Emergency Override), L7 (Remote Reload), M6 (Remote Restart), M7 (Push-to-Group)

---

## Problem

The dashboard has no way to send commands to devices. Admins cannot remotely reload, restart, or push emergency content. The command infrastructure exists in the realtime gateway (DeviceCommand types, Redis queue, heartbeat polling) but there are no API endpoints to trigger commands, no dashboard UI, and several device-side handlers are stubs.

## Solution

A unified fleet control system: one API endpoint for all commands, group targeting, emergency content override with auto-revert, and dashboard UI for fleet management.

---

## API Design

### POST /api/v1/fleet/commands

Send a command to one device, a device group, or all org devices.

**Auth:** JWT user token. `admin` or `manager` role required. Emergency override (`priority: 'emergency'`) requires `admin`.

**Request:**
```json
{
  "command": "reload | restart | reboot | clear_cache | push_content",
  "target": {
    "type": "device | group | organization",
    "id": "string"
  },
  "payload": {
    "contentId": "string (push_content only)",
    "duration": 60,
    "priority": "normal | emergency"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "commandId": "uuid",
    "command": "push_content",
    "target": { "type": "group", "id": "grp_123" },
    "devicesTargeted": 12,
    "devicesOnline": 8
  }
}
```

**Validation:**
- `command` must be a valid DeviceCommand type
- `target.id` must belong to the user's organization
- `push_content` requires `payload.contentId` (must exist and belong to org)
- `payload.duration` defaults to 60 minutes, allowed values: 15, 30, 60, 120, 240
- `payload.priority` defaults to `'normal'`

**Target resolution (middleware):**
- `device` → single deviceId passed to realtime gateway
- `group` → query DisplayGroupMember table for member deviceIds
- `organization` → pass orgId; gateway resolves all org device IDs from Redis and emits to each `device:{id}` room individually (not the `org:{orgId}` room, which contains dashboard clients)

### GET /api/v1/fleet/overrides/active

Returns active emergency overrides for the authenticated user's organization.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "commandId": "uuid",
      "contentId": "content_123",
      "contentTitle": "Fire Evacuation Notice",
      "targetType": "group",
      "targetId": "grp_456",
      "targetName": "Lobby Displays",
      "duration": 60,
      "startedAt": "2026-03-20T14:30:00Z",
      "expiresAt": "2026-03-20T15:30:00Z",
      "startedBy": "admin@company.com"
    }
  ]
}
```

### DELETE /api/v1/fleet/overrides/:commandId

Clear an active override early. Sends `CLEAR_OVERRIDE` command to all affected devices.

**Auth:** `admin` role required.

**Response:**
```json
{
  "success": true,
  "data": { "commandId": "uuid", "devicesNotified": 8 }
}
```

---

## Internal Gateway API

### POST /api/commands/broadcast

Internal endpoint on realtime gateway (port 3002). Authenticated via `x-internal-api-key` header (value = `INTERNAL_API_SECRET` env var).

**Request:**
```json
{
  "deviceIds": ["dev_1", "dev_2"],
  "command": {
    "type": "push_content",
    "payload": { "content": {...}, "duration": 60, "priority": "emergency" },
    "commandId": "uuid"
  }
}
```

**Architecture note:** All target resolution (device/group/org → deviceIds array) happens in the middleware `FleetService`. The gateway receives a flat `deviceIds[]` and iterates it. No `broadcastToOrg` flag — keeps the gateway stateless and simple.

**Behavior:**
- Iterate `deviceIds`, emit `command` event to each `device:{id}` room
- Check room membership to determine if device is online
- For offline devices → queue command in Redis (`device:commands:{deviceId}`, 5-min TTL via existing `addDeviceCommand`)
- Returns `{ devicesOnline: number }` so middleware can calculate online vs queued

---

## Override Tracking (Redis)

Active overrides stored as ephemeral Redis keys with TTL matching the override duration.

**Override record:**
```
Key:   override:{orgId}:{commandId}
Value: JSON { commandId, contentId, contentTitle, targetType, targetId,
              targetName, duration, startedAt, expiresAt, startedBy, deviceIds }
TTL:   duration in seconds
```

**Device reverse index (for per-device banner lookups):**
```
Key:   device:override:{deviceId}
Value: commandId
TTL:   same as override duration
```

**Lifecycle:**
1. `POST /fleet/commands` with `push_content` + `priority: emergency` → creates Redis keys
2. `GET /fleet/overrides/active` → scans `override:{orgId}:*` keys
3. `DELETE /fleet/overrides/:commandId` → deletes keys, sends `CLEAR_OVERRIDE` to devices
4. TTL expiry → Redis auto-deletes keys; device auto-reverts via its own timer

No server-side cron or cleanup needed. Redis TTL handles expiration. Device-side timer handles content revert.

**Data flow for override keys:** The middleware `FleetService` reads/writes override Redis keys directly using the same `REDIS_URL` connection. The middleware already has Redis access (rate limiter, session store). The `FleetService` will inject the middleware's `RedisService` (from `modules/redis/`) and use cursor-based `SCAN` for `override:{orgId}:*` pattern queries. Override creation and deletion happen in middleware. The realtime gateway does NOT manage override keys — it only receives broadcast commands.

---

## Device-Side Changes

### Electron Client (`display/src/electron/device-client.ts`)

**Fix `handleCommand()` method:**

```
case 'reload':
  // Already implemented — mainWindow.reload()

case 'restart':
  // Currently a stub. Fix:
  app.relaunch();
  app.exit(0);

case 'push_content':
  // New handler:
  // 1. Save current playlist/content state to local variable
  // 2. Display pushed content (set window URL or load content)
  // 3. Start revert timer: setTimeout(() => restorePlaylist(), duration * 60000)
  // 4. Store timer reference for early cancellation

case 'clear_override':
  // New handler:
  // 1. Cancel revert timer if active
  // 2. Restore saved playlist/content state
  // 3. Resume normal playback

case 'reboot':
  // Not implementing this sprint — too risky without proper testing
```

**Auto-revert logic:**
- Device stores `overrideState: { previousContent, revertTimer, commandId }` in memory
- On `push_content` with duration: if an existing override is active, clear its timer first (last-writer-wins policy), then save state and set new `setTimeout` for auto-revert
- On `clear_override`: clear timeout, restore previous state
- On disconnect/reconnect: `sendInitialState()` in the gateway must check for active `device:override:{deviceId}` key. If found, skip sending `playlist:update` and instead send the override command immediately — this prevents a visible flicker where the device briefly shows its normal playlist before the override kicks in via heartbeat
- If device restarts during override: override is lost (acceptable — device loads its playlist normally)

**Concurrent override policy: last-writer-wins.** If a second emergency override targets an already-overridden device, the second override replaces the first. The device clears any existing revert timer before setting the new one. The Redis `device:override:{deviceId}` key is overwritten with the newest `commandId`. This is explicitly the intended behavior — the most recent emergency is the most important.

---

## Dashboard UI

### 1. Fleet Command Dropdown (Devices page toolbar)

Location: next to existing "Pair New Device" button.

```
[Pair New Device]  [Fleet Commands ▼]  [Emergency Override]
```

Dropdown items:
- Reload All Devices → confirmation dialog → POST /fleet/commands { command: 'reload', target: { type: 'organization', id: orgId } }
- Restart All Devices → confirmation dialog (stronger warning) → same with `restart`
- Clear Cache All → confirmation dialog → same with `clear_cache`

### 2. Emergency Override Button

Red/danger styled button. Opens modal:

**EmergencyOverrideModal:**
- Content picker: dropdown of org's content items (fetched from existing content API)
- Target selector: radio group — "All Devices" / "Device Group" (shows group dropdown) / "Single Device" (shows device dropdown)
- Duration selector: radio pills — 15m / 30m / **1h** (default) / 2h / 4h
- Warning text: "This will immediately interrupt current content on targeted devices"
- Actions: "Push Emergency Content" (red button) / Cancel

### 3. Active Override Banner

If `GET /fleet/overrides/active` returns items, show a banner at top of devices page:

```
[!] Emergency override active: "Fire Evacuation Notice" on Lobby Displays
    Expires in 47 minutes                                    [Clear Override]
```

Red background, white text. "Clear Override" calls `DELETE /fleet/overrides/:commandId`.

### 4. Per-Device Action Buttons

Add to the device table row actions (existing action buttons column):
- Reload icon button (with tooltip)
- Restart icon button (with confirmation dialog)

These send commands to individual devices via the same `/fleet/commands` endpoint with `target.type: 'device'`.

### 5. Command Response Toast

After any command, show toast: "Command sent to 12 devices (8 online, 4 queued)"

---

## Type Additions

Add to `realtime/src/types/index.ts` `DeviceCommandType` enum:
```typescript
CLEAR_OVERRIDE = 'clear_override'
```

---

## Existing Endpoint Deprecation

The existing `POST /api/v1/displays/{displayId}/push-content` endpoint remains functional but is considered legacy. The fleet system (`POST /fleet/commands` with `push_content`) is the preferred path for all content pushing. The legacy endpoint does NOT create override tracking keys in Redis, so content pushed via it will not appear in the "Active Overrides" UI and cannot be cleared via the fleet system. This is acceptable — the legacy endpoint is for simple single-device pushes without emergency semantics.

---

## New Files

### Middleware
- `middleware/src/modules/fleet/fleet.module.ts` — NestJS module
- `middleware/src/modules/fleet/fleet.controller.ts` — 3 endpoints
- `middleware/src/modules/fleet/fleet.service.ts` — target resolution, gateway calls, override tracking
- `middleware/src/modules/fleet/dto/send-command.dto.ts` — validation DTO
- `middleware/src/modules/fleet/fleet.controller.spec.ts` — unit tests
- `middleware/src/modules/fleet/fleet.service.spec.ts` — unit tests

### Realtime Gateway
- `realtime/src/controllers/commands.controller.ts` — internal broadcast endpoint
  (or add to existing `app.controller.ts` if small enough)

### Web Dashboard
- `web/src/components/fleet/FleetCommandDropdown.tsx`
- `web/src/components/fleet/EmergencyOverrideModal.tsx`
- `web/src/components/fleet/ActiveOverrideBanner.tsx`
- `web/src/lib/api/fleet.ts` — API client methods

### Modified Files
- `display/src/electron/device-client.ts` — fix command handlers (restart, push_content, clear_override)
- `web/src/app/dashboard/devices/page-client.tsx` — add fleet UI (dropdown, override button, banner)
- `web/src/lib/api/index.ts` — export fleet API methods
- `middleware/src/app.module.ts` — import FleetModule
- `realtime/src/app/app.controller.ts` — add broadcast endpoint
- `realtime/src/types/index.ts` — add CLEAR_OVERRIDE to DeviceCommandType enum
- `realtime/src/gateways/device.gateway.ts` — check active override in sendInitialState()

---

## Build Order

1. **Command infrastructure** — FleetModule, controller, service, DTO, gateway broadcast endpoint
2. **Remote reload (L7)** — wire through API, test with existing device handler
3. **Remote restart (M6)** — fix device handler stub, test
4. **Push-to-group (M7)** — group target resolution, broadcast to multiple devices
5. **Emergency override (L6)** — push_content handler, Redis override tracking, dashboard UI, auto-revert

Each step validates the layer below it.

---

## Testing

**Middleware unit tests:**
- FleetController: auth guards, role checks, input validation
- FleetService: target resolution (device/group/org), gateway HTTP calls, override Redis operations
- Edge cases: nonexistent device, empty group, content not found, expired override

**Realtime unit tests:**
- Broadcast logic: emit to rooms, queue for offline devices
- Override Redis key management: create, scan, delete, TTL

**Web component tests:**
- FleetCommandDropdown: renders items, confirmation dialogs, API calls
- EmergencyOverrideModal: content picker, target selector, duration selector, submission
- ActiveOverrideBanner: renders when overrides exist, clear button, countdown

**Manual verification:**
- Start Electron client, send reload/restart commands from dashboard
- Push emergency content, verify display, verify auto-revert after duration
- Test with device offline then reconnecting (should receive queued command)

---

## Out of Scope

- `reboot` command (system-level reboot too risky without proper testing infrastructure)
- Sticky/permanent overrides (can add later if requested)
- Command audit log (existing AuditLog table could be wired later)
- Android TV / mobile client handlers (Electron only this sprint)
- Scheduled commands (future: "restart all devices at 3am")

---

## Security

- All fleet endpoints require authenticated JWT with `admin` or `manager` role
- Emergency override (`priority: 'emergency'`) restricted to `admin` only
- Target IDs validated against user's organization (no cross-org commands)
- Internal gateway endpoint authenticated via `INTERNAL_API_SECRET`
- Rate limiting: existing 3-tier rate limits apply to fleet endpoints
- Override Redis keys scoped to `orgId` prefix (no cross-org data leakage)
