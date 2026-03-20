# Fleet Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unified fleet command system enabling remote reload, restart, push-to-group, and emergency content override with auto-revert from the dashboard.

**Architecture:** Single `POST /api/v1/fleet/commands` endpoint on middleware resolves targets (device/group/org), calls realtime gateway's internal broadcast endpoint, which emits commands to individual `device:{id}` WebSocket rooms. Emergency overrides tracked in Redis with TTL-based auto-expiry. Device-side handlers process commands and manage auto-revert timers.

**Tech Stack:** NestJS (middleware + realtime), Socket.IO, Redis, Prisma, Next.js (dashboard), Electron (device client), class-validator DTOs

**Spec:** `docs/superpowers/specs/2026-03-20-fleet-control-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `middleware/src/modules/fleet/fleet.module.ts` | NestJS module registration |
| `middleware/src/modules/fleet/fleet.controller.ts` | 3 HTTP endpoints (commands, active overrides, clear override) |
| `middleware/src/modules/fleet/fleet.service.ts` | Target resolution, gateway calls, Redis override tracking, audit logging |
| `middleware/src/modules/fleet/dto/send-command.dto.ts` | Validation for POST /fleet/commands |
| `middleware/src/modules/fleet/fleet.controller.spec.ts` | Controller unit tests |
| `middleware/src/modules/fleet/fleet.service.spec.ts` | Service unit tests |
| `web/src/lib/api/fleet.ts` | API client methods (sendCommand, getActiveOverrides, clearOverride) |
| `web/src/components/fleet/FleetCommandDropdown.tsx` | Dropdown for reload/restart/clear-cache all |
| `web/src/components/fleet/EmergencyOverrideModal.tsx` | Modal for emergency content push |
| `web/src/components/fleet/ActiveOverrideBanner.tsx` | Red banner showing active overrides |

### Modified Files

| File | Changes |
|------|---------|
| `middleware/src/app.module.ts` | Import FleetModule |
| `realtime/src/types/index.ts` | Add CLEAR_OVERRIDE to DeviceCommandType enum |
| `realtime/src/app/app.controller.ts` | Add POST /api/commands/broadcast endpoint (adding to existing file — small enough to not warrant a new controller) |
| `realtime/src/gateways/device.gateway.ts` | Check active override in sendInitialState() |
| `display/src/electron/device-client.ts` | Fix restart, push_content, clear_override handlers |
| `web/src/lib/api/index.ts` | Import fleet module |
| `web/src/app/dashboard/devices/page-client.tsx` | Add fleet UI components |

### Architecture Decision: Target Resolution

All target types (device, group, organization) are resolved to an array of deviceIds in the **middleware** `FleetService.resolveTargetDevices()`. The gateway receives a flat `deviceIds[]` array and iterates it — no `broadcastToOrg` flag. This keeps resolution logic in one place and the gateway stateless/simple. The spec's original `broadcastToOrg` field is removed from the gateway contract.

---

## Task 1: Command Infrastructure (Middleware)

**Files:**
- Create: `middleware/src/modules/fleet/dto/send-command.dto.ts`
- Create: `middleware/src/modules/fleet/fleet.service.ts`
- Create: `middleware/src/modules/fleet/fleet.controller.ts`
- Create: `middleware/src/modules/fleet/fleet.module.ts`
- Create: `middleware/src/modules/fleet/fleet.service.spec.ts`
- Create: `middleware/src/modules/fleet/fleet.controller.spec.ts`
- Modify: `middleware/src/app.module.ts`

- [ ] **Step 1: Create the DTO**

```typescript
// middleware/src/modules/fleet/dto/send-command.dto.ts
import {
  IsString, IsEnum, IsOptional, IsObject, ValidateNested, IsIn, IsNumber, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class CommandTargetDto {
  @IsEnum(['device', 'group', 'organization'])
  type!: 'device' | 'group' | 'organization';

  @IsString()
  id!: string;
}

class CommandPayloadDto {
  @IsOptional()
  @IsString()
  contentId?: string;

  @IsOptional()
  @IsNumber()
  @IsIn([15, 30, 60, 120, 240])
  duration?: number;

  @IsOptional()
  @IsEnum(['normal', 'emergency'])
  priority?: 'normal' | 'emergency';
}

export class SendCommandDto {
  @IsEnum(['reload', 'restart', 'reboot', 'clear_cache', 'push_content'])
  command!: string;

  @ValidateNested()
  @Type(() => CommandTargetDto)
  target!: CommandTargetDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CommandPayloadDto)
  payload?: CommandPayloadDto;
}
```

- [ ] **Step 2: Write the service spec (tests first)**

```typescript
// middleware/src/modules/fleet/fleet.service.spec.ts
// Test target resolution, override tracking, audit logging, validation
// Key test cases:
// - resolveTargetDevices: device returns [deviceId], group returns member IDs, org returns all org devices
// - sendCommand: calls gateway HTTP, returns targeted/online/queued counts
// - createOverride: sets Redis keys with correct TTL
// - getActiveOverrides: returns overrides for org
// - clearOverride: deletes Redis keys, calls gateway to send CLEAR_OVERRIDE
// - audit logging: every command creates an AuditLog entry
// - rate limiting: rejects if >10 commands/min for org
// - validation: push_content requires contentId, emergency requires admin role context
// Edge cases:
// - resolveTargetDevices with nonexistent deviceId: throws NotFoundException
// - resolveTargetDevices with empty group (zero members): returns empty array, command still succeeds with devicesTargeted=0
// - getActiveOverrides with expired override (TTL elapsed): returns empty (Redis auto-deleted)
// - clearOverride with nonexistent commandId: throws NotFoundException
```

Write full test file with mocked DatabaseService, RedisService, HttpService, EventEmitter2. Mock `db.display.findMany`, `db.displayGroupMember.findMany`, `db.content.findUnique`, `db.auditLog.create`. Mock Redis `set`, `get`, `del`, `scan`, `sadd`, `srem`, `smembers`, `scard`, `expire`, `incr`. Mock HTTP `post`.

- [ ] **Step 3: Run tests — expect failures (service not implemented)**

Run: `cd middleware && npx jest --testPathPattern=fleet.service.spec --no-coverage`
Expected: FAIL — FleetService not found

- [ ] **Step 4: Implement FleetService**

Key methods:
- `sendCommand(orgId, userId, userRole, dto)` — main orchestrator
- `resolveTargetDevices(orgId, target)` — returns `{ deviceIds: string[], targetName: string }`
- `callGatewayBroadcast(deviceIds, orgId, command)` — HTTP POST to realtime, returns `{ devicesOnline }`
- `createOverride(orgId, commandId, dto, targetName, userId, deviceIds)` — Redis SET + per-device keys
- `getActiveOverrides(orgId)` — Redis SMEMBERS on index set, then GET each override key
- `clearOverride(orgId, commandId)` — Redis DEL + gateway CLEAR_OVERRIDE broadcast
- `checkRateLimit(orgId)` — Redis INCR on `fleet:ratelimit:{orgId}` with 60s TTL, reject if >10
- `createAuditEntry(orgId, userId, command, target, deviceCount)` — Prisma auditLog.create

Constructor injects: `DatabaseService`, `RedisService`, `HttpService`, `CircuitBreakerService`, `EventEmitter2`

Rate limit: `fleet:ratelimit:{orgId}` key with INCR + 60s EXPIRE. If count > 10, throw `TooManyRequestsException`.

Override index: `overrides:index:{orgId}` Redis SET containing active commandIds. SADD on create, SREM on delete. Check SCARD before doing SCAN — if 0, return empty array immediately (O(1) fast path).

- [ ] **Step 5: Run tests — expect pass**

Run: `cd middleware && npx jest --testPathPattern=fleet.service.spec --no-coverage`
Expected: PASS

- [ ] **Step 6: Write controller spec (tests first)**

Test: auth guards applied, role checks (admin-only for emergency), DTO validation, response shape with `devicesTargeted`, `devicesOnline`, `devicesQueued`.

- [ ] **Step 7: Implement FleetController**

```typescript
// middleware/src/modules/fleet/fleet.controller.ts
@UseGuards(RolesGuard)
@RequiresSubscription()
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Post('commands')
  @Roles('admin', 'manager')
  async sendCommand(
    @CurrentUser() user: any,
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: SendCommandDto,
  ) {
    // Emergency requires admin
    if (dto.payload?.priority === 'emergency' && user.role !== 'admin') {
      throw new ForbiddenException('Emergency override requires admin role');
    }
    return this.fleetService.sendCommand(orgId, user.id, user.role, dto);
  }

  @Get('overrides/active')
  @Roles('admin', 'manager')
  async getActiveOverrides(
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.fleetService.getActiveOverrides(orgId);
  }

  @Delete('overrides/:commandId')
  @Roles('admin')
  async clearOverride(
    @Param('commandId') commandId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.fleetService.clearOverride(orgId, commandId);
  }
}
```

- [ ] **Step 8: Run controller tests — expect pass**

Run: `cd middleware && npx jest --testPathPattern=fleet.controller.spec --no-coverage`

- [ ] **Step 9: Create FleetModule and register in AppModule**

```typescript
// middleware/src/modules/fleet/fleet.module.ts
@Module({
  imports: [HttpModule],
  controllers: [FleetController],
  providers: [FleetService],
  exports: [FleetService],
})
export class FleetModule {}
```

Add `FleetModule` to imports in `middleware/src/app.module.ts`.

- [ ] **Step 10: Run full middleware test suite**

Run: `cd middleware && npx jest --no-coverage`
Expected: all existing tests pass + new fleet tests pass

- [ ] **Step 11: Commit**

```bash
git add middleware/src/modules/fleet/ middleware/src/app.module.ts
git commit -m "feat(fleet): add fleet command infrastructure (controller, service, DTOs, tests)

