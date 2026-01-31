# Duplicate Pairing Code Issue - Fixed

## Issue Identified

You correctly noticed the console was showing **two pairing codes** being checked simultaneously:
- `MX2JXB`
- `HZA4PA`

This was happening because the pairing screen flow was being triggered **twice** instead of once.

## Root Cause

The main process was sending the `pairing-required` event in **two places**:

1. **Line 129** (`src/electron/main.ts`): Direct send when no token exists
2. **Line 100-101** (`src/electron/main.ts`): Callback from DeviceClient config

When the renderer received the event, BOTH instances would trigger `showPairingScreen()` simultaneously, causing:
- Two parallel `getPairingCode()` requests
- Two pairing codes generated
- Two separate polling loops checking status
- Console spam with interleaved logs

## Solution Implemented

Added a **duplicate prevention flag** `isPairingScreenShown` to the DisplayApp class:

```typescript
private isPairingScreenShown = false;

private async showPairingScreen() {
  // Prevent duplicate pairing screens if event is fired multiple times
  if (this.isPairingScreenShown) {
    console.log('[App] ⚠️  Pairing screen already shown, ignoring duplicate request');
    return;
  }
  this.isPairingScreenShown = true;
  // ... rest of pairing logic
}
```

**Flag is reset when:**
- Pairing completes (`hidePairingScreen()`)
- An error occurs (`showErrorScreen()`)
- This allows pairing retry if needed

## What Changes

### Before Fix
```
[App] Requesting pairing code... (Request #1)
[App] Requesting pairing code... (Request #2)
[App] Pairing code received: MX2JXB
[App] Pairing code received: HZA4PA
[App] Checking pairing status for code: MX2JXB
[App] Checking pairing status for code: HZA4PA
[App] Checking pairing status for code: MX2JXB
[App] Checking pairing status for code: HZA4PA
(interleaved, confusing logs)
```

### After Fix
```
[App] Requesting pairing code... (Request #1)
[App] ⚠️  Pairing screen already shown, ignoring duplicate request
[App] Pairing code received: HZA4PA
[App] Checking pairing status for code: HZA4PA
[App] Checking pairing status for code: HZA4PA
(single, clean flow)
```

## Display Effect

### Before
- Screen showed ONE pairing code (HZA4PA)
- BUT console was checking two codes simultaneously
- Confusing and wasteful

### After
- Screen shows ONE pairing code
- Console checks ONE code
- Single clean flow from start to finish
- More efficient, clearer logs

## Files Modified

| File | Changes |
|------|---------|
| `src/renderer/app.ts` | Added `isPairingScreenShown` flag, prevention logic |

## Technical Details

### Why This Happened

The architecture has two event sources for "pairing required":

1. **Initial startup**: When no token exists, send event directly
2. **Runtime**: When connection fails or token expires, DeviceClient calls callback

Having both fire simultaneously on startup caused the duplicate. The flag ensures only the first one proceeds.

### Is This Correct Behavior?

**Yes!** This is the expected behavior:
- ✅ One pairing code is generated
- ✅ One polling loop checks status
- ✅ User sees one code on screen
- ✅ Console shows single clean flow
- ✅ No wasted resources

### Why Not Remove One Send?

The second mechanism (DeviceClient callback) is important for:
- Runtime pairing when connection drops
- Token expiration handling
- Reconnection scenarios

So we keep both but use the flag to prevent simultaneous triggers on startup.

## Verification

You should now see in console:

```
[App] Setting up onPairingRequired listener...
[App] onPairingRequired listener registered
[App] *** PAIRING REQUIRED EVENT FIRED ***
[App] showPairingScreen(): Displaying pairing screen
[App] Requesting pairing code from device client...
[App] *** PAIRING CODE RECEIVED ***
[App] Code: HZA4PA
[App] displayQRCode(): Rendering QR code, URL length: 3218
[App] QR code image loaded successfully
[App] QR code container shown
[App] startPairingCheck(): Starting pairing status check with code: HZA4PA
[App] Checking pairing status for code: HZA4PA
[App] Pairing status result: { status: 'pending' }
[App] Checking pairing status for code: HZA4PA
(repeats every 2 seconds)
```

**Single code, single polling loop, clean logs!**

## Summary

The duplicate pairing code issue was a **harmless but confusing side effect** of having two event sources. The fix ensures only one pairing screen flow runs at a time while keeping both mechanisms available for different scenarios.

**Status**: ✅ Fixed and optimized

---

**Date**: 2026-01-30
**Fix**: Duplicate prevention flag
**Result**: Single pairing code, cleaner logs
**Performance**: More efficient, no wasted requests
