// Real-time Event Handlers for Vizora
// Manages Socket.io events with advanced state synchronization, optimistic updates, and error recovery

import { useEffect, useCallback, useRef, useState } from 'react';
import { useSocket } from './useSocket';
import type { Display, Content, Playlist, Schedule } from '../types';

// Event types
export type DeviceStatusUpdate = {
  deviceId: string;
  status: 'online' | 'offline';
  lastSeen: string;
  currentPlaylistId?: string;
};

export type PlaylistUpdate = {
  playlistId: string;
  action: 'created' | 'updated' | 'deleted' | 'items_reordered';
  payload: Partial<Playlist>;
};

export type HealthAlert = {
  deviceId: string;
  alertType: 'high_cpu' | 'high_memory' | 'disk_full' | 'offline' | 'error';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
};

export type ScheduleExecution = {
  scheduleId: string;
  displayId: string;
  playlistId: string;
  action: 'started' | 'completed' | 'failed';
  timestamp: string;
  error?: string;
};

// Sync Queue for offline support
interface SyncQueueItem {
  id: string;
  event: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

// State synchronization with conflict resolution
interface SyncState {
  lastSyncTime: number;
  pendingChanges: Map<string, any>;
  conflictedChanges: Map<string, any>;
}

export interface UseRealtimeEventsOptions {
  enabled?: boolean;
  auth?: {
    token?: string;
    organizationId?: string;
  };
  onDeviceStatusChange?: (update: DeviceStatusUpdate) => void;
  onPlaylistChange?: (update: PlaylistUpdate) => void;
  onHealthAlert?: (alert: HealthAlert) => void;
  onScheduleExecution?: (execution: ScheduleExecution) => void;
  onConnectionChange?: (isConnected: boolean) => void;
  onSyncStateChange?: (state: SyncState) => void;
  offlineQueueSize?: number;
  retryAttempts?: number;
}

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
  const {
    enabled = true,
    auth,
    onDeviceStatusChange,
    onPlaylistChange,
    onHealthAlert,
    onScheduleExecution,
    onConnectionChange,
    onSyncStateChange,
    offlineQueueSize = 50,
    retryAttempts = 3,
  } = options;

  const { socket, isConnected, on } = useSocket({ auth });
  const [isOffline, setIsOffline] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>({
    lastSyncTime: Date.now(),
    pendingChanges: new Map(),
    conflictedChanges: new Map(),
  });

  // Offline sync queue
  const syncQueueRef = useRef<SyncQueueItem[]>([]);
  const offlineQueueRef = useRef<SyncQueueItem[]>([]);

  // Emit event with optimistic update support
  const emitEvent = useCallback(
    (event: string, data: any, options?: { optimistic?: boolean; onRollback?: () => void }) => {
      if (!socket) return;

      const eventId = `${event}_${Date.now()}_${Math.random()}`;

      // Add to pending changes if optimistic
      if (options?.optimistic) {
        setSyncState((prev) => ({
          ...prev,
          pendingChanges: new Map(prev.pendingChanges).set(eventId, { event, data }),
        }));
      }

      // Emit through socket or add to offline queue
      if (isConnected && socket) {
        socket.emit(event, { ...data, eventId });
      } else {
        // Add to offline queue
        const queueItem: SyncQueueItem = {
          id: eventId,
          event,
          data: { ...data, eventId },
          timestamp: Date.now(),
          retryCount: 0,
        };

        offlineQueueRef.current.push(queueItem);

        // Respect queue size limit
        if (offlineQueueRef.current.length > offlineQueueSize) {
          offlineQueueRef.current.shift();
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[RealtimeEvents] Event queued offline:', event, queueItem);
        }
      }
    },
    [socket, isConnected, offlineQueueSize]
  );

  // Conflict resolution for state synchronization
  const resolveConflict = useCallback(
    (localChange: any, remoteChange: any): any => {
      // Strategy: Remote wins (server is source of truth)
      // But merge if they affect different fields
      if (
        typeof localChange === 'object' &&
        typeof remoteChange === 'object' &&
        !Array.isArray(localChange)
      ) {
        return {
          ...localChange,
          ...remoteChange,
          // Keep local timestamp for optimistic updates
          _localTimestamp: localChange._localTimestamp,
          _remoteTimestamp: remoteChange._remoteTimestamp,
        };
      }
      return remoteChange;
    },
    []
  );

  // Sync offline queue when reconnected
  const syncOfflineQueue = useCallback(async () => {
    if (!isConnected || !socket) return;

    const itemsToSync = [...offlineQueueRef.current];
    if (process.env.NODE_ENV === 'development') {
      console.log('[RealtimeEvents] Syncing offline queue, items:', itemsToSync.length);
    }

    for (const item of itemsToSync) {
      if (item.retryCount >= retryAttempts) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[RealtimeEvents] Max retries exceeded for:', item.event, item.id);
        }
        // Move to conflicted changes for manual resolution
        setSyncState((prev) => ({
          ...prev,
          conflictedChanges: new Map(prev.conflictedChanges).set(item.id, item),
        }));
        continue;
      }

      try {
        socket.emit(item.event, item.data);
        item.retryCount++;

        // Remove from queue after successful emit
        offlineQueueRef.current = offlineQueueRef.current.filter((qi) => qi.id !== item.id);
        if (process.env.NODE_ENV === 'development') {
          console.log('[RealtimeEvents] Successfully synced:', item.event);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[RealtimeEvents] Failed to sync event:', error);
        }
        item.retryCount++;
      }
    }