- POST /api/v1/fleet/commands — unified command endpoint
- GET /api/v1/fleet/overrides/active — active override listing
- DELETE /api/v1/fleet/overrides/:commandId — clear override early
- Target resolution: device, group, organization
- Redis override tracking with TTL auto-expiry
- Override index SET for O(1) existence checks
- Fleet-specific rate limit: 10 commands/min/org
- Audit logging on every fleet command"
```

---

## Task 2: Gateway Broadcast Endpoint + Remote Reload (L7)

**Files:**
- Modify: `realtime/src/types/index.ts`
- Modify: `realtime/src/app/app.controller.ts`
- Modify: `realtime/src/gateways/device.gateway.ts`

- [ ] **Step 1: Add CLEAR_OVERRIDE to DeviceCommandType enum**

In `realtime/src/types/index.ts`, add:
```typescript
CLEAR_OVERRIDE = 'clear_override',
```

- [ ] **Step 2: Add broadcast endpoint to realtime app controller**

In `realtime/src/app/app.controller.ts`, add a new POST handler:

```typescript
@Post('commands/broadcast')
@UseGuards(InternalApiGuard)
async broadcastCommand(@Body() data: {
  deviceIds: string[];
  command: { type: string; payload?: any; commandId?: string };
}) {
  let devicesOnline = 0;
  const commandWithTimestamp = {
    ...data.command,
    timestamp: new Date().toISOString(),
  };

  for (const deviceId of data.deviceIds) {
    // Check if device is connected by checking room membership
    const room = this.deviceGateway.server.sockets.adapter.rooms.get(`device:${deviceId}`);
    const isOnline = room && room.size > 0;

    // Always emit to the room (no-op if empty)
    this.deviceGateway.server.to(`device:${deviceId}`).emit('command', commandWithTimestamp);

    if (isOnline) {
      devicesOnline++;
    } else {
      // Queue for offline device — 5 minute TTL
      await this.redisService.addDeviceCommand(deviceId, commandWithTimestamp);
    }
  }

  return { devicesOnline };
}
```

Note: `addDeviceCommand` already sets a 5-min TTL on the Redis list key (`device:commands:{deviceId}`). Verify this in `redis.service.ts` — if not, ensure `expire(key, 300)` is called.

- [ ] **Step 4: Add realtime unit tests**

Add tests for the broadcast endpoint and sendInitialState override check. In the existing realtime test structure, add tests for:
- `broadcastCommand` endpoint: emits to each device room, queues for offline devices, returns correct `devicesOnline` count
- `broadcastCommand` endpoint: validates `InternalApiGuard` rejects requests without `x-internal-api-key`
- `sendInitialState` override check: when `device:override:{deviceId}` key exists in Redis, skip sending `playlist:update`
- `sendInitialState` normal path: when no override key, sends `playlist:update` as normal

- [ ] **Step 5: Run realtime tests**

Run: `cd realtime && npx jest --no-coverage`
Expected: all tests pass including new broadcast tests

- [ ] **Step 6: Test the full chain — reload command**

Start middleware + realtime services. Use curl or API test:
```bash
curl -X POST http://localhost:3000/api/v1/fleet/commands \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth_cookie>" \
  -d '{"command":"reload","target":{"type":"organization","id":"<orgId>"}}'
