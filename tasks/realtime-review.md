# Vizora Realtime System Review

**Reviewer:** Realtime System Reviewer Agent
**Date:** 2026-02-09
**Branch:** feat/phase-3-major-features
**Scope:** Complete WebSocket and realtime subsystem audit

---

## Executive Summary

The realtime subsystem is **well-architected** for a pilot deployment. The gateway handles device authentication, room-based message routing, dual persistence, and comprehensive observability. However, there are several issues ranging from medium to high risk that should be addressed before scaling beyond a small pilot.

**Overall Assessment:** PILOT READY with caveats (see P0/P1 items below)

---

## 1. Gateway Architecture

### Files Reviewed
- `realtime/src/gateways/device.gateway.ts` (870 lines)
- `realtime/src/main.ts`
- `realtime/src/app/app.module.ts`

### Findings

**Strengths:**
- Clean NestJS gateway implementation using `OnGatewayConnection` / `OnGatewayDisconnect` lifecycle hooks
- Socket.IO configured with both `websocket` and `polling` transports (good fallback)
- CORS properly configured from environment with fallback to localhost
- Port enforcement at startup prevents misconfiguration (hard exit on wrong port)
- Graceful shutdown hooks enabled via `app.enableShutdownHooks()`
- Global validation pipe configured with `whitelist: true` and `transform: true`

**Issues:**

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 1.1 | No Socket.IO pingTimeout/pingInterval configuration | MEDIUM | Default Socket.IO ping settings (25s interval, 20s timeout) are used. For digital signage devices on potentially unreliable networks, these should be explicitly tuned. The heartbeat interval in the config event sent to devices is 15s, but the Socket.IO transport-level keepalive defaults may cause premature disconnects. |
| 1.2 | No maxHttpBufferSize configured on Socket.IO | MEDIUM | Default is 1MB. The screenshot handler already limits to 2MB base64 (line 699), but the transport would reject before the handler sees it. These limits are inconsistent. |
| 1.3 | No connection limit on Socket.IO server | LOW | No `maxConnections` or similar limiter. For pilot this is fine; for production at scale, a single gateway could be overwhelmed. |
| 1.4 | IoAdapter used instead of Redis adapter | MEDIUM | `IoAdapter` from `@nestjs/platform-socket.io` is a single-process adapter. The PM2 ecosystem config runs realtime as a single instance, but if it were ever scaled to multiple instances, rooms and broadcasts would not work across processes. This is documented as "single instance for WebSocket state consistency" in the ecosystem config. Acceptable for pilot but blocks horizontal scaling. |

---

## 2. Connection Lifecycle

### Authentication (handleConnection)

**Strengths:**
- JWT extracted from `client.handshake.auth.token` (not query string - good security practice)
- Token verified with explicit `DEVICE_JWT_SECRET` and algorithm restriction to `HS256`
- Token type check (`payload.type !== 'device'`) prevents user JWTs from connecting
- Device info stored in `client.data` for later access
- Connection rejected cleanly with `client.disconnect()` on auth failure

**Issues:**

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 2.1 | No check if device exists in database before accepting connection | LOW | The gateway accepts any valid JWT even if the device has been deleted from the database. The device status is written to Redis and a DB update is attempted, but a deleted device would silently fail the DB update and still be treated as connected. |
| 2.2 | handleConnection is large and complex (~196 lines) | LOW | The connection handler does: auth verification, room joins, Redis status update, DB status update, notification handling, metrics recording, dashboard notification, playlist fetch/transform/send, config emission. Any error in the playlist/notification section does not affect the connection (good), but the function could benefit from decomposition for readability. |
| 2.3 | No rate limiting on connection attempts | MEDIUM | A malicious client could repeatedly connect/disconnect causing DB and Redis writes each time. There is no throttle on connection attempts per IP or per device. |

### Disconnection (handleDisconnect)

**Strengths:**
- Clean status update to both Redis and PostgreSQL
- Scheduled offline notification with 2-minute delay (avoids false alarms from brief disconnects)
- Metrics properly recorded
- Dashboard notified of status change
- Error handling wraps the entire disconnect logic

