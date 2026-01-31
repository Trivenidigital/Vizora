# Device Pairing Fix - Complete Testing Guide

**Date**: January 30, 2026
**Status**: Ready for Testing
**Version**: Final Fix - Device Identifier Persistence

---

## Quick Summary of Changes

Three critical bugs were identified and fixed:

| # | Issue | Root Cause | Status |
|---|-------|-----------|--------|
| 1 | QR code expires after 5 minutes | Early return stops polling | ✅ FIXED |
| 2 | Device shows Offline after pairing | Database not updated by WebSocket | ✅ FIXED |
| 3 | Electron stuck on pairing screen | Device identifier mismatch | ✅ FIXED (THIS COMMIT) |

---

## 🧪 Test Plan

### Prerequisites
- Electron app built with latest code
- Web dashboard accessible
- Backend services running (middleware + realtime gateway)
- Test user account ready

---

## Test 1: Fresh Pairing with New Identifier

**Objective**: Verify device generates identifier and persists it

**Steps**:

1. **Prepare Environment**
   ```bash
   # Remove electron-store cache to force new identifier
   rm ~/.vizora/config.json  # or wherever electron-store saves
   ```

2. **Start Electron App**
   ```bash
   cd display
   npm start
   ```

3. **Watch Console Output**
   - Look for: `[DeviceClient] Requesting pairing code from:`
   - Note the Device Identifier logged (should be unique to this device)
   - Example: `[DeviceClient] Device Identifier: aa:bb:cc:dd:ee:ff-abc123`

4. **Look for Persistence Log**
   - Should see: `[DeviceClient] Persisted new device identifier to store: aa:bb:cc:dd:ee:ff-abc123`
   - This confirms it was saved to disk

5. **Verify QR Code Display**
   - ✅ QR code should display on Electron window
   - ✅ Code shown below QR (e.g., "RS43W6")
   - ✅ No errors in console

6. **In Web Dashboard**
   - Open `http://localhost:4200/pairing`
   - Enter the pairing code shown in Electron
   - Click "Pair Device"

7. **Verify Pairing Completes**
   - ✅ Electron should navigate away from pairing screen
   - ✅ Content/streaming screen should appear
   - ✅ No manual restart needed
   - ✅ Console shows: `[App] ✅ Device is paired! Token received from status check`

8. **Check Device Status in Dashboard**
   - Go to Devices page
   - ✅ Device should show "Online" (not "Offline")
   - ✅ "Last Seen" should be recent (e.g., "1s ago")
   - ✅ Status badge should be green

**Expected Console Logs**:
```
[DeviceClient] Requesting pairing code from: http://localhost:3000/api/devices/pairing/request
[DeviceClient] Device Identifier: aa:bb:cc:dd:ee:ff-abc123
[DeviceClient] ✅ Pairing code received successfully: RS43W6
[DeviceClient] Persisted new device identifier to store: aa:bb:cc:dd:ee:ff-abc123
[App] Checking pairing status for code: RS43W6
[App] ✅ Device is paired! Token received from status check
```

---

## Test 2: Verify Identifier Persistence Across Restarts

**Objective**: Confirm device identifier survives app restart

**Steps**:

1. **Verify Store Contains Identifier**
   ```bash
   # After Test 1 completes, check the electron-store file
   cat ~/.vizora/config.json | grep deviceIdentifier
   # Should show: "deviceIdentifier": "aa:bb:cc:dd:ee:ff-abc123"
   ```

2. **Restart Electron App**
   - Close Electron window
   - Wait 2 seconds
   - Restart: `npm start`

3. **Watch Console for Load Log**
   - Should immediately see: `[DeviceClient] Loaded persisted device identifier from store`
   - Device identifier should be SAME as before (e.g., `aa:bb:cc:dd:ee:ff-abc123`)

4. **Verify No Re-pairing Needed**
   - After restart, check console
   - Should see: `[Main] Device token exists, connecting...`
   - Should NOT show pairing screen
   - Should show content/streaming screen directly

5. **Verify WebSocket Connection**
   - Should see: `[DeviceClient] Connected to realtime gateway`
   - Heartbeats should start: `[DeviceClient] Checking pairing status...`

**Expected Behavior**:
- Same device identifier used
- Token still valid (loaded from store)
- No pairing flow triggered
- Seamless reconnection

**Expected Console Logs**:
```
[DeviceClient] Loaded persisted device identifier from store
[Main] Device token exists, connecting...
[DeviceClient] Connecting to realtime gateway: ws://localhost:3002
[DeviceClient] Connected to realtime gateway
```

---

## Test 3: Verify Identifier Used in Multiple Pairing Checks

**Objective**: Ensure same identifier is used throughout polling loop

**Steps**:

