# Vizora E2E Re-Test Report — Pairing & Content Streaming Pipeline

**Date:** 2026-03-06
**Tester:** Claude Code (Opus 4.6)
**Environment:** Production (vizora.cloud) + Android Emulator (API 34)

## Test Scope

Full end-to-end re-test of device pairing and content streaming pipeline after deploying 5 bug fixes from PR #19 and 2 hotfix commits.

## Test Results

### PASS — Device Pairing Flow
- Device requests 6-char pairing code via REST API
- QR code and manual code displayed on emulator screen
- Dashboard "Pair New Device" form accepts code
- Device receives JWT token on successful pairing
- Device connects to WebSocket gateway with JWT auth
- Device appears as "Online" on dashboard within seconds

### PASS — Dashboard Device Status (Hotfix Verified)
- DeviceStatusContext correctly initializes from REST API
- DeviceStatusIndicator shows "Online" (was stuck on "Offline" — fixed)
- Last Seen column shows actual timestamp (was "Never" — fixed via lastHeartbeat fallback)
- Live status updates via WebSocket work (device:status events)

### PASS — Subscription Guard (BUG #4 Fix Verified)
- Content push (POST request) succeeds during active free trial
- Previously returned 403 "subscription inactive" — now correctly allows write operations
- Free tier users with canceled/expired status also allowed through

### PASS — Content Push Command Delivery
- Dashboard "Push Content" dialog shows online devices
- Push request routed: Dashboard → Middleware API → Realtime Gateway → Device WebSocket
- Server logs confirm: `Sent command push_content to device: b3388579-...`
- Device receives and processes the push_content command

### PASS — Content URL Resolution
- MinIO internal URLs (`minio://...`) correctly resolved to public API endpoints
- Realtime gateway transforms URL before sending to device

### FAIL → FIXED — Content File Fetch (BUG #6 — NEW)

**Root Cause:** Origin mismatch between device `apiUrl` and server `API_BASE_URL`
- Device configured with `apiUrl = https://vizora.cloud` (no www)
- Server `API_BASE_URL = https://www.vizora.cloud` (with www)
- `transformContentUrl()` compares origins for same-origin token injection
- `https://vizora.cloud` !== `https://www.vizora.cloud` → token NOT appended
- Device fetches content URL without JWT → 401 Unauthorized

**Fixes Applied:**
1. **Server-side (immediate):** Changed `API_BASE_URL` in production `.env` from `https://www.vizora.cloud` to `https://vizora.cloud`. Removed duplicate entry. Reloaded realtime service.
2. **Client-side (robustness):** Updated `transformContentUrl()` in `vizora-tv/src/utils.ts` to normalize www/non-www origins before comparison:
   ```typescript
   const normalize = (o: string) => o.replace('://www.', '://');
   ```

**Severity:** Critical — blocks all content delivery to devices

### KNOWN ISSUE — App UI State After Force Restart (BUG #7)

After Android force-stop + restart, device shows pairing screen despite having valid stored JWT and active WebSocket connection. The `showScreen('content')` fires on socket connect but the pairing screen persists. Normal reconnects (without force-stop) work correctly.

**Severity:** Low — only affects manual force-stop scenario, not normal operation

### KNOWN ISSUE — Heartbeat Validation Warnings

Device sends extra fields in heartbeat payload (`timestamp`, `status`, `metrics.uptime`, `currentContent`) that are rejected by `WsValidationPipe`. Non-breaking — heartbeats still maintain device online status. Creates noisy WARN-level logs every 15 seconds.

**Severity:** Low — cosmetic log noise, no functional impact

## Bug Summary

| # | Bug | Severity | Status | Fix Location |
|---|-----|----------|--------|-------------|
| 1 | Dashboard catch-up missing on WS connect | High | Fixed (PR #19) | realtime/device.gateway.ts |
| 2 | No pairing code expiry countdown | Medium | Fixed (vizora-tv) | vizora-tv/src/main.ts |
| 3 | lastHeartbeat not set on pairing | Medium | Fixed (PR #19) | middleware/pairing.service.ts |
| 4 | Subscription guard blocks free trial writes | Critical | Fixed (PR #19) | middleware/subscription-active.guard.ts |
| 5 | "Offline" label misleading on content page | Low | Fixed (PR #19) | web/content/page-client.tsx |
| 6 | **www/non-www origin mismatch blocks content fetch** | **Critical** | **Fixed** | **Server .env + vizora-tv/utils.ts** |
| 7 | App UI stuck on pairing after force-stop | Low | Open | vizora-tv (needs investigation) |

## Files Changed This Session

### vizora (main repo) — Server-side
- Production `.env`: Fixed `API_BASE_URL` to `https://vizora.cloud`, removed duplicate

### vizora-tv (display client)
- `src/utils.ts`: Added www/non-www origin normalization in `transformContentUrl()`
- `src/main.spec.ts`: Added 2 test cases for www/non-www token injection

## Verification Evidence

- Emulator screenshots in `test-screenshots/`
- Server logs confirmed push delivery: `Push content received - original URL: minio://...`
- Server logs confirmed URL resolution: `Resolved to: https://vizora.cloud/api/v1/device-content/.../file`
- ADB logcat confirmed device received push and loaded content from cache
- Dashboard confirmed device online status with correct timestamps