**Issues:**

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 2.4 | No check for existing connections from the same device | MEDIUM | If a device reconnects before the previous socket fully disconnects, there could be two sockets for the same device momentarily. The old socket's disconnect handler would set the device to "offline" AFTER the new socket set it to "online", creating a race condition. Socket.IO does not deduplicate connections by device ID. |
| 2.5 | Rooms are not explicitly left on disconnect | LOW | Socket.IO automatically removes a socket from all rooms on disconnect, but explicit room cleanup could be added for clarity and to handle edge cases. |

### Reconnection (Client-Side)

**Electron Display Client (`display/src/electron/device-client.ts`):**
- `reconnection: true` with `reconnectionAttempts: Infinity` - devices will never give up reconnecting (correct for signage)
- `reconnectionDelay: 1000` with `reconnectionDelayMax: 5000` - reasonable backoff
- Heartbeat correctly starts on connect and stops on disconnect
- Token rejection on `connect_error` triggers re-pairing flow (good recovery)

**Web Dashboard (`web/src/lib/hooks/useSocket.ts`):**
- `reconnectionAttempts: 5` - limited retries for dashboard (reasonable)
- Reconnect exhaustion tracking with 5-minute cooldown (prevents retry storms)
- Auto-joins organization room on connect

---

## 3. Room Architecture

### Room Naming Convention
- `device:{deviceId}` - Per-device targeting
- `org:{organizationId}` - Organization-wide broadcasts

### Room Management

**Strengths:**
- Devices auto-join both rooms on connect (lines 117-119)
- `join:organization` handler has authorization check - verifies `client.data.organizationId` matches requested org
- `join:room` handler has comprehensive authorization:
  - `device:*` rooms: allows own device OR same-org devices (with DB lookup)
  - `org:*` rooms: allows only matching organization
  - Unknown patterns rejected
- `leave:room` handler exists for clean room departure

**Issues:**

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 3.1 | join:organization handler checks org membership against client.data, but dashboard clients authenticate with device JWT | LOW | The `join:organization` handler (line 561) checks `client.data.organizationId`, which is set from the device JWT payload. For dashboard clients to use this, they would need to authenticate with a device JWT. The web dashboard's `useSocket` sends `auth.organizationId` but there's no separate authentication path for dashboard/user clients - they seem to share the same gateway and device JWT auth. This could be a design limitation. |
| 3.2 | No room size tracking or limits | LOW | No mechanism to track how many clients are in a room. For a large org with many devices, the org room could have hundreds of members. This is fine for pilot scale. |

---

## 4. Dual Persistence (Redis + PostgreSQL)

### Pattern Analysis

Every status change writes to both stores:

1. **handleConnection**: Redis `setDeviceStatus` + DB `display.update` (status: 'online')
2. **handleDisconnect**: Redis `setDeviceStatus` + DB `display.update` (status: 'offline')
3. **handleHeartbeat**: Redis `setDeviceStatus` + DB `display.update` (status: 'online')

### Strengths
- Redis is the primary fast store; DB is secondary for dashboard queries
- DB failures are caught and logged but do NOT fail the operation (non-blocking)
- Redis has TTL-based expiry (60s for online, 24h for offline)
- Atomic command retrieval using Redis MULTI (lrange + del)

### Issues

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 4.1 | DB write on EVERY heartbeat (every 15 seconds per device) | HIGH | Each connected device triggers a DB UPDATE every 15 seconds (line 367-379 in handleHeartbeat). With 100 devices, that's 400 DB writes/minute just for heartbeats. This will not scale. The Redis write is sufficient for real-time status; the DB should only be updated on status transitions (online<->offline), not on every heartbeat. |
| 4.2 | No transactional consistency between Redis and DB | MEDIUM | Writes happen sequentially: Redis first, then DB. If the DB write fails, Redis has the correct status but the DB is stale. The dashboard queries the DB, so it could show stale data. This is mitigated by the non-critical nature of the dashboard view, but it's worth noting. |
| 4.3 | Redis TTL for online status is only 60 seconds | LOW | If a device misses 4 heartbeats (15s * 4 = 60s), its Redis status key will expire, making it appear offline in Redis even if it's still connected. The heartbeat refreshes the TTL each time, but a brief network hiccup causing 2-3 missed heartbeats could cause a stale read from Redis. |
| 4.4 | Race condition on disconnect/reconnect | MEDIUM | As noted in 2.4, if disconnect handler runs after reconnect handler, the DB will be set to offline incorrectly. The Redis write is also affected. There's no locking or sequencing mechanism. |

