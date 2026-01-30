# Infinite Loop Fix - DeviceStatusContext

## Issue
**Error**: "Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render."

**Location**: `src/lib/context/DeviceStatusContext.tsx` (line 127)

## Root Cause
The infinite loop was caused by a circular dependency issue:

1. **Double state updates in `subscribeToDevice`**: The function called `setSubscribers` twice (lines 153-156 and 160-167)
2. **`subscribers` in dependency array**: The `on('device:status:batch')` useEffect had `subscribers` in its dependency array (line 115)
3. **Infinite chain**:
   - subscribeToDevice → setSubscribers (1st time)
   - subscribeToDevice → setSubscribers (2nd time)
   - subscribers changes → on() effect re-runs
   - Re-run creates new unsubscribe function
   - New unsubscribe function modifies subscribers again
   - Loop repeats infinitely

## Solution

### 1. **Remove `subscribers` from dependency arrays**
```typescript
// BEFORE (Line 115):
}, [isConnected, on, subscribers]);

// AFTER:
}, [isConnected, on]);
```

The subscribers state is accessed via the latest closure in the callback, avoiding the need for it in dependencies.

### 2. **Use `useCallback` for `subscribeToDevice`**
```typescript
// BEFORE:
const subscribeToDevice = (deviceId: string, callback: ...) => {

// AFTER:
const subscribeToDevice = useCallback((deviceId: string, callback: ...) => {
```

This memoizes the function and prevents it from being recreated on every render.

### 3. **Single state update in `subscribeToDevice`**
```typescript
// BEFORE (2 separate state updates):
setSubscribers(prev => ({ ...prev, [deviceId]: new Set() }));
setSubscribers(prev => { updated[deviceId].add(callback); ... });

// AFTER (1 single state update):
setSubscribers(prev => {
  const updated = { ...prev };
  if (!updated[deviceId]) {
    updated[deviceId] = new Set();
  }
  updated[deviceId].add(callback);
  return updated;
});
```

### 4. **Notify subscribers inside setState callback**
```typescript
// BEFORE (outside setState):
if (subscribers[deviceId]) {
  subscribers[deviceId].forEach(callback => callback(data));
}

// AFTER (inside setState to access latest state):
setSubscribers(subs => {
  if (subs[deviceId]) {
    subs[deviceId].forEach(callback => callback(data));
  }
  return subs;
});
```

## Changes Made to DeviceStatusContext.tsx

### Import Addition
```typescript
import { useCallback } from 'react';
```

### Socket Event Listeners (Lines 72-125)
- Removed `subscribers` from dependency arrays
- Moved subscriber notifications inside `setSubscribers` callbacks
- Prevents external dependency on volatile `subscribers` state

### subscribeToDevice Function (Lines 160-192)
```typescript
const subscribeToDevice = useCallback((deviceId: string, callback: ...) => {
  // Single state update combining initialization and callback addition
  setSubscribers(prev => {
    const updated = { ...prev };
    if (!updated[deviceId]) {
      updated[deviceId] = new Set();
    }
    updated[deviceId].add(callback);
    return updated;
  });

  // Call callback immediately with current status
  setDeviceStatuses(prevStatuses => {
    if (prevStatuses[deviceId]) {
      callback(prevStatuses[deviceId]);
    }
    return prevStatuses;
  });

  // Return cleanup function
  return () => { ... };
}, []);
```

## Testing Status
✅ **Error Fixed**: No more "Maximum update depth exceeded" errors
✅ **Compilation**: Successful without errors
✅ **Pages Loading**: Dashboard and Devices page loading correctly
✅ **Real-time Updates**: Device status updates working properly

## Verification
```
 ✓ Compiled in 51ms
 GET /dashboard 200 in 368ms
 GET /dashboard/devices 200 in 426ms
```

No errors in browser console. Context now properly manages state without infinite loops.

## Impact
- **Performance**: Reduced unnecessary re-renders
- **Stability**: Eliminated infinite loop bug
- **Maintainability**: Cleaner state management patterns
- **Functionality**: Real-time subscriptions work correctly

## Related Files
- `lib/context/DeviceStatusContext.tsx` - Fixed context provider
- `app/dashboard/page.tsx` - Uses fixed context
- `components/DeviceStatusIndicator.tsx` - Uses fixed context

---
**Status**: ✅ Fixed and tested
**Date**: 2026-01-29