```

Expected: 200 response with `{ devicesTargeted, devicesOnline, devicesQueued }`. Realtime gateway receives the internal call and emits to device rooms.

- [ ] **Step 7: Commit**

```bash
git add realtime/src/types/index.ts realtime/src/app/app.controller.ts realtime/src/gateways/device.gateway.ts
git commit -m "feat(fleet): add gateway broadcast endpoint + CLEAR_OVERRIDE type (L7)

- POST /api/commands/broadcast internal endpoint
- Emits to individual device:{id} rooms (not org room)
- Queues commands in Redis for offline devices
- Returns devicesOnline count
- Add CLEAR_OVERRIDE to DeviceCommandType enum"
```

---

## Task 3: Remote Restart — Fix Device Handler (M6)

**Files:**
- Modify: `display/src/electron/device-client.ts`

- [ ] **Step 1: Read the existing handleCommand method**

Read `display/src/electron/device-client.ts` around the `handleCommand` method to understand the current switch/case structure.

- [ ] **Step 2: Fix the restart handler**

Replace the stub with:
```typescript
case 'restart':
  this.logger.info('Restart command received — relaunching app');
  app.relaunch();
  app.exit(0);
  break;
```

- [ ] **Step 3: Add reboot handler (basic — log only, no system reboot)**

```typescript
case 'reboot':
  this.logger.warn('Reboot command received — treating as restart (system reboot not supported)');
  app.relaunch();
  app.exit(0);
  break;
