# Vizora Device Pairing & Content Push E2E Test Report

## Test Environment

| Property | Value |
|----------|-------|
| Dashboard URL | https://vizora.cloud |
| User Account | lax@vizora.com (admin, org: LAX Kitchen) |
| Subscription Tier | free (expired trial) |
| Emulator AVD | Vizora_TV |
| Android Version | 14 (API 34) |
| Device Model | sdk_gphone64_x86_64 |
| App Package | com.vizora.display.debug |
| App Version | 1.0.0 (versionCode: 10000) |
| App minSdk/targetSdk | 23 / 34 |
| Test Date | March 6, 2026, ~2:27-2:47 PM |
| Backend | vizora.cloud (89.167.55.176) |

## Pre-Flight Results

| Check | Status | Notes |
|-------|--------|-------|
| Dashboard accessible | YES | Landing page and login page load correctly |
| Emulator connected | YES | Vizora_TV AVD, had to start manually (`emulator -avd Vizora_TV`) |
| Vizora app installed | NO (initially) | App was not installed; built from `vizora-tv` repo and installed via ADB |
| App running | YES (after install) | Initially showed "Connection failed" due to default localhost URLs |
| App configured | YES (after rebuild) | Rebuilt with `.env` pointing to `https://vizora.cloud` / `wss://vizora.cloud` |

### Pre-Flight Issues Resolved

1. **ADB not in PATH** - Located at `C:\Users\srini\Android\Sdk\platform-tools\adb.exe`
2. **App not installed** - Built from `C:\projects\vizora-tv` using Capacitor + Gradle
3. **Gradle SDK path missing** - Created `android/local.properties` with `sdk.dir=C:/Users/srini/Android/Sdk`
4. **minSdkVersion conflict** - Bumped from 22 to 23 in `android/variables.gradle` (required by `androidx.security:security-crypto:1.0.0`)
5. **App connecting to localhost** - Created `.env` with production URLs and rebuilt

## Step-by-Step Results

### Step 1: Login to Dashboard

| Property | Value |
|----------|-------|
| **Status** | PASS |
| **What was tested** | Login with lax@vizora.com credentials |
| **What happened** | Login form loaded, credentials accepted, redirected to Dashboard Overview |
| **Time taken** | ~2s |
| **Screenshots** | `step1-dashboard-login.png` |
| **Issues found** | Banner: "Your free trial has ended. Your data is safe. Upgrade to pick up where you left off." |

Dashboard showed:
- User "lax / lax@vizora.com" in top-right
- Full sidebar navigation (Overview, Devices, Content, Templates, Widgets, Layouts, Playlists, Schedules, Analytics, Settings)
- 1 Total Device (from prior pairing), 0 Content Items, 0 Playlists
- System Status: Healthy

### Step 2: Navigate to Devices & Start Pairing

| Property | Value |
|----------|-------|
| **Status** | PASS |
| **What was tested** | Devices page load, existing device list, Pair New Device button |
| **What happened** | Devices page loaded with "Real-time connection established" toast. 1 existing device "Android Emulator Test" shown as Offline. |
| **Time taken** | ~1s |
| **Screenshots** | `step2-devices-page.png`, `step2-devices-refreshed.png` |
| **Issues found** | BUG #1 - Device shows "Offline" on dashboard while emulator app shows "Connected" |

### Step 3: Get Pairing Code from Android Emulator

| Property | Value |
|----------|-------|
| **Status** | PASS |
| **What was tested** | App data cleared to force fresh pairing, pairing code generation |
| **What happened** | After `pm clear`, app relaunched and displayed pairing screen with QR code and 6-character alphanumeric code |
| **Time taken** | ~5s from app launch to code display |
| **Screenshots** | `emulator-pairing-screen.png` |
| **Issues found** | None |

Pairing screen displayed:
- QR code (scannable)
- Pairing Code: `VNGAXU` (later refreshed to `Y6CPST` due to 5-min expiry)
- Status indicator: "Waiting for pairing..." (amber dot)
- Instructions: "Open the Vizora Dashboard on your computer or phone"
- Code format: 6-character uppercase alphanumeric

### Step 4: Complete Device Pairing

| Property | Value |
|----------|-------|
| **Status** | PASS |
| **What was tested** | Enter pairing code on dashboard, complete pairing on both sides |
| **What happened** | Code entered on dashboard pair page, pairing succeeded, device appeared in device list |
| **Time taken** | ~3s from form submission to pairing confirmation |
| **Screenshots** | `step4-pair-dialog.png`, `step4-form-filled.png`, `step4-pairing-success.png`, `emulator-paired.png` |
| **Issues found** | BUG #2 - First pairing code expired during testing (5-min timeout). BUG #3 - Newly paired device immediately shows "Offline" despite emulator showing "Connected" |

Pairing flow:
1. Device (emulator) requests code from API: `POST /api/v1/devices/pairing/request`
2. Device displays code on screen
3. User enters code on dashboard: `https://vizora.cloud/dashboard/devices/pair`
4. Dashboard submits: confirms pairing
5. Dashboard redirects to Devices list with new device

