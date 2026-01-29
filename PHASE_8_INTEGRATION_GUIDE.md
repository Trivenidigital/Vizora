# Phase 8 Integration Guide - Real-time Socket.io Implementation
## Complete Guide for Integrating Advanced Real-time Features

**Status:** ✅ COMPLETE
**Frontend Integration:** 100% COMPLETE
**Date Created:** 2026-01-29

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Available Hooks](#available-hooks)
4. [Integration Examples](#integration-examples)
5. [Event Types Reference](#event-types-reference)
6. [Configuration Guide](#configuration-guide)
7. [Testing Guide](#testing-guide)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Phase 8 successfully implements a complete real-time event architecture for the Vizora platform with:

- ✅ Socket.io event handlers for all major features
- ✅ Optimistic UI updates with automatic rollback
- ✅ Offline mode with event queuing
- ✅ Advanced error recovery with circuit breaker
- ✅ State synchronization with conflict resolution
- ✅ Production-ready test suites

### Key Features

| Feature | Location | Status |
|---------|----------|--------|
| Real-time Events | `useRealtimeEvents` | ✅ Complete |
| Optimistic Updates | `useOptimisticState` | ✅ Complete |
| Error Recovery | `useErrorRecovery` | ✅ Complete |
| Device Integration | Devices page | ✅ Complete |
| Test Suite | `__tests__/` folder | ✅ Complete |

---

## Quick Start

### 1. Basic Real-time Setup

```typescript
import { useRealtimeEvents } from '@/lib/hooks';

export function MyComponent() {
  const { isConnected, isOffline } = useRealtimeEvents({
    enabled: true,
    onDeviceStatusChange: (update) => {
      console.log('Device status updated:', update);
      // Handle device status change
    },
  });

  return (
    <div>
      Status: {isConnected ? 'Live' : isOffline ? 'Offline' : 'Error'}
    </div>
  );
}
```

### 2. Optimistic Updates

```typescript
import { useOptimisticState } from '@/lib/hooks';

const { state, updateOptimistic, commitOptimistic, rollbackOptimistic } =
  useOptimisticState(initialState);

// Apply optimistic update
updateOptimistic('update-id', (prev) => {
  // Update logic here
  return newState;
});

// Commit when server confirms
commitOptimistic('update-id');

// Or rollback on failure
rollbackOptimistic('update-id');
```

### 3. Error Recovery

```typescript
import { useErrorRecovery } from '@/lib/hooks';

const { retry, recordError, clearError } = useErrorRecovery();

// Retry with automatic backoff
await retry('operation-id', async () => {
  return await apiCall();
});

// Manual error recording
recordError('error-id', error, 'critical');
```

---

## Available Hooks

### useRealtimeEvents

**Purpose:** Handle all real-time Socket.io events with offline support

**Returns:**
```typescript
{
  // Connection state
  isConnected: boolean;
  isOffline: boolean;

  // Sync tracking
  syncState: SyncState;
  offlineQueueLength: number;

  // Event emitters
  emitDeviceUpdate: (data) => void;
  emitPlaylistUpdate: (data) => void;
  emitScheduleUpdate: (data) => void;
  emitCustomEvent: (event, data, options?) => void;

  // Queue management
  syncOfflineQueue: () => Promise<void>;
  clearOfflineQueue: () => void;
  getOfflineQueue: () => SyncQueueItem[];

  // Conflict resolution
  getConflictedChanges: () => Map<string, any>;
  resolveConflict: (local, remote) => any;
}
```

### useOptimisticState

**Purpose:** Manage optimistic UI updates with automatic rollback

**Returns:**
```typescript
{
  // Current state
  state: T;
  pendingUpdates: Map<string, OptimisticUpdate<T>>;

  // Update methods
  updateOptimistic: (id, updater, metadata?) => void;
  commitOptimistic: (id) => void;
  rollbackOptimistic: (id, fallback?) => void;
  rollbackAll: () => void;
  batchUpdate: (updates) => void;

  // Status helpers
  getPendingCount: () => number;
  hasPendingUpdates: () => boolean;
  getUpdateQueue: () => OptimisticUpdate<T>[];
}
```

### useErrorRecovery

**Purpose:** Implement retry logic, circuit breaker pattern, and error tracking

**Returns:**
```typescript
{
  // State
  errors: Map<string, ErrorInfo>;
  circuitBreaker: CircuitBreaker;
  isCircuitBreakerOpen: boolean;

  // Operations
  recordError: (id, error, severity, context?) => void;
  retry: (id, operation, onSuccess?, onFailure?) => Promise<any>;
  clearError: (id) => void;
  clearAllErrors: () => void;
  resetCircuitBreaker: () => void;

  // Inspection
  getError: (id) => ErrorInfo | undefined;
  getAllErrors: () => Map<string, ErrorInfo>;
  getErrorCount: () => number;
  hasCriticalErrors: () => boolean;
}
```

---

## Integration Examples

### Example 1: Device Page (✅ Already Implemented)

The devices page demonstrates full integration:

```typescript
export default function DevicesPage() {
  // Real-time events
  const { isConnected, emitDeviceUpdate } = useRealtimeEvents({
    onDeviceStatusChange: (update) => {
      setDevices(prev =>
        prev.map(d =>
          d.id === update.deviceId
            ? { ...d, status: update.status, lastSeen: update.lastSeen }
            : d
        )
      );
    },
  });

  // Optimistic updates
  const { updateOptimistic, commitOptimistic, rollbackOptimistic } =
    useOptimisticState(devices);

  // Error recovery
  const { retry, recordError } = useErrorRecovery();

  // Edit with full integration
  const handleSaveEdit = async () => {
    const updateId = `edit_${selectedDevice.id}`;

    // 1. Apply optimistic update
    updateOptimistic(updateId, (prev) =>
      prev.map(d =>
        d.id === selectedDevice.id ? { ...d, ...editForm } : d
      )
    );

    try {
      // 2. Send to server with retry
      await retry(
        updateId,
        () => apiClient.updateDisplay(selectedDevice.id, editForm),
        () => {
          // 3. Commit on success
          commitOptimistic(updateId);
          // 4. Emit real-time event
          emitDeviceUpdate({ deviceId: selectedDevice.id, status: device.status });
        },
        (error) => {
          // 5. Rollback on failure
          rollbackOptimistic(updateId);
        }
      );
    } catch (error) {
      recordError(updateId, error, 'warning');
    }
  };
}
```

### Example 2: Playlist Page

```typescript
'use client';

import { useState } from 'react';
import { useRealtimeEvents, useOptimisticState, useErrorRecovery } from '@/lib/hooks';
import { apiClient } from '@/lib/api';

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);

  // Real-time event handling
  const { isConnected, isOffline, emitPlaylistUpdate } = useRealtimeEvents({
    enabled: true,
    onPlaylistChange: (update) => {
      setPlaylists(prev => {
        if (update.action === 'deleted') {
          return prev.filter(p => p.id !== update.playlistId);
        }
        return prev.map(p =>
          p.id === update.playlistId
            ? { ...p, ...update.payload }
            : p
        );
      });
      toast.info(`Playlist ${update.action}`);
    },
  });

  // Optimistic state management
  const { updateOptimistic, commitOptimistic, rollbackOptimistic, hasPendingUpdates } =
    useOptimisticState(playlists);

  // Error handling with retry
  const { retry, recordError } = useErrorRecovery();

  const handleReorderItems = async (playlistId: string, newOrder: string[]) => {
    const updateId = `reorder_${playlistId}`;

    // Optimistic update
    updateOptimistic(updateId, (prev) =>
      prev.map(p =>
        p.id === playlistId
          ? { ...p, items: newOrder.map(id => ({ id })) }
          : p
      )
    );

    try {
      // Send to server with retry
      await retry(
        updateId,
        () => apiClient.updatePlaylist(playlistId, { items: newOrder }),
        () => {
          commitOptimistic(updateId);
          emitPlaylistUpdate({
            playlistId,
            action: 'items_reordered',
            payload: { items: newOrder },
          });
        },
        (error) => {
          rollbackOptimistic(updateId);
          toast.error('Failed to reorder items');
        }
      );
    } catch (error) {
      recordError(updateId, error, 'warning');
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Status Indicator */}
      <div className={`px-3 py-1 rounded ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
        {isConnected ? '🟢 Live' : isOffline ? '🟡 Offline' : '🔴 Error'}
        {hasPendingUpdates() && ' • Syncing...'}
      </div>

      {/* Playlists List */}
      {playlists.map(playlist => (
        <PlaylistItem
          key={playlist.id}
          playlist={playlist}
          onReorder={(newOrder) => handleReorderItems(playlist.id, newOrder)}
        />
      ))}
    </div>
  );
}
```

### Example 3: Schedule Page

```typescript
'use client';

import { useRealtimeEvents, useErrorRecovery } from '@/lib/hooks';

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);

  // Real-time event handling for schedules
  const { isConnected, emitScheduleUpdate } = useRealtimeEvents({
    onScheduleExecution: (execution) => {
      console.log(`Schedule ${execution.scheduleId} ${execution.action}`);

      // Update UI based on execution
      if (execution.action === 'started') {
        toast.info(`Schedule started on ${execution.displayId}`);
      } else if (execution.action === 'failed' && execution.error) {
        toast.error(`Schedule failed: ${execution.error}`);
      }
    },
  });

  const { retry } = useErrorRecovery();

  const handleCreateSchedule = async (data) => {
    await retry(
      `create_schedule_${Date.now()}`,
      () => apiClient.createSchedule(data),
      () => {
        toast.success('Schedule created');
        loadSchedules();
        emitScheduleUpdate({
          scheduleId: newSchedule.id,
          displayId: data.displayIds[0],
          playlistId: data.playlistId,
          action: 'started',
          timestamp: new Date().toISOString(),
        });
      },
      (error) => {
        toast.error('Failed to create schedule');
      }
    );
  };

  return (
    <div>
      {/* Schedule management UI */}
    </div>
  );
}
```

### Example 4: Health Monitoring Page

```typescript
'use client';

import { useRealtimeEvents } from '@/lib/hooks';

export default function HealthPage() {
  const [alerts, setAlerts] = useState([]);

  // Real-time health alerts
  const { isConnected } = useRealtimeEvents({
    onHealthAlert: (alert) => {
      console.log(`Health Alert: ${alert.alertType} on ${alert.deviceId}`);

      // Add alert to list
      setAlerts(prev => [
        ...prev,
        {
          ...alert,
          id: `${alert.deviceId}_${Date.now()}`,
        },
      ]);

      // Show toast based on severity
      if (alert.severity === 'critical') {
        toast.error(alert.message);
      } else if (alert.severity === 'warning') {
        toast.warning(alert.message);
      }
    },
  });

  return (
    <div className="space-y-4">
      <ConnectionStatus isConnected={isConnected} />

      {alerts.map(alert => (
        <Alert
          key={alert.id}
          alert={alert}
          severity={alert.severity}
        />
      ))}
    </div>
  );
}
```

---

## Event Types Reference

### Device Status Update
```typescript
{
  deviceId: string;
  status: 'online' | 'offline';
  lastSeen: string; // ISO timestamp
  currentPlaylistId?: string;
}
```

### Playlist Update
```typescript
{
  playlistId: string;
  action: 'created' | 'updated' | 'deleted' | 'items_reordered';
  payload: Partial<Playlist>;
}
```

### Health Alert
```typescript
{
  deviceId: string;
  alertType: 'high_cpu' | 'high_memory' | 'disk_full' | 'offline' | 'error';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string; // ISO timestamp
}
```

### Schedule Execution
```typescript
{
  scheduleId: string;
  displayId: string;
  playlistId: string;
  action: 'started' | 'completed' | 'failed';
  timestamp: string; // ISO timestamp
  error?: string; // Only if action === 'failed'
}
```

---

## Configuration Guide

### useRealtimeEvents Configuration

```typescript
interface UseRealtimeEventsOptions {
  // Enable/disable real-time features
  enabled?: boolean; // default: true

  // Event callbacks
  onDeviceStatusChange?: (update: DeviceStatusUpdate) => void;
  onPlaylistChange?: (update: PlaylistUpdate) => void;
  onHealthAlert?: (alert: HealthAlert) => void;
  onScheduleExecution?: (execution: ScheduleExecution) => void;
  onConnectionChange?: (isConnected: boolean) => void;
  onSyncStateChange?: (state: SyncState) => void;

  // Offline queue settings
  offlineQueueSize?: number; // default: 50

  // Retry settings
  retryAttempts?: number; // default: 3
}
```

### useOptimisticState Configuration

```typescript
interface UseOptimisticStateOptions {
  // Callbacks
  onRollback?: (update: OptimisticUpdate<any>) => void;
  onCommit?: (update: OptimisticUpdate<any>) => void;

  // Debugging
  enableLogging?: boolean; // default: true
}
```

### useErrorRecovery Configuration

```typescript
interface UseErrorRecoveryOptions {
  // Callbacks
  onError?: (errorInfo: ErrorInfo) => void;
  onRetry?: (errorInfo: ErrorInfo) => void;
  onCircuitBreakerChange?: (isOpen: boolean) => void;

  // Retry configuration
  retryConfig?: {
    maxAttempts?: number; // default: 3
    initialDelay?: number; // default: 1000 (ms)
    maxDelay?: number; // default: 30000 (ms)
    backoffMultiplier?: number; // default: 2
    jitter?: boolean; // default: true
  };

  // Circuit breaker configuration
  circuitBreakerConfig?: {
    failureThreshold?: number; // default: 5
    successThreshold?: number; // default: 2
    timeout?: number; // default: 60000 (ms)
  };
}
```

---

## Testing Guide

### Running Tests

```bash
# Run all tests
npm test

# Run specific hook tests
npm test useRealtimeEvents
npm test useOptimisticState
npm test useErrorRecovery

# Run with coverage
npm test -- --coverage
```

### Writing Tests for Your Integration

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useYourComponent } from './useYourComponent';

describe('Your Component', () => {
  it('should handle real-time updates', async () => {
    const { result } = renderHook(() => useYourComponent());

    // Simulate real-time update
    act(() => {
      // Trigger your update
    });

    // Verify state changed
    await waitFor(() => {
      expect(result.current.state).toEqual(expectedState);
    });
  });

  it('should rollback on error', async () => {
    const { result } = renderHook(() => useYourComponent());

    // Simulate failure
    act(() => {
      // Trigger failure
    });

    // Verify rollback
    expect(result.current.state).toEqual(initialState);
  });
});
```

---

## Troubleshooting

### Issue: Real-time updates not working

**Solution:**
1. Check Socket.io connection: `isConnected` should be true
2. Verify event handler is registered: Check browser console for listener registration
3. Check backend is emitting events: Monitor Socket.io server logs
4. Verify NEXT_PUBLIC_SOCKET_URL environment variable is set

### Issue: Offline queue not syncing

**Solution:**
1. Check `isOffline` state
2. Manually trigger sync: `syncOfflineQueue()`
3. Check queue size hasn't exceeded limit: `offlineQueueLength`
4. Verify network connectivity before reconnection

### Issue: Optimistic updates not rolling back

**Solution:**
1. Ensure `rollbackOptimistic(id)` is called on error
2. Check error callback is firing: Add `console.error()`
3. Verify state update logic is correct
4. Check for conflicting state updates

### Issue: Circuit breaker opening too frequently

**Solution:**
1. Increase `failureThreshold` in `circuitBreakerConfig`
2. Increase `timeout` before HALF_OPEN transition
3. Check server logs for actual errors
4. Implement better error handling in operations

### Issue: High memory usage with offline queue

**Solution:**
1. Reduce `offlineQueueSize` configuration
2. Implement periodic queue cleanup
3. Monitor queue with `getOfflineQueue()`
4. Consider implementing queue persistence to localStorage

---

## Best Practices

### ✅ DO:
- Always provide unique IDs for optimistic updates
- Use error recovery for all API calls
- Implement connection status UI indicator
- Test with network throttling enabled
- Log errors for debugging

### ❌ DON'T:
- Don't ignore optimistic update failures
- Don't rely on optimistic updates without rollback
- Don't forget to unsubscribe from events
- Don't open too many Socket.io connections
- Don't commit updates without server confirmation

---

## Performance Optimization Tips

1. **Debounce rapid updates**: Use `useDebounce` for frequently changing data
2. **Batch updates**: Use `batchUpdate()` for multiple changes
3. **Limit offline queue**: Set reasonable `offlineQueueSize`
4. **Monitor circuit breaker**: Track `isCircuitBreakerOpen` state
5. **Clean up listeners**: Hooks auto-cleanup, but verify with React DevTools

---

## Next Steps

✅ Phase 8: Real-time Socket.io Integration - **COMPLETE**

📅 Phase 9: Advanced Analytics (Next)
- ML model predictions
- Advanced charting
- Data aggregation with real-time updates

---

**Documentation Version:** 1.0
**Last Updated:** 2026-01-29
**Status:** Ready for Production