---

## 5. Event System

### Complete Event Map

**Client-to-Server (Device -> Gateway):**

| Event | DTO Validation | Handler | Notes |
|-------|---------------|---------|-------|
| `heartbeat` | `HeartbeatMessageDto` (WsValidationPipe) | `handleHeartbeat` | Returns ack with commands |
| `content:impression` | `ContentImpressionDto` (WsValidationPipe) | `handleContentImpression` | Analytics logging |
| `content:error` | `ContentErrorDto` (WsValidationPipe) | `handleContentError` | Error tracking |
| `playlist:request` | `PlaylistRequestDto` (WsValidationPipe) | `handlePlaylistRequest` | On-demand playlist fetch |
| `join:organization` | No DTO (inline validation) | `handleJoinOrganization` | Dashboard room join |
| `join:room` | No DTO (inline validation) | `handleJoinRoom` | Generic room join |
| `leave:room` | No DTO (inline validation) | `handleLeaveRoom` | Room departure |
| `screenshot:response` | No DTO (inline validation) | `handleScreenshotResponse` | Screenshot upload |

**Server-to-Client (Gateway -> Device/Dashboard):**

| Event | Target | Source |
|-------|--------|--------|
| `config` | device socket | handleConnection |
| `playlist:update` | device room | handleConnection, sendPlaylistUpdate |
| `device:status` | org room | handleConnection, handleDisconnect |
| `command` | device room | sendCommand |
| `notification:new` | org room | handleConnection (online notification) |
| `screenshot:ready` | org room | handleScreenshotResponse |
| `joined:organization` | client socket | handleJoinOrganization |
| `error` | client socket | handleJoinOrganization, handleJoinRoom |
| `qr-overlay:update` | device room | sendQrOverlayUpdate |

### Payload Validation

**Strengths:**
- DTOs use `class-validator` with proper decorators (@IsString, @IsNumber, @Min, @Max, @IsEnum, @ValidateNested)
- `WsValidationPipe` configured with `whitelist: true`, `forbidNonWhitelisted: true`, `forbidUnknownValues: true` - strict validation
- Custom WsException thrown on validation failure (not BadRequestException)
- Nested DTO validation supported via `@ValidateNested()` + `@Type()`

**Issues:**

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 5.1 | Screenshot response has no DTO validation | MEDIUM | `handleScreenshotResponse` (line 683) accepts a raw object with no DTO class or @UsePipes. The inline validation only checks `imageData.length` but does not validate that `requestId`, `width`, `height` are present or correct types. A malformed payload could cause crashes. |
| 5.2 | join:organization and join:room have no DTO validation | LOW | These handlers do inline null checks but no type validation. Sending `{ organizationId: 123 }` (number instead of string) would pass the null check but could cause issues downstream. |
| 5.3 | No validation on screenshot imageData content | MEDIUM | The imageData is assumed to be valid base64 but not verified before `Buffer.from(data.imageData, 'base64')`. Invalid base64 would produce garbage bytes, not an error. Could result in corrupt files stored in MinIO. |
| 5.4 | Heartbeat response includes pending commands - no command validation | LOW | Commands retrieved from Redis (`getDeviceCommands`) are returned directly to the client. If someone injected malicious data into Redis, it would be forwarded to devices. This is an internal-only path, so low risk in practice. |

---

## 6. Performance & Scalability

### Memory Leak Analysis