```

- [ ] **Step 4: Commit**

```bash
git add display/src/electron/device-client.ts
git commit -m "feat(fleet): fix device restart/reboot command handlers (M6)

- restart: app.relaunch() + app.exit(0)
- reboot: falls back to restart (system reboot too risky)"
```

---

## Task 4: Push-to-Group (M7)

This is already handled by the infrastructure in Task 1 (target type `group` resolves to member deviceIds) and Task 2 (gateway broadcasts to each device room). The only remaining work is ensuring the `push_content` command payload includes resolved content data (not just contentId).

**Files:**
- Modify: `middleware/src/modules/fleet/fleet.service.ts` (already created in Task 1)

- [ ] **Step 1: Add content resolution to sendCommand**

In `FleetService.sendCommand()`, when `command === 'push_content'`:
1. Look up content by `payload.contentId` from DB
2. Resolve MinIO URLs to public API paths
3. Include full content object in the command payload sent to gateway

```typescript
if (dto.command === 'push_content') {
  if (!dto.payload?.contentId) {
    throw new BadRequestException('contentId required for push_content');
  }
  const content = await this.db.content.findUnique({
    where: { id: dto.payload.contentId, organizationId: orgId },
  });
  if (!content) throw new NotFoundException('Content not found');

  // Resolve MinIO URL to public API path
  const resolvedUrl = content.url?.startsWith('minio://')
    ? `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/v1/device-content/${content.id}/file`
    : content.url;

  commandPayload.content = {
    id: content.id,
    title: content.title,
    type: content.type,
    url: resolvedUrl,
    thumbnailUrl: content.thumbnailUrl,
  };
  commandPayload.duration = dto.payload.duration || 60;
}
```

- [ ] **Step 2: Add test for content resolution**

Add test case in `fleet.service.spec.ts`:
- push_content command resolves content from DB
- push_content with missing contentId throws BadRequestException
- push_content with non-existent content throws NotFoundException
- MinIO URL gets resolved to public API path

- [ ] **Step 3: Run tests**

Run: `cd middleware && npx jest --testPathPattern=fleet --no-coverage`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add middleware/src/modules/fleet/
git commit -m "feat(fleet): add content resolution for push-to-group commands (M7)

- Resolves contentId to full content object with public URL
- Handles MinIO URL rewriting
- Validates content exists and belongs to org"
```

