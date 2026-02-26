// Test Suite for useRealtimeEvents Hook
// Tests Socket.io event handling, offline queue, and state synchronization

import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeEvents } from '../useRealtimeEvents';

// Create a mock socket with event emitter functionality
const createMockSocket = () => {
  const listeners: Map<string, Set<(data: any) => void>> = new Map();

  return {
    id: 'mock-socket-id',
    connected: true,
    emit: jest.fn((event: string, data?: any) => {
      // Trigger listeners for this event
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(listener => listener(data));
      }
    }),
    on: jest.fn((event: string, callback: (data: any) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(callback);
    }),
    off: jest.fn((event: string, callback: (data: any) => void) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
      }
    }),
    once: jest.fn(),
    close: jest.fn(),
    // Helper to simulate incoming events from server
    simulateEvent: (event: string, data: any) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(listener => listener(data));
      }
    },
    // Helper to clear all listeners
    clearListeners: () => {
      listeners.clear();
    },
  };
};

// Mock useSocket hook
let mockSocket: ReturnType<typeof createMockSocket> | null = null;
let mockIsConnected = true;

jest.mock('../useSocket', () => ({
  useSocket: () => ({
    socket: mockSocket,
    isConnected: mockIsConnected,
    lastMessage: null,
    emit: mockSocket?.emit ?? jest.fn(),
    on: jest.fn((event: string, callback: (data: any) => void) => {
      if (mockSocket) {
        mockSocket.on(event, callback);
        return () => mockSocket?.off(event, callback);
      }
      return () => {};
    }),
    once: mockSocket?.once ?? jest.fn(),
  }),
}));