Post-pairing state:
- **Dashboard**: "E2E Test Device" appears in device list, status: Offline, Last Seen: Never
- **Emulator**: Transitions from pairing screen to black standby screen, status: "Connected" (green dot)

### Step 5: Upload Content

| Property | Value |
|----------|-------|
| **Status** | FAIL (blocked by subscription) |
| **What was tested** | Upload new content image via dashboard and API |
| **What happened** | API returns 403: "Your subscription is inactive. Please upgrade to continue using this feature." |
| **Time taken** | N/A |
| **Screenshots** | `step5-content-library.png` |
| **Issues found** | BUG #4 - Expired free trial blocks ALL write operations including content upload |

Content Library shows 3 pre-existing images from before trial expiry:
- E2E-Test-Image (flag, 1.4KB, uploaded 2/20/2026)
- 133865472118283293 (capybara, 2.2MB, uploaded 2/19/2026)
- 133869852463364816 (cat, 2.4MB, uploaded 2/19/2026)

### Step 6: Push Content to Device

| Property | Value |
|----------|-------|
| **Status** | FAIL (blocked by subscription) |
| **What was tested** | Push existing content to paired device via API |
| **What happened** | API returns 403: "Your subscription is inactive. Please upgrade to continue using this feature." |
| **Time taken** | N/A |
| **Screenshots** | `step6-devices-check.png` |
| **Issues found** | Same as Step 5 - subscription block prevents content push |

API tested: `POST /api/v1/displays/{deviceId}/push-content` with body `{"contentId":"...","duration":30}` - returns 403.

### Step 7: Additional Verification

| Property | Value |
|----------|-------|
| **Status** | PASS (pairing persistence only; content push not testable) |
| **What was tested** | Pairing persistence after app force-stop and restart |
| **What happened** | App reconnected automatically without re-pairing. Shows "Connected" status on black standby screen. |
| **Time taken** | ~5s from app launch to reconnection |
| **Screenshots** | `emulator-after-restart.png` |
| **Issues found** | None for persistence. Device still shows "Offline" on dashboard despite "Connected" on emulator. |

## Bugs Found

### BUG #1: Device Status Mismatch — Dashboard Shows "Offline" While Device Shows "Connected"

| Property | Value |
|----------|-------|
| **Severity** | HIGH |
| **Step** | Steps 2, 4, 7 |
| **Description** | The dashboard consistently shows all devices as "Offline" even when the Android emulator app displays "Connected" with a green indicator. This persists across page refreshes and device reconnections. |
| **Steps to Reproduce** | 1. Pair a device successfully. 2. Observe emulator shows "Connected" (green dot). 3. Navigate to Devices page on dashboard. 4. Observe device shows "Offline" (red badge). |
| **Expected** | Device status should show "Online" when the device has an active WebSocket connection to the realtime gateway. |
| **Actual** | Device always shows "Offline" regardless of actual connection state. |
| **Relevant Logs** | Dashboard WebSocket establishes (toast: "Real-time connection established") but device status doesn't update. |

**Suggested Root Cause**: The realtime gateway (`wss://vizora.cloud`) may be processing WebSocket connections correctly (device gets "Connected") but the device online status is not being written to Redis/PostgreSQL, OR the dashboard is not subscribing to the right WebSocket room events for status updates. The dual persistence pattern (Redis + PostgreSQL) means the issue could be in either write path or the dashboard's polling/subscription mechanism.

**Recommended Fix**:
1. Check if the realtime gateway's `device.gateway.ts` is emitting `device:online` events and writing to Redis (`device:{deviceId}:status`).
2. Verify the dashboard's `useSocket` hook subscribes to `org:{orgId}` room for device status events.
3. Check if the displays controller's status endpoint reads from Redis vs PostgreSQL.

### BUG #2: Pairing Code 5-Minute Expiry Too Short for Manual Entry

| Property | Value |
|----------|-------|
| **Severity** | LOW |
| **Step** | Step 4 |
| **Description** | Pairing codes expire after 5 minutes. During testing, the first code (`VNGAXU`) expired before the dashboard form could be completed, requiring a new code (`Y6CPST`). |
| **Steps to Reproduce** | 1. Generate pairing code on device. 2. Wait >5 minutes. 3. Enter code on dashboard. 4. Code is rejected. |
| **Expected** | Codes should either have a longer timeout (10-15 min) or the device should auto-refresh and show the new code prominently. |
| **Actual** | Device silently generates new codes. If user doesn't notice, they enter the old expired code. |

**Recommended Fix**: Either extend timeout to 10 minutes, or add a visible countdown timer on the device pairing screen.

### BUG #3: Newly Paired Device Shows "Last Seen: Never" and "Offline" Immediately After Pairing

| Property | Value |
|----------|-------|
| **Severity** | MEDIUM |
| **Step** | Step 4 |
| **Description** | After successful pairing, the device appears in the device list with status "Offline" and "Last Seen: Never", even though the device transitioned to "Connected" on the emulator side. |
| **Steps to Reproduce** | 1. Complete device pairing. 2. Observe device list. |
| **Expected** | Device should show "Online" and "Last Seen: Just now" immediately after successful pairing. |
| **Actual** | Shows "Offline" and "Last Seen: Never". |