    // Update sync state
    setSyncState((prev) => ({
      ...prev,
      lastSyncTime: Date.now(),
    }));
  }, [isConnected, socket, retryAttempts]);

  // Device status update handler
  const handleDeviceStatusUpdate = useCallback(
    (update: DeviceStatusUpdate) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeEvents] Device status update:', update);
      }
      onDeviceStatusChange?.(update);

      // Remove from pending changes if this was an optimistic update
      setSyncState((prev) => ({
        ...prev,
        pendingChanges: new Map(
          [...prev.pendingChanges].filter(([_, val]) => val.deviceId !== update.deviceId)
        ),
      }));
    },
    [onDeviceStatusChange]
  );

  // Playlist update handler with conflict resolution
  const handlePlaylistUpdate = useCallback(
    (update: PlaylistUpdate) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeEvents] Playlist update:', update);
      }
      onPlaylistChange?.(update);

      // Check for conflicts with pending changes
      setSyncState((prev) => {
        const conflicted = [...prev.pendingChanges.entries()].filter(
          ([_, val]) => val.playlistId === update.playlistId
        );

        if (conflicted.length > 0) {
          const resolved = resolveConflict(conflicted[0][1], update.payload);
          return {
            ...prev,
            pendingChanges: new Map(
              [...prev.pendingChanges].filter(([id]) => !conflicted.some(([cId]) => cId === id))
            ),
          };
        }

        return prev;
      });
    },
    [onPlaylistChange, resolveConflict]
  );

  // Health alert handler
  const handleHealthAlert = useCallback(
    (alert: HealthAlert) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeEvents] Health alert:', alert);
      }
      onHealthAlert?.(alert);
    },
    [onHealthAlert]
  );

  // Schedule execution handler
  const handleScheduleExecution = useCallback(
    (execution: ScheduleExecution) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeEvents] Schedule execution:', execution);
      }
      onScheduleExecution?.(execution);
    },
    [onScheduleExecution]
  );

  // Setup Socket.io event listeners
  useEffect(() => {
    if (!enabled || !socket) return;

    // Device status updates (gateway emits 'device:status')
    const unsubDeviceStatus = on('device:status', handleDeviceStatusUpdate);

    // Playlist changes
    const unsubPlaylist = on('playlist:updated', handlePlaylistUpdate);

    // Health alerts
    const unsubHealth = on('health:alert', handleHealthAlert);

    // Schedule execution
    const unsubSchedule = on('schedule:executed', handleScheduleExecution);

    // Connection state change
    const unsubConnect = on('connect', () => {
      setIsOffline(false);
      onConnectionChange?.(true);
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeEvents] Connected, syncing offline queue...');
      }
      syncOfflineQueue();
    });

    const unsubDisconnect = on('disconnect', () => {
      setIsOffline(true);
      onConnectionChange?.(false);
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeEvents] Disconnected, offline mode enabled');
      }
    });

    // Sync state update callback
    if (onSyncStateChange) {
      onSyncStateChange(syncState);
    }

    return () => {
      unsubDeviceStatus?.();
      unsubPlaylist?.();
      unsubHealth?.();
      unsubSchedule?.();
      unsubConnect?.();
      unsubDisconnect?.();
    };
  }, [
    enabled,
    socket,
    on,
    handleDeviceStatusUpdate,
    handlePlaylistUpdate,
    handleHealthAlert,
    handleScheduleExecution,
    onConnectionChange,
    onSyncStateChange,
    syncOfflineQueue,
  ]);

  // Monitor offline/online status
  useEffect(() => {
    const handleOnline = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeEvents] Browser online, attempting to sync...');
      }
      setIsOffline(false);
      if (isConnected) {
        syncOfflineQueue();
      }
    };

    const handleOffline = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeEvents] Browser offline, queuing events...');
      }
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, syncOfflineQueue]);

  // Public API
  return {
    // State
    isConnected,
    isOffline,
    syncState,
    offlineQueueLength: offlineQueueRef.current.length,

    // Methods
    emitDeviceUpdate: (data: DeviceStatusUpdate) => {
      emitEvent('device:update', data, { optimistic: true });
    },
    emitPlaylistUpdate: (data: PlaylistUpdate) => {
      emitEvent('playlist:update', data, { optimistic: true });
    },
    emitScheduleUpdate: (data: ScheduleExecution) => {
      emitEvent('schedule:update', data, { optimistic: true });
    },
    emitCustomEvent: (event: string, data: any, options?: { optimistic?: boolean }) => {
      emitEvent(event, data, options);
    },

    // Sync management
    syncOfflineQueue,
    clearOfflineQueue: () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[RealtimeEvents] Clearing offline queue');
      }
      offlineQueueRef.current = [];
    },
    getOfflineQueue: () => [...offlineQueueRef.current],
    getConflictedChanges: () => new Map(syncState.conflictedChanges),
    resolveConflict,
  };
}