---

## Task 5: Emergency Override + Dashboard UI (L6)

**Files:**
- Modify: `display/src/electron/device-client.ts` — push_content + clear_override handlers
- Modify: `realtime/src/gateways/device.gateway.ts` — check override in sendInitialState
- Create: `web/src/lib/api/fleet.ts` — API client
- Create: `web/src/components/fleet/FleetCommandDropdown.tsx`
- Create: `web/src/components/fleet/EmergencyOverrideModal.tsx`
- Create: `web/src/components/fleet/ActiveOverrideBanner.tsx`
- Modify: `web/src/lib/api/index.ts` — import fleet
- Modify: `web/src/app/dashboard/devices/page-client.tsx` — add fleet UI

### Part A: Device-side push_content handler

- [ ] **Step 1: Add push_content handler to Electron client**

```typescript
case 'push_content': {
  const { content, duration, commandId } = command.payload || {};
  if (!content?.url) {
    this.logger.warn('push_content: missing content URL');
    break;
  }
  this.logger.info(`Push content received: ${content.title} for ${duration}min`);

  // Prefetch content before swapping display — don't flash blank screen
  try {
    // Preload: create a hidden BrowserWindow, load content URL, wait for 'did-finish-load'
    // Only swap the main window content after preload confirms the URL is reachable
    const { BrowserWindow } = require('electron');
    const preloader = new BrowserWindow({ show: false, width: 1, height: 1 });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { preloader.destroy(); resolve(); }, 10000); // 10s max
      preloader.webContents.once('did-finish-load', () => { clearTimeout(timeout); preloader.destroy(); resolve(); });
      preloader.webContents.once('did-fail-load', () => { clearTimeout(timeout); preloader.destroy(); resolve(); }); // proceed anyway
      preloader.loadURL(content.url);
    });

    // Clear any existing override timer
    if (this.overrideState?.revertTimer) {
      clearTimeout(this.overrideState.revertTimer);
    }

    // Save current state for revert
    const previousUrl = this.mainWindow?.webContents.getURL();

    // Load the pushed content
    this.mainWindow?.loadURL(content.url);

    // Set auto-revert timer
    const durationMs = (duration || 60) * 60 * 1000;
    const revertTimer = setTimeout(() => {
      this.logger.info('Override expired — reverting to playlist');
      if (previousUrl) {
        this.mainWindow?.loadURL(previousUrl);
      }
      this.overrideState = null;
    }, durationMs);

    this.overrideState = { previousUrl, revertTimer, commandId };
  } catch (err) {
    this.logger.error('push_content failed:', err);
  }
  break;
}

case 'clear_override': {
  if (this.overrideState?.revertTimer) {
    clearTimeout(this.overrideState.revertTimer);
    this.logger.info('Override cleared — reverting to playlist');
    if (this.overrideState.previousUrl) {
      this.mainWindow?.loadURL(this.overrideState.previousUrl);
    }
    this.overrideState = null;
  }
  break;
}
```