1. **Start Fresh Electron App**
   - With no device token (will trigger pairing flow)

2. **Request Pairing Code**
   - Electron asks for code
   - Note the Device Identifier in console

3. **Watch Status Checks**
   - Let Electron poll for pairing (without completing pairing)
   - Watch console for multiple checks:
   ```
   [App] Checking pairing status for code: RS43W6
   [App] Checking pairing status for code: RS43W6  ← SAME CODE
   [App] Checking pairing status for code: RS43W6  ← SAME CODE
   ```

4. **Verify Identifier Consistency**
   - All requests should use the SAME device identifier
   - No changes in the ID between checks
   - Console should only show ONE "Persisted identifier" log

5. **Then Complete Pairing**
   - Go to web dashboard
   - Enter code and pair device
   - Should complete immediately

**Expected Behavior**:
- Multiple status checks with SAME code
- No new identifiers generated
- Pairing detected on next check after completion
- Clean transition to content screen

---

## Test 4: Multiple QR Code Refreshes

**Objective**: Verify identifier stays consistent when QR code refreshes

**Steps**:

1. **Start Electron App** (fresh pairing)

2. **Note Initial Code and Identifier**
   ```
   Initial Code: RS43W6
   Device ID: aa:bb:cc:dd:ee:ff-abc123
   ```

3. **Wait for Code Expiry (5 minutes)**
   - Electron should auto-request new code at ~4:30
   - Console shows: `[App] ⏰ Pairing code about to expire, requesting new code...`
   - New QR code should display
   - New code shown (e.g., "RK7QDD")

4. **Verify Identifier Unchanged**
   - Device ID should STILL be: `aa:bb:cc:dd:ee:ff-abc123`
   - Console should NOT show "Persisted identifier" again (only on first run)
   - Identifier remains cached from before

5. **Verify Polling Continues**
   - Should see status checks with NEW code:
   ```
   [App] Checking pairing status for code: RK7QDD
   ```

6. **Complete Pairing**
   - Use the NEW code to pair from dashboard
   - Device should immediately detect pairing
   - Navigate to content screen

**Expected Behavior**:
- Device ID never changes despite code refresh
- Polling continues after refresh
- Pairing works with refreshed code
- IPC flow triggers correctly

---

## Test 5: Concurrent Device Pairing

**Objective**: Test multiple devices can pair simultaneously

**Steps**:

1. **Start Device A**
   - Request pairing code
   - Note Device ID A: `aa:bb:cc:dd:ee:ff-abc123`
   - Note Code A: `RS43W6`

2. **Start Device B** (separate machine or another Electron instance)
   - Request pairing code
   - Note Device ID B: `aa:bb:cc:dd:ee:ff-xyz789` (DIFFERENT from A)
   - Note Code B: `RK7QDD`

3. **Pair Device A**
   - Use Code A to pair
   - Device A should navigate to content screen
   - Check dashboard: Device A shows "Online"

4. **Pair Device B**
   - Use Code B to pair
   - Device B should navigate to content screen
   - Check dashboard: Device B shows "Online"

5. **Verify Device List**
   - Both devices listed separately
   - Both show "Online" status
   - Both have correct identifiers

**Expected Behavior**:
- Each device gets unique identifier (based on its MAC address)
- No cross-contamination between devices
- All devices can pair independently
- All devices maintain correct pairing status

---

## Test 6: Error Recovery

**Objective**: Verify system handles errors gracefully

**Steps**:

1. **Test Invalid Code**
   - Electron requests code
   - Manually enter wrong code in dashboard
   - Click "Pair Device"
   - Electron should continue polling (not get stuck)
   - Eventually show error or retry logic

2. **Test Network Interruption**
   - Start pairing flow
   - Disconnect network
   - Reconnect after 30 seconds
   - Device should resume polling
   - Should eventually detect pairing once reconnected

3. **Test Backend Restart**
   - Device paired and running
   - Restart middleware/gateway
   - Device should reconnect
   - Status should recover
   - No manual intervention needed

**Expected Behavior**:
- Graceful error handling
- Automatic recovery
- No infinite loops
- User gets meaningful feedback

---

## ❌ Problems to Watch For

### Issue: Device shows wrong identifier
```
✅ FIXED: Device identifier now persists
❌ If different ID on each start, fix didn't work
   → Check if electron-store is properly initialized
   → Check file permissions for ~/.vizora/
```

### Issue: Pairing still doesn't complete
```
✅ FIXED: Identifier consistency now allows lookup
❌ If still stuck on pairing screen:
   → Check console for device ID mismatch
   → Verify backend is finding the paired Display
   → Check middleware logs
```

### Issue: Device shows offline after pairing
```
✅ FIXED: Database sync from previous commit
❌ If still offline:
   → Check WebSocket connection (port 3002)
   → Verify DatabaseService injection in device.gateway.ts
   → Check middleware logs for DB update errors
```

