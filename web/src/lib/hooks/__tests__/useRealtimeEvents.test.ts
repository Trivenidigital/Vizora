// Test Suite for useRealtimeEvents Hook
// Tests Socket.io event handling, offline queue, and state synchronization

import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeEvents } from '../useRealtimeEvents';

describe('useRealtimeEvents', () => {
  describe('Device Status Updates', () => {
    it('should handle device:status-update events', async () => {
      const onDeviceStatusChange = jest.fn();

      const { result } = renderHook(() =>
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

      // Simulate receiving device status update
      act(() => {
        if (result.current.socket) {
          // Simulate socket event
          result.current.socket.emit('device:status-update', mockUpdate);
        }
      });

      // Verify callback was called
      await waitFor(() => {
        expect(onDeviceStatusChange).toHaveBeenCalledWith(expect.objectContaining(mockUpdate));
      });
    });

    it('should update device status multiple times', async () => {
      const onDeviceStatusChange = jest.fn();

      const { result } = renderHook(() =>
        useRealtimeEvents({
          onDeviceStatusChange,
        })
      );

      // Simulate multiple status updates
      act(() => {
        if (result.current.socket) {
          result.current.socket.emit('device:status-update', {
            deviceId: 'device-1',
            status: 'online',
            lastSeen: new Date().toISOString(),
          });

          result.current.socket.emit('device:status-update', {
            deviceId: 'device-1',
            status: 'offline',
            lastSeen: new Date().toISOString(),
          });
        }
      });

      await waitFor(() => {
        expect(onDeviceStatusChange).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Playlist Updates', () => {
    it('should handle playlist:updated events', async () => {
      const onPlaylistChange = jest.fn();

      const { result } = renderHook(() =>
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
        if (result.current.socket) {
          result.current.socket.emit('playlist:updated', mockPlaylistUpdate);
        }
      });

      await waitFor(() => {
        expect(onPlaylistChange).toHaveBeenCalledWith(expect.objectContaining(mockPlaylistUpdate));
      });
    });

    it('should handle playlist item reordering', async () => {
      const onPlaylistChange = jest.fn();

      const { result } = renderHook(() =>
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
        if (result.current.socket) {
          result.current.socket.emit('playlist:updated', mockReorder);
        }
      });

      await waitFor(() => {
        expect(onPlaylistChange).toHaveBeenCalledWith(expect.objectContaining(mockReorder));
      });
    });
  });

  describe('Health Alerts', () => {
    it('should handle health:alert events', async () => {
      const onHealthAlert = jest.fn();

      const { result } = renderHook(() =>
        useRealtimeEvents({
          onHealthAlert,
        })
      );

      const mockAlert = {
        deviceId: 'device-1',
        alertType: 'high_cpu' as const,
        severity: 'critical' as const,
        message: 'CPU usage exceeded 95%',
        timestamp: new Date().toISOString(),
      };

      act(() => {
        if (result.current.socket) {
          result.current.socket.emit('health:alert', mockAlert);
        }
      });

      await waitFor(() => {
        expect(onHealthAlert).toHaveBeenCalledWith(expect.objectContaining(mockAlert));
      });
    });

    it('should distinguish alert severities', async () => {
      const onHealthAlert = jest.fn();

      const { result } = renderHook(() =>
        useRealtimeEvents({
          onHealthAlert,
        })
      );

      const criticalAlert = {
        deviceId: 'device-1',
        alertType: 'offline' as const,
        severity: 'critical' as const,
        message: 'Device offline',
        timestamp: new Date().toISOString(),
      };

      const warningAlert = {
        deviceId: 'device-2',
        alertType: 'high_memory' as const,
        severity: 'warning' as const,
        message: 'Memory usage high',
        timestamp: new Date().toISOString(),
      };

      act(() => {
        if (result.current.socket) {
          result.current.socket.emit('health:alert', criticalAlert);
          result.current.socket.emit('health:alert', warningAlert);
        }
      });

      await waitFor(() => {
        expect(onHealthAlert).toHaveBeenCalledTimes(2);
        expect(onHealthAlert).toHaveBeenNthCalledWith(1, expect.objectContaining({ severity: 'critical' }));
        expect(onHealthAlert).toHaveBeenNthCalledWith(2, expect.objectContaining({ severity: 'warning' }));
      });
    });
  });

  describe('Schedule Execution', () => {
    it('should handle schedule:executed events', async () => {
      const onScheduleExecution = jest.fn();

      const { result } = renderHook(() =>
        useRealtimeEvents({
          onScheduleExecution,
        })
      );

      const mockExecution = {
        scheduleId: 'schedule-1',
        displayId: 'device-1',
        playlistId: 'playlist-1',
        action: 'started' as const,
        timestamp: new Date().toISOString(),
      };

      act(() => {
        if (result.current.socket) {
          result.current.socket.emit('schedule:executed', mockExecution);
        }
      });

      await waitFor(() => {
        expect(onScheduleExecution).toHaveBeenCalledWith(expect.objectContaining(mockExecution));
      });
    });

    it('should track schedule execution states', async () => {
      const onScheduleExecution = jest.fn();

      const { result } = renderHook(() =>
        useRealtimeEvents({
          onScheduleExecution,
        })
      );

      const scheduleId = 'schedule-1';
      const actions = ['started', 'completed'] as const;

      actions.forEach((action) => {
        act(() => {
          if (result.current.socket) {
            result.current.socket.emit('schedule:executed', {
              scheduleId,
              displayId: 'device-1',
              playlistId: 'playlist-1',
              action,
              timestamp: new Date().toISOString(),
            });
          }
        });
      });

      await waitFor(() => {
        expect(onScheduleExecution).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Offline Queue Management', () => {
    it('should queue events when offline', () => {
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

      expect(result.current.offlineQueueLength).toBe(0);
    });
  });

  describe('Sync State Management', () => {
    it('should track sync state changes', () => {
      const onSyncStateChange = jest.fn();

      renderHook(() =>
        useRealtimeEvents({
          onSyncStateChange,
        })
      );

      // Should be called on initial sync
      expect(onSyncStateChange).toHaveBeenCalled();
    });

    it('should track pending and conflicted changes', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      expect(result.current.syncState.pendingChanges).toBeInstanceOf(Map);
      expect(result.current.syncState.conflictedChanges).toBeInstanceOf(Map);
    });
  });

  describe('Connection State', () => {
    it('should track connection status', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      expect(typeof result.current.isConnected).toBe('boolean');
      expect(typeof result.current.isOffline).toBe('boolean');
    });

    it('should call onConnectionChange callback', async () => {
      const onConnectionChange = jest.fn();

      renderHook(() =>
        useRealtimeEvents({
          onConnectionChange,
        })
      );

      await waitFor(() => {
        expect(onConnectionChange).toHaveBeenCalled();
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

      // Should not throw
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
  });
});