Also add `private overrideState: { previousUrl?: string; revertTimer: NodeJS.Timeout; commandId?: string } | null = null;` as a class property.

- [ ] **Step 2: Commit device changes**

```bash
git add display/src/electron/device-client.ts
git commit -m "feat(fleet): add push_content and clear_override device handlers (L6)

- Prefetch content before swapping display
- Save current URL for auto-revert
- Timer-based auto-revert after duration expires
- Clear existing override before setting new one (last-writer-wins)
- clear_override cancels timer and restores previous content"
```

### Part B: Gateway — check override on reconnect

- [ ] **Step 3: Modify sendInitialState in device gateway**

In `realtime/src/gateways/device.gateway.ts`, inside `sendInitialState()`, before the `playlist:update` emit, add a check:

```typescript
// Check if device has an active override — if so, send override command instead of playlist
const overrideCommandId = await this.redisService.get(`device:override:${deviceId}`);
if (overrideCommandId) {
  // Device has active override — skip playlist:update, send override command
  // The override details are in the command queue or can be re-sent
  this.logger.log(`Device ${deviceId} has active override ${overrideCommandId} — skipping playlist update`);
  // Don't send playlist:update — the pending command queue (via heartbeat) will deliver the override
  return;
}
```

- [ ] **Step 4: Commit gateway change**

```bash
git add realtime/src/gateways/device.gateway.ts
git commit -m "feat(fleet): skip playlist update for devices with active override

Prevents flicker on reconnect where device briefly shows playlist
before override command arrives via heartbeat queue."
```

### Part C: Dashboard API client

- [ ] **Step 5: Create fleet API client**

```typescript
// web/src/lib/api/fleet.ts
import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    sendFleetCommand(data: {
      command: string;
      target: { type: string; id: string };
      payload?: { contentId?: string; duration?: number; priority?: string };
    }): Promise<{
      commandId: string;
      command: string;
      target: { type: string; id: string };
      devicesTargeted: number;
      devicesOnline: number;
      devicesQueued: number;
    }>;
    getActiveOverrides(): Promise<Array<{
      commandId: string;
      contentId: string;
      contentTitle: string;
      targetType: string;
      targetId: string;
      targetName: string;
      duration: number;
      startedAt: string;
      expiresAt: string;
      startedBy: string;
    }>>;
    clearOverride(commandId: string): Promise<{ commandId: string; devicesNotified: number }>;
  }
}

ApiClient.prototype.sendFleetCommand = async function (data) {
  return this.request('/fleet/commands', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.getActiveOverrides = async function () {
  return this.request('/fleet/overrides/active');
};

ApiClient.prototype.clearOverride = async function (commandId: string) {
  return this.request(`/fleet/overrides/${commandId}`, {
    method: 'DELETE',
  });
};
```

Add `import './fleet';` to `web/src/lib/api/index.ts`.

- [ ] **Step 6: Commit API client**

```bash
git add web/src/lib/api/fleet.ts web/src/lib/api/index.ts
git commit -m "feat(fleet): add fleet API client methods"
```

### Part D: Dashboard UI components

- [ ] **Step 7: Create FleetCommandDropdown**

```tsx
// web/src/components/fleet/FleetCommandDropdown.tsx
// Dropdown button with: Reload All, Restart All, Clear Cache All
// Each item shows confirmation dialog before sending
// Uses apiClient.sendFleetCommand()
// Shows toast with devicesOnline/devicesQueued counts
// Props: organizationId: string
```

Ghost-styled dropdown button. Each action opens a ConfirmDialog. On confirm, calls `apiClient.sendFleetCommand(...)` and shows toast.

- [ ] **Step 8: Create EmergencyOverrideModal**

```tsx
// web/src/components/fleet/EmergencyOverrideModal.tsx
// Props: isOpen, onClose, organizationId
// Content:
//   - Content picker (select from apiClient.getContent())
//   - Target radio: All Devices | Device Group (dropdown) | Single Device (dropdown)
//   - Duration pills: 15m / 30m / 1h (default) / 2h / 4h
//   - Warning text
//   - "Push Emergency Content" red button
// On submit: apiClient.sendFleetCommand({ command: 'push_content', target, payload: { contentId, duration, priority: 'emergency' } })
// Toast: "Emergency content pushed to N devices (X online, Y queued)"
```