**Potential Leak Sources:**

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 6.1 | Prometheus metrics with device_id labels (unbounded cardinality) | HIGH | `deviceStatus`, `deviceCpuUsage`, `deviceMemoryUsage` gauges use `device_id` as a label (metrics.service.ts lines 115-124). Every unique device ID creates a new time series. If devices are replaced or IDs rotate, old series are never cleaned up. With thousands of devices over time, this will consume significant memory. Prometheus best practice is to avoid high-cardinality labels like IDs. |
| 6.2 | NotificationService uses setInterval (not @Cron) | LOW | The 30-second interval for `checkPendingNotifications` is properly cleaned up in `onModuleDestroy`. No leak here. |
| 6.3 | RedisService subscription tracking is properly managed | GOOD | The `subscriptions` Map properly tracks handlers and cleans up via `unsubscribeAll()` on module destroy. The `subscribe()` method returns an unsubscribe function. No leak. |
| 6.4 | HeartbeatService stores errors in Redis with bounded list | GOOD | Error log keeps only last 10 errors per device with 1-hour TTL. No unbounded growth. |

### Connection Capacity

- No explicit `maxConnections` configured on Socket.IO
- Single process (PM2 ecosystem.config.js specifies 1 instance for realtime)
- Default Socket.IO uses polling upgrade, which means each connection attempt initially creates an HTTP request
- For pilot (10-50 devices), this is fine. For 500+ devices, the single-process model needs evaluation.

### Heartbeat Overhead

- 15-second heartbeat interval per device
- Each heartbeat: 1 Redis write + 1 DB write + 1 Redis read (commands) + metrics updates
- With 100 devices: ~7 heartbeats/second, ~7 DB writes/second
- **This is the most concerning scalability bottleneck** (see 4.1)

---

## 7. Client Integration

### Web Dashboard (`web/src/lib/hooks/useSocket.ts`)

**Strengths:**
- Clean React hook abstraction with proper cleanup in useEffect return
- Reconnection exhaustion with 5-minute cooldown prevents retry storms
- Socket ref pattern avoids stale closure issues
- Proper event listener cleanup via returned unsubscribe functions
- Development-only console logging (good for debugging, no prod noise)

**Issues:**

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 7.1 | useSocket returns `socketRef.current` directly | LOW | The `socket` return value is a ref's `.current`, which means it can be null even when `isConnected` is true (timing). Components should use the `on`/`emit` wrappers instead of the socket directly. |
| 7.2 | useRealtimeEvents has no auth token handling | MEDIUM | The `useRealtimeEvents` hook calls `useSocket()` with no options, meaning no auth token is passed. Dashboard clients would connect without authentication. The gateway's `handleConnection` would reject them (no token). It seems like the auth must be provided by a parent component wrapping useSocket, but useRealtimeEvents creates its own socket instance. This could result in unauthenticated connection attempts. |

### Web Dashboard (`web/src/lib/hooks/useRealtimeEvents.ts`)

**Strengths:**
- Comprehensive offline queue with retry support
- Conflict resolution strategy (remote wins, field-level merge)
- Browser online/offline event monitoring
- Queue size limiting prevents unbounded memory growth

**Issues:**

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 7.3 | syncOfflineQueue emits events without waiting for ack | LOW | Offline queued events are re-emitted on reconnect but success is assumed after `socket.emit()`. No ack-based confirmation. For pilot this is acceptable. |
| 7.4 | Stale dependency array in useEffect (syncState included via onSyncStateChange) | LOW | The useEffect at line 276 includes many callback dependencies, which could cause frequent re-subscriptions. The hooks use `useCallback` to stabilize, but if parent components recreate callback props, this could cause excessive cleanup/setup cycles. |

### Electron Display Client (`display/src/electron/device-client.ts`)

**Strengths:**
- Infinite reconnection attempts (correct for unattended signage)
- Heartbeat with system metrics (CPU, memory)
- Token rejection triggers re-pairing flow
- Device identifier persistence via electron-store

**Issues:**

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 7.5 | Device identifier uses MAC address + random suffix | LOW | The `getDeviceIdentifier` method generates an ID from the first network interface's MAC address plus a random suffix. This is persisted, which is good. But the first interface may not be stable across reboots if network adapters change order. The persistence mitigates this. |
| 7.6 | handleCommand switch statement is mostly empty | LOW | The `reload`, `clear_cache`, and `update` commands have empty bodies (lines 334-347). These are TODO items that should be implemented before pilot. |
| 7.7 | CPU usage calculation is point-in-time, not averaged | LOW | `getCpuUsage()` calculates usage from cumulative CPU times, which gives a lifetime average, not recent usage. For meaningful metrics, a delta measurement over the heartbeat interval would be more useful. |