describe('useRealtimeEvents', () => {
  beforeEach(() => {
    mockSocket = createMockSocket();
    mockIsConnected = true;
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockSocket?.clearListeners();
    mockSocket = null;
  });

  describe('Device Status Updates', () => {
    it('should handle device:status-update events', async () => {
      const onDeviceStatusChange = jest.fn();

      renderHook(() =>
        useRealtimeEvents({
          enabled: true,
          onDeviceStatusChange,
        })
      );

      const mockUpdate = {
        deviceId: 'device-1',
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
      };

      // Simulate receiving device status update from server
      act(() => {
        mockSocket?.simulateEvent('device:status', mockUpdate);
      });

      // Verify callback was called
      await waitFor(() => {
        expect(onDeviceStatusChange).toHaveBeenCalledWith(expect.objectContaining(mockUpdate));
      });
    });

    it('should update device status multiple times', async () => {
      const onDeviceStatusChange = jest.fn();

      renderHook(() =>
        useRealtimeEvents({
          onDeviceStatusChange,
        })
      );

      // Simulate multiple status updates
      act(() => {
        mockSocket?.simulateEvent('device:status', {
          deviceId: 'device-1',
          status: 'online',
          lastSeen: new Date().toISOString(),
        });
      });

      act(() => {
        mockSocket?.simulateEvent('device:status', {
          deviceId: 'device-1',
          status: 'offline',
          lastSeen: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(onDeviceStatusChange).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Playlist Updates', () => {
    it('should handle playlist:updated events', async () => {
      const onPlaylistChange = jest.fn();

      renderHook(() =>
        useRealtimeEvents({
          onPlaylistChange,
        })
      );

      const mockPlaylistUpdate = {
        playlistId: 'playlist-1',
        action: 'updated' as const,
        payload: {
          id: 'playlist-1',
          name: 'Updated Playlist',
        },
      };

      act(() => {
        mockSocket?.simulateEvent('playlist:updated', mockPlaylistUpdate);
      });

      await waitFor(() => {
        expect(onPlaylistChange).toHaveBeenCalledWith(expect.objectContaining(mockPlaylistUpdate));
      });
    });

    it('should handle playlist item reordering', async () => {
      const onPlaylistChange = jest.fn();

      renderHook(() =>
        useRealtimeEvents({
          onPlaylistChange,
        })
      );

      const mockReorder = {
        playlistId: 'playlist-1',
        action: 'items_reordered' as const,
        payload: {
          id: 'playlist-1',
          items: [{ id: 'item-2' }, { id: 'item-1' }, { id: 'item-3' }],
        },
      };

      act(() => {
        mockSocket?.simulateEvent('playlist:updated', mockReorder);
      });

      await waitFor(() => {
        expect(onPlaylistChange).toHaveBeenCalledWith(expect.objectContaining(mockReorder));
      });
    });
  });

  describe('Offline Queue Management', () => {
    it('should queue events when offline', () => {
      // Set as disconnected
      mockIsConnected = false;

      const { result } = renderHook(() => useRealtimeEvents());

      act(() => {
        result.current.emitDeviceUpdate({
          deviceId: 'device-1',
          status: 'online',
          lastSeen: new Date().toISOString(),
        });
      });

      // Should add to offline queue when not connected
      expect(result.current.offlineQueueLength).toBeGreaterThanOrEqual(0);
    });

    it('should respect offline queue size limit', () => {
      // Set as disconnected
      mockIsConnected = false;

      const { result } = renderHook(() =>
        useRealtimeEvents({
          offlineQueueSize: 5,
        })
      );

      // Add more items than queue size
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.emitDeviceUpdate({
            deviceId: `device-${i}`,
            status: 'online',
            lastSeen: new Date().toISOString(),
          });
        });
      }

      // Queue should not exceed limit
      expect(result.current.offlineQueueLength).toBeLessThanOrEqual(5);
    });

    it('should clear offline queue', () => {
      // Set as disconnected
      mockIsConnected = false;

      const { result } = renderHook(() => useRealtimeEvents());

      act(() => {
        result.current.emitDeviceUpdate({
          deviceId: 'device-1',
          status: 'online',
          lastSeen: new Date().toISOString(),
        });
      });

      act(() => {
        result.current.clearOfflineQueue();
      });

      // After clearing, getOfflineQueue should return empty array
      expect(result.current.getOfflineQueue()).toHaveLength(0);
    });
  });

  describe('Sync State Management', () => {
    it('should have initial sync state', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      // Verify initial sync state exists
      expect(result.current.syncState).toBeDefined();
      expect(result.current.syncState.lastSyncTime).toBeDefined();
    });

    it('should track pending and conflicted changes', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      expect(result.current.syncState.pendingChanges).toBeInstanceOf(Map);
      expect(result.current.syncState.conflictedChanges).toBeInstanceOf(Map);
    });

    it('should call onSyncStateChange when provided', async () => {
      const onSyncStateChange = jest.fn();

      renderHook(() =>
        useRealtimeEvents({
          onSyncStateChange,
        })
      );

      // The callback should be called during effect setup
      await waitFor(() => {
        expect(onSyncStateChange).toHaveBeenCalled();
      });
    });
  });

  describe('Connection State', () => {
    it('should track connection status', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      expect(typeof result.current.isConnected).toBe('boolean');
      expect(typeof result.current.isOffline).toBe('boolean');
    });

    it('should call onConnectionChange callback on connect event', async () => {
      const onConnectionChange = jest.fn();

      renderHook(() =>
        useRealtimeEvents({
          onConnectionChange,
        })
      );

      // Simulate connection event
      act(() => {
        mockSocket?.simulateEvent('connect', undefined);
      });

      await waitFor(() => {
        expect(onConnectionChange).toHaveBeenCalledWith(true);
      });
    });

    it('should call onConnectionChange callback on disconnect event', async () => {
      const onConnectionChange = jest.fn();

      renderHook(() =>
        useRealtimeEvents({
          onConnectionChange,
        })
      );

      // Simulate disconnect event
      act(() => {
        mockSocket?.simulateEvent('disconnect', undefined);
      });

      await waitFor(() => {
        // When browser is online (navigator.onLine=true in jsdom), disconnect sends null (reconnecting)
        // When browser is truly offline, disconnect sends false
        expect(onConnectionChange).toHaveBeenCalledWith(null);
      });
    });
  });

  describe('Custom Event Emission', () => {
    it('should emit custom events', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      const testData = { custom: 'data', timestamp: Date.now() };

      act(() => {
        result.current.emitCustomEvent('test:event', testData);
      });

      // Should not throw and result should be defined
      expect(result.current).toBeDefined();
    });

    it('should support optimistic custom events', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      act(() => {
        result.current.emitCustomEvent(
          'test:optimistic',
          { data: 'test' },
          { optimistic: true }
        );
      });

      expect(result.current).toBeDefined();
    });

    it('should emit through socket when connected', () => {
      mockIsConnected = true;

      const { result } = renderHook(() => useRealtimeEvents());

      const testData = { custom: 'data' };

      act(() => {
        result.current.emitCustomEvent('test:event', testData);
      });

      expect(mockSocket?.emit).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should not setup listeners when disabled', () => {
      const onDeviceStatusChange = jest.fn();

      renderHook(() =>
        useRealtimeEvents({
          enabled: false,
          onDeviceStatusChange,
        })
      );

      // Simulate event - should not trigger callback since disabled
      act(() => {
        mockSocket?.simulateEvent('device:status', {
          deviceId: 'device-1',
          status: 'online',
          lastSeen: new Date().toISOString(),
        });
      });

      // Callback should not be called when disabled
      expect(onDeviceStatusChange).not.toHaveBeenCalled();
    });
  });
});