**Suggested Root Cause**: Related to BUG #1. The pairing confirmation endpoint creates the device record in PostgreSQL but doesn't trigger the online status update through the realtime gateway.

### BUG #4: Expired Free Trial Blocks All Write Operations Including Content Push

| Property | Value |
|----------|-------|
| **Severity** | CRITICAL (for testing) |
| **Step** | Steps 5-6 |
| **Description** | When the free trial expires, ALL write API operations return 403 "Your subscription is inactive." This completely blocks content upload and content push to devices, making the content streaming pipeline untestable. |
| **Steps to Reproduce** | 1. Login with expired trial account. 2. Attempt `POST /api/v1/content` (upload). 3. Attempt `POST /api/v1/displays/{id}/push-content` (push). Both return 403. |
| **Expected** | Either: (a) free tier should allow limited operations, or (b) test/demo accounts should bypass subscription checks, or (c) content push to already-paired devices should work on expired trial. |
| **Actual** | All write operations blocked. Existing content is readable but cannot be pushed. |

**Impact**: Steps 5, 6, and the content streaming portion of Step 7 could not be completed.

**Recommended Fix**: Consider allowing a grace period or limited free tier that permits basic content push operations. For testing purposes, the account subscription should be extended or a test bypass should be implemented.

### BUG #5: Content Library "Offline" Status Indicator is Ambiguous

| Property | Value |
|----------|-------|
| **Severity** | LOW |
| **Step** | Step 5 |
| **Description** | The Content Library header shows "Manage your media assets (3 items) - Offline" with a red dot. It's unclear whether "Offline" refers to the MinIO storage backend, the subscription status, or something else. |
| **Expected** | Clear indication of what is offline (e.g., "Subscription inactive" or "Storage offline"). |
| **Actual** | Ambiguous "Offline" label next to item count. |

## Timing Summary

| Action | Time | Acceptable? |
|--------|------|-------------|
| Dashboard login | ~2s | YES (< 3s) |
| Devices page load | ~1s | YES (< 2s) |
| Pairing code generation (device) | ~5s | YES (< 10s) |
| Pairing completion (dashboard submit) | ~3s | YES (< 10s) |
| Content upload | BLOCKED (403) | N/A |
| Content push to device | BLOCKED (403) | N/A |
| Content display on device | BLOCKED | N/A |
| App restart + auto-reconnect | ~5s | YES (< 10s) |

## Screenshots Collected

| Filename | Description |
|----------|-------------|
| `emulator-precheck.png` | Initial app state — "Connection failed" (localhost URLs) |
| `emulator-precheck2.png` | After rebuild with production URLs — shows "Connected" with prior content |
| `emulator-pairing-screen.png` | Pairing code display: VNGAXU with QR code |
| `emulator-pairing-check.png` | Refreshed pairing code: Y6CPST (after expiry) |
| `emulator-paired.png` | After successful pairing — black screen, "Connected" |
| `emulator-after-restart.png` | After force-stop and restart — "Connected", pairing persisted |
| `step1-dashboard-login.png` | Dashboard overview after login |
| `step2-devices-page.png` | Devices page with 1 existing device (Offline) |
| `step2-devices-refreshed.png` | Devices page after refresh (still Offline) |
| `step4-pair-dialog.png` | "Pair New Device" page/form |
| `step4-form-filled.png` | Pairing form with code and name entered |
| `step4-code-field-check.png` | Code field showing Y6CPST correctly |
| `step4-pairing-success.png` | Devices list showing 2 devices after successful pairing |
| `step5-content-library.png` | Content Library with 3 existing images |
| `step5-content-detail.png` | Content Library grid view |
| `step6-devices-check.png` | Devices page — both devices Offline |

## Overall Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Pairing flow** | WORKS | Device generates code, dashboard accepts it, pairing completes on both sides. Auto-reconnect after restart works. |
| **Device status sync** | BROKEN | Dashboard always shows "Offline" despite device being "Connected". Real-time status updates are not reaching the dashboard. |
| **Content upload** | BLOCKED | Subscription paywall prevents testing. Cannot upload new content. |
| **Content push** | BLOCKED | Subscription paywall prevents testing. Cannot push existing content to devices. |
| **End-to-end** | PARTIAL PASS | Pairing works end-to-end. Content streaming pipeline untestable due to subscription block. |
| **Production ready?** | NO — WITH CONDITIONS | Pairing is ready. Content push requires: (1) fix device status sync bug, (2) active subscription for testing, (3) re-test content streaming pipeline once subscription is active. |

### Recommendations

1. **Fix device status sync (BUG #1)** — This is the highest priority. The dashboard showing all devices as "Offline" when they're actually connected undermines the entire management experience.
2. **Extend or refresh the test account subscription** — The expired trial blocks testing of the most critical flow (content push). Either extend the trial, upgrade the account, or add a test bypass.
3. **Re-run this test** after fixing BUG #1 and resolving the subscription, to validate the complete content streaming pipeline (Steps 5-7).
4. **Add a pairing code countdown timer** on the device screen to prevent expired-code confusion.