### Android TV Display Client

- No WebSocket integration files found in `display-android/src/`. The Android client may use a different approach (Capacitor plugin?) or the integration has not been built yet.

---

## 8. Realtime Service Structure

### Module Organization

```
realtime/src/
  main.ts                          - Bootstrap, port enforcement, error handling
  app/
    app.module.ts                  - Root module, imports, providers
    app.controller.ts              - Health endpoints, push API endpoints
    app.service.ts                 - Minimal status service
  gateways/
    device.gateway.ts              - Main WebSocket gateway (870 lines)
    dto/index.ts                   - DTO classes with class-validator
    pipes/ws-validation.pipe.ts    - Custom WebSocket validation pipe
  services/
    redis.service.ts               - Redis client with pub/sub, retry strategy
    heartbeat.service.ts           - Heartbeat processing, impression/error logging
    playlist.service.ts            - Playlist caching and retrieval
    notification.service.ts        - Offline/online notification scheduling
  database/
    database.module.ts             - Global Prisma module
    database.service.ts            - PrismaClient with retry and pool config
  storage/
    storage.module.ts              - MinIO module
    storage.service.ts             - MinIO client for screenshots
  metrics/
    metrics.module.ts              - Prometheus metrics registration
    metrics.service.ts             - Metrics recording methods
    metrics-auth.middleware.ts     - Metrics endpoint access control
  guards/
    internal-api.guard.ts          - API key guard for internal endpoints
  interceptors/
    sentry.interceptor.ts          - Error tracking to Sentry
    metrics.interceptor.ts         - HTTP request metrics
  config/
    sentry.config.ts               - Sentry initialization
  types/
    index.ts                       - Shared type definitions
```

**Strengths:**
- Well-organized module structure with clear separation of concerns
- Database module is `@Global()` for easy injection across the service
- Types are centralized in a single index file
- DTOs are separate from the gateway logic

**Issues:**

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 8.1 | No unit tests for the realtime service | HIGH | Zero test files found (`realtime/**/*.spec.ts` returned no results). The gateway, services, and pipes have no automated tests. This is a significant gap for production readiness. |
| 8.2 | device.gateway.ts is 870 lines | LOW | The gateway handles connection, disconnection, heartbeat, impressions, errors, playlist requests, room management, screenshots, QR overlays, and layout content resolution. Consider extracting the layout resolution and playlist transform logic into dedicated services. |
| 8.3 | PlaylistService.getDevicePlaylist returns a hardcoded default | MEDIUM | When no cached playlist is found, the service returns a "Default Playlist" with empty items (lines 46-53). The comment says "TODO: In production, fetch from MongoDB". However, the gateway's `handleConnection` already fetches playlists from PostgreSQL directly. This service seems partially obsolete - the `playlist:request` handler uses it, but the initial connection does not. This could confuse debugging. |

---

## 9. Security Assessment

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 9.1 | Internal API guard uses constant-time comparison | GOOD | `InternalApiGuard` uses `timingSafeEqual` to prevent timing attacks on the API key. |
| 9.2 | Metrics endpoint protected by auth middleware | GOOD | Localhost access allowed, otherwise requires bearer token. Development mode allows all (acceptable). |
| 9.3 | Sentry filters sensitive data from events | GOOD | `beforeSend` removes cookies and authorization headers. |
| 9.4 | Room join authorization is comprehensive | GOOD | Device rooms, org rooms, and unknown patterns are all handled with proper auth checks. |
| 9.5 | No input sanitization on screenshot imageData | MEDIUM | The base64 string from `screenshot:response` is converted to a buffer and uploaded directly to MinIO. No validation that it's actually a PNG image. A device could upload arbitrary data. |
| 9.6 | leave:room has no authorization check | LOW | Any client can leave any room (line 664-677). This is harmless since leaving a room you're not in is a no-op, but it could be used to probe room names. |
| 9.7 | JWT secret in app.module.ts uses process.env directly | LOW | `JwtModule.register({ secret: process.env.DEVICE_JWT_SECRET })` is evaluated at module load time. If the env var is missing, it becomes `undefined`, which would make JWT verification fail with a confusing error. A startup check for required env vars would be better. |