- [ ] **Step 9: Create ActiveOverrideBanner**

```tsx
// web/src/components/fleet/ActiveOverrideBanner.tsx
// Props: none (fetches own data)
// Polls apiClient.getActiveOverrides() every 30s
// If overrides exist, renders red banner with:
//   - Content title, target name, time remaining (countdown)
//   - "Clear Override" button → apiClient.clearOverride(commandId)
// If no overrides, renders nothing
```

- [ ] **Step 10: Integrate into Devices page**

In `web/src/app/dashboard/devices/page-client.tsx`:
1. Import the three fleet components
2. Add `FleetCommandDropdown` and emergency override button to the page header toolbar (next to "Pair New Device")
3. Add `ActiveOverrideBanner` at the top of the page content area (below breadcrumbs, above search)
4. Add per-device reload/restart icon buttons in the table action column

- [ ] **Step 11: Write component tests**

Create `web/src/components/fleet/__tests__/FleetCommandDropdown.test.tsx`:
- Renders dropdown with 3 command options (Reload, Restart, Clear Cache)
- Click opens confirmation dialog
- Confirm calls `apiClient.sendFleetCommand` with correct command type
- Shows toast with device counts after success

Create `web/src/components/fleet/__tests__/EmergencyOverrideModal.test.tsx`:
- Renders content picker, target selector, duration pills
- Duration defaults to 60 minutes
- Submit calls `apiClient.sendFleetCommand` with push_content + emergency priority
- Disabled submit when no content selected

Create `web/src/components/fleet/__tests__/ActiveOverrideBanner.test.tsx`:
- Renders nothing when no active overrides
- Renders red banner with content title and countdown when override active
- Clear button calls `apiClient.clearOverride`

- [ ] **Step 12: Run web tests**

Run: `pnpm --filter @vizora/web test`
Expected: all tests pass including new fleet component tests

- [ ] **Step 13: Build check**

Run: `npx nx build @vizora/web --skip-nx-cache`
Expected: build succeeds

- [ ] **Step 14: Commit dashboard UI**

```bash
git add web/src/components/fleet/ web/src/app/dashboard/devices/page-client.tsx
git commit -m "feat(fleet): add fleet control dashboard UI (L6)

- FleetCommandDropdown: reload/restart/clear-cache all devices
- EmergencyOverrideModal: content picker, target selector, duration picker
- ActiveOverrideBanner: red banner with countdown + clear button
- Per-device reload/restart action buttons in table
- 60-minute default override duration (15m/30m/1h/2h/4h options)"
```

---

## Task 6: Final Integration Test + Full Test Run

- [ ] **Step 1: Run full middleware test suite**

Run: `cd middleware && npx jest --no-coverage`
Expected: all tests pass including new fleet tests

- [ ] **Step 2: Run full realtime test suite**

Run: `cd realtime && npx jest --no-coverage`
Expected: all tests pass including new broadcast endpoint tests

- [ ] **Step 3: Run full web test suite**

Run: `pnpm --filter @vizora/web test`
Expected: all tests pass including new fleet component tests

- [ ] **Step 4: Build all services**

Run: `npx nx build @vizora/middleware && npx nx build @vizora/web && npx nx build @vizora/realtime`
Expected: all 3 build successfully

- [ ] **Step 5: Commit any remaining fixes**

If any test or build issues found, fix and commit.

- [ ] **Step 6: Final commit — update backlog**

Update `web/src/app/admin/backlog/page-client.tsx`:
- Add completed items: L6, L7, M6, M7
- Update metrics
- Move items from P1/P2 sections to completed

```bash
git add web/src/app/admin/backlog/page-client.tsx
git commit -m "chore: update backlog — mark fleet control items complete (L6, L7, M6, M7)"
```
