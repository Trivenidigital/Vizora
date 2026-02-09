# WebSocket Authentication

This document describes how Vizora authenticates WebSocket connections for both dashboard clients and display devices.

## Overview

Vizora uses a **dual JWT architecture** with two separate secrets:

| Client Type | JWT Secret | Token Expiry | Transport |
|---|---|---|---|
| Dashboard Users | `JWT_SECRET` | 7 days | httpOnly cookie (`vizora_auth_token`) |
| Display Devices | `DEVICE_JWT_SECRET` | 30 days | `Authorization: Bearer <token>` header / socket `auth.token` |

Both secrets must be at least 32 characters and are completely independent. Rotating one does not affect the other.

## Dashboard Client Authentication

### Token Format (User JWT)

```json
{
  "sub": "<userId>",
  "email": "user@example.com",
  "organizationId": "<orgId>",
  "role": "admin",
  "isSuperAdmin": false,
  "type": "user",
  "jti": "<unique-token-id>",
  "iat": 1700000000,
  "exp": 1700604800
}
```

**Signed with:** `JWT_SECRET` using HS256.

### Connection Flow

1. User logs in via `POST /api/auth/login`. The middleware sets an httpOnly cookie `vizora_auth_token` containing the JWT.
2. The web dashboard creates a Socket.IO connection to the realtime gateway (port 3002):
   ```ts
   const socket = io('http://localhost:3002', {
     transports: ['websocket', 'polling'],
     auth: {
       // Token is passed via auth object (not cookie, since WebSocket
       // connections are cross-origin to the realtime service)
     },
   });
   ```
3. On connect, the dashboard emits `join:organization` with its `organizationId`.
4. The gateway verifies the client belongs to the requested organization before joining the room.
5. The gateway emits `joined:organization` to confirm.

### Reconnection

The `useSocket` hook (in `web/src/lib/hooks/useSocket.ts`) manages reconnection automatically:

- **Reconnection attempts:** 5 (configurable)
- **Reconnection delay:** 1000ms initial, 5000ms max
- **Transports:** WebSocket first, polling fallback
- **Exhaustion cooldown:** After all reconnection attempts fail, the hook backs off for 5 minutes before allowing a new socket instance

The `useRealtimeEvents` hook adds offline queue support:
- Events emitted while offline are queued (up to 50 items by default)
- On reconnect, the queue is synced automatically
- Failed sync items (after 3 retries) are moved to a "conflicted changes" state for manual resolution

## Display Device Authentication

### Token Format (Device JWT)

```json
{
  "sub": "<displayId>",
  "deviceIdentifier": "device-abc123",
  "organizationId": "<orgId>",
  "type": "device",
  "jti": "<unique-token-id>",
  "iat": 1700000000,
  "exp": 1702592000
}
```

**Signed with:** `DEVICE_JWT_SECRET` using HS256.

### Pairing and Token Issuance

1. The display device calls `POST /api/devices/pairing/request` with its `deviceIdentifier`.
2. The middleware generates a 6-character pairing code (stored in Redis, expires in 15 minutes).
3. The device polls `GET /api/devices/pairing/status/:code` waiting for a user to approve.
4. A dashboard user enters the code via `POST /api/devices/pairing/complete`.
5. The middleware:
   - Creates a Display record in PostgreSQL
   - Generates a device JWT signed with `DEVICE_JWT_SECRET`
   - Stores a bcrypt hash of the token in the Display record
   - Returns the plaintext token to the device via the next status poll
6. The device stores this JWT and uses it for all future connections.

### WebSocket Connection Handshake

1. The device connects to the realtime gateway with the JWT in the `auth.token` field:
   ```ts
   const socket = io('ws://realtime-host:3002', {
     auth: { token: '<device-jwt>' },
   });
   ```
2. The gateway's `handleConnection` method:
   - Extracts the token from `client.handshake.auth.token`
   - Verifies the JWT against `DEVICE_JWT_SECRET` with HS256 algorithm
   - Checks `payload.type === 'device'` (rejects user tokens)
   - Checks the token's `jti` against the Redis revocation list
   - Deduplicates connections (if the device already has a socket, the old one is disconnected)