### Issue: QR code doesn't refresh
```
✅ FIXED: Polling continues with new code
❌ If code doesn't change at 5 minutes:
   → App may not have reached refresh threshold
   → Wait longer or restart app
   → Check polling loop in app.ts
```

---

## 🔧 Debugging Commands

### View Electron Store Contents
```bash
cat ~/.vizora/config.json | jq .
# Should show:
# {
#   "deviceToken": "...",
#   "deviceIdentifier": "aa:bb:cc:dd:ee:ff-abc123"
# }
```

### Clear Store (Reset Device)
```bash
rm ~/.vizora/config.json
# Next app start will request new pairing code
```

### Check Device Identifier Multiple Times
```bash
# In console (first call):
console.log(await window.electronAPI.getDeviceInfo())

# Or grep logs:
grep "Device Identifier" console.log
```

### Verify Pairing in Database
```sql
-- From database
SELECT id, nickname, status, jwtToken, createdAt
FROM "Display"
WHERE nickname = '<device-hostname>'
ORDER BY createdAt DESC
LIMIT 1;

-- Should show:
-- status: 'online' or 'paired'
-- jwtToken: NOT NULL
```

### Check Redis Status
```bash
redis-cli GET "device:status:<device-id>"
# Should show current device status and lastHeartbeat
```

---

## ✅ Checklist: All Tests Passing

- [ ] Test 1: Fresh pairing completes successfully
- [ ] Test 2: Identifier persists across restart
- [ ] Test 3: Same identifier used in polling loop
- [ ] Test 4: QR refresh doesn't change identifier
- [ ] Test 5: Multiple devices pair independently
- [ ] Test 6: Error recovery works gracefully
- [ ] Console shows no errors or warnings
- [ ] Device status appears immediately in dashboard
- [ ] IPC chain works (pairing → navigation)
- [ ] WebSocket connection established

---

## 📝 Test Results Template

```
═══════════════════════════════════════════════════════════════
Device Pairing Fix - Test Results
═══════════════════════════════════════════════════════════════

Tester: [Your Name]
Date: [Date]
Build Commit: [Commit Hash]

TEST 1: Fresh Pairing
Status: [ ] PASS [ ] FAIL
Notes:

TEST 2: Identifier Persistence
Status: [ ] PASS [ ] FAIL
Notes:

TEST 3: Polling Loop Consistency
Status: [ ] PASS [ ] FAIL
Notes:

TEST 4: QR Code Refresh
Status: [ ] PASS [ ] FAIL
Notes:

TEST 5: Concurrent Devices
Status: [ ] PASS [ ] FAIL
Notes:

TEST 6: Error Recovery
Status: [ ] PASS [ ] FAIL
Notes:

OVERALL RESULT: [ ] ALL PASS [ ] SOME FAILURES
Issues Found:

═══════════════════════════════════════════════════════════════
```

---

## 🚀 Next Steps After Testing

If all tests pass:

1. **Commit the fix**
   ```bash
   git add .
   git commit -m "fix: persist device identifier across pairing requests

   - Store device identifier in electron-store
   - Use in-memory cache for performance
   - Load from persistent store on app restart
   - Ensures consistent ID across all pairing operations
   - Fixes issue #3: Electron stuck on pairing screen
   - Enables proper pairing detection and navigation"
   ```

2. **Build all services**
   ```bash
   npm run build:display
   npm run build:middleware
   npm run build:realtime
   ```

3. **Deploy**
   ```bash
   docker-compose up -d
   ```

4. **Monitor**
   - Watch logs for device connections
   - Verify pairing flow works for real users
   - Check dashboard for device status accuracy

---

## 📞 Support

If tests fail or issues arise:

1. Check console logs for `[DeviceClient]` and `[App]` messages
2. Verify device identifier is being persisted
3. Check that same identifier is used in status checks
4. Verify backend finds paired Display record
5. Check WebSocket connection and heartbeat flow

**Common Issues & Quick Fixes**:

| Issue | Check | Fix |
|-------|-------|-----|
| Identifier changes on restart | electron-store location | Verify file exists and is readable |
| Status checks use different IDs | Console logs | Check getDeviceIdentifier() caching logic |
| Pairing still not detected | Backend logs | Verify Display record created with correct ID |
| Device shows offline | Database/Redis | Check device.gateway.ts database updates |

---

## ✅ Conclusion

This comprehensive testing guide covers all aspects of the device identifier persistence fix. Follow all tests to ensure the pairing flow works correctly and users can seamlessly pair devices and navigate to content streaming.

**Status**: Ready for QA Testing
**Build**: Ready for Deployment
**Date**: January 30, 2026