---

## 10. Observability

**Strengths:**
- Comprehensive Prometheus metrics: connections, messages, heartbeats, content, device status, HTTP, Redis
- Sentry integration with error filtering, context enrichment, and sensitive data scrubbing
- Health endpoints: `/health` (deep), `/health/live` (liveness), `/health/ready` (readiness)
- Structured logging throughout with appropriate log levels (debug, log, warn, error)

**Issues:**

| # | Issue | Risk | Details |
|---|-------|------|---------|
| 10.1 | High-cardinality device_id labels in Prometheus (repeated from 6.1) | HIGH | This is the most significant observability issue. Device-level metrics should use a different approach (push to ClickHouse, or use a device metrics aggregation layer). |
| 10.2 | No WebSocket-specific health check | LOW | The `checkWebSocket` method only checks if `this.deviceGateway.server` exists, not if it's actually accepting connections. A proper check would verify the Socket.IO server is listening. |

---

## Priority Summary

### P0 - Must Fix Before Production (acceptable for small pilot)

| # | Issue | Impact |
|---|-------|--------|
| 4.1 | DB write on every heartbeat | Will not scale beyond ~50 devices without DB strain |
| 6.1/10.1 | Unbounded Prometheus cardinality on device_id | Memory growth, Prometheus performance degradation |
| 8.1 | Zero unit tests for realtime service | No safety net for regressions |

### P1 - Should Fix Before Scaling

| # | Issue | Impact |
|---|-------|--------|
| 2.3 | No connection rate limiting | Vulnerable to connection flood |
| 2.4/4.4 | Disconnect/reconnect race condition | Brief incorrect status on rapid reconnect |
| 1.4 | No Redis adapter for Socket.IO | Blocks horizontal scaling |
| 5.1 | Screenshot response lacks DTO validation | Potential crash on malformed data |
| 7.2 | useRealtimeEvents creates unauthenticated socket | Dashboard may fail to connect |

### P2 - Nice to Have

| # | Issue | Impact |
|---|-------|--------|
| 1.1 | No explicit ping/timeout config | Potential premature disconnects |
| 1.2 | Inconsistent max payload size | Screenshot rejection at transport vs handler |
| 3.1 | Dashboard auth model unclear | May need separate auth path for user clients |
| 7.6 | Empty command handlers in Electron client | Missing device-side features |
| 8.3 | PlaylistService partially obsolete | Confusing codebase |

---

## Recommendations for Pilot

1. **Heartbeat DB writes**: Change to only update PostgreSQL on status transitions (online->offline, offline->online), not on every heartbeat. Redis is sufficient for real-time status.

2. **Prometheus labels**: Replace `device_id` labels with aggregated metrics. Track total devices online/offline per organization, not per-device gauges.

3. **Add basic tests**: At minimum, add unit tests for the `WsValidationPipe`, the `RedisService`, and the `handleConnection` auth logic.

4. **Screenshot validation**: Add a DTO class for `screenshot:response` and validate the imageData is valid base64 of reasonable size.

5. **Connection deduplication**: When a device connects, check for and disconnect any existing sockets for the same device ID before proceeding.

6. **Startup env validation**: Add a startup check that `DEVICE_JWT_SECRET`, `DATABASE_URL`, and `REDIS_URL` are set before the service starts accepting connections.

---

## Conclusion

The realtime system demonstrates solid engineering practices for a pilot-stage product. The authentication model, room architecture, dual persistence pattern, and observability stack are all production-grade in design. The main concerns are around scalability (heartbeat DB writes, Prometheus cardinality) and test coverage (zero tests). For a controlled pilot with fewer than 50 devices, these issues are manageable. The P0 items should be addressed before any scaling beyond pilot.