3. On successful auth:
   - The device is joined to rooms `device:<deviceId>` and `org:<organizationId>`
   - Device status is set to `online` in both Redis and PostgreSQL
   - The current playlist is fetched and sent via `playlist:update` event
   - A `config` event is emitted with heartbeat interval (15s), cache size, and QR overlay settings
   - The dashboard is notified via `device:status` event on the organization room

### Rejection Scenarios

| Condition | Action |
|---|---|
| No token provided | Socket disconnected immediately |
| Invalid/expired JWT | Socket disconnected |
| `type !== 'device'` | Socket disconnected |
| Token `jti` is in Redis revocation list | Socket disconnected |
| Connection rate limited (>10 per minute per IP) | `error` event emitted, socket disconnected |

## Room Architecture

### Room Types

| Pattern | Purpose | Who Joins |
|---|---|---|
| `device:<deviceId>` | Target specific device | The device itself |
| `org:<organizationId>` | Organization-wide broadcasts | All devices and dashboard clients in the org |

### Room Authorization

The `join:room` handler enforces authorization:

- **`device:<id>` rooms:** Client must be the device itself, or belong to the same organization as the device
- **`org:<id>` rooms:** Client must belong to the requested organization (verified via `client.data.organizationId`)
- **Unknown room patterns:** Rejected with "Invalid room name" error

### Events by Room

**Organization room (`org:<orgId>`):**
- `device:status` -- Device online/offline transitions
- `notification:new` -- New notifications (device back online, etc.)
- `screenshot:ready` -- Device screenshot available
- `playlist:updated` -- Playlist changes
- `health:alert` -- Device health alerts
- `schedule:executed` -- Schedule execution events

**Device room (`device:<deviceId>`):**
- `playlist:update` -- New playlist assignment
- `command` -- Remote commands (restart, refresh, etc.)
- `config` -- Configuration updates
- `qr-overlay:update` -- QR overlay configuration changes

## Connection Rate Limiting

The gateway enforces per-IP rate limiting:
- **Limit:** 10 connection attempts per minute per IP
- **Window:** 60 seconds (sliding)
- **Action on exceed:** Emits `error` event with `{ message: 'rate_limited' }` and disconnects
- **Cleanup:** Expired entries are cleaned up every 60 seconds

## Token Revocation

Both user and device tokens support revocation via the `jti` (JWT ID) claim:

1. On logout or token refresh, the token's `jti` is stored in Redis as `revoked_token:<jti>` with a TTL matching the token's remaining lifetime.
2. On every WebSocket connection and heartbeat, the gateway checks `revoked_token:<jti>` in Redis.
3. The middleware's `JwtStrategy` also checks revocation on every HTTP request.

## Error Handling

### Gateway Errors

All gateway errors are logged via NestJS Logger and reported to Sentry:
- Connection failures are logged with the error message
- Heartbeat failures include duration metrics
- Content errors include device ID, error type, and content ID

### Client-Side Error Recovery

The `useErrorRecovery` hook provides:
- **Exponential backoff:** Configurable initial delay, max delay, and backoff multiplier
- **Circuit breaker:** Opens after 5 consecutive failures, transitions to half-open after 60s timeout, closes after 2 successes
- **Jitter:** Random jitter to prevent thundering herd on reconnection

## Heartbeat Protocol

After connection, devices send periodic heartbeats:

1. Device emits `heartbeat` event every 15 seconds with:
   - `metrics`: CPU usage, memory usage, disk usage, temperature
   - `currentContent`: ID and title of currently displayed content
2. Gateway processes the heartbeat:
   - Updates Redis with current device status
   - Writes to PostgreSQL only on status transitions (online/offline)
   - Stores metrics in ClickHouse via HeartbeatService
   - Returns pending commands for the device
3. Gateway ping/pong settings: `pingInterval: 25000ms`, `pingTimeout: 20000ms`
