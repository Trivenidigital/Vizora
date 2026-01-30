'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useSocket } from '@/lib/hooks/useSocket';
import { apiClient } from '@/lib/api';

export type DeviceStatus = 'online' | 'offline' | 'idle' | 'error';

export interface DeviceStatusUpdate {
  deviceId: string;
  status: DeviceStatus;
  timestamp: number;
  lastHeartbeat?: number;
  uptime?: number;
  metadata?: Record<string, any>;
}

interface DeviceStatusContextType {
  deviceStatuses: Record<string, DeviceStatusUpdate>;
  isConnected: boolean;
  isInitialized: boolean;
  updateDeviceStatus: (deviceId: string, status: DeviceStatus) => void;
  getDeviceStatus: (deviceId: string) => DeviceStatusUpdate | undefined;
  subscribeToDevice: (deviceId: string, callback: (update: DeviceStatusUpdate) => void) => () => void;
  initializeDeviceStatuses: (updates: DeviceStatusUpdate[]) => void;
}

const DeviceStatusContext = createContext<DeviceStatusContextType | undefined>(undefined);

export function DeviceStatusProvider({ children }: { children: ReactNode }) {
  const { isConnected, on } = useSocket();
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, DeviceStatusUpdate>>({});
  const [subscribers, setSubscribers] = useState<Record<string, Set<Function>>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize device statuses from API on mount
  useEffect(() => {
    const initializeFromAPI = async () => {
      try {
        setIsInitializing(true);
        const response = await apiClient.getDisplays();
        const devices = response.data || response || [];

        // Convert API Display objects to DeviceStatusUpdate
        const updates = devices.map((device: any) => ({
          deviceId: device.id,
          status: (device.status || 'offline') as DeviceStatus,
          timestamp: Date.now(),
          metadata: {
            nickname: device.nickname,
            location: device.location,
            lastSeen: device.lastSeen,
          },
        }));

        // Bulk load into context
        initializeDeviceStatuses(updates);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize device statuses from API:', error);
        // Still mark as initialized to unblock UI
        setIsInitialized(true);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeFromAPI();
  }, []);

  // Listen for device status updates from Socket.io
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = on('device:status', (data: DeviceStatusUpdate) => {
      setDeviceStatuses(prev => {
        const updated = { ...prev, [data.deviceId]: data };

        // Notify subscribers for this specific device
        setSubscribers(subs => {
          if (subs[data.deviceId]) {
            subs[data.deviceId].forEach(callback => {
              callback(data);
            });
          }
          return subs;
        });

        return updated;
      });
    });

    return unsubscribe;
  }, [isConnected, on]);

  // Listen for batch status updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = on('device:status:batch', (data: DeviceStatusUpdate[]) => {
      setDeviceStatuses(prev => {
        const updated = { ...prev };
        data.forEach(update => {
          updated[update.deviceId] = update;
        });

        // Notify individual subscribers
        setSubscribers(subs => {
          data.forEach(update => {
            if (subs[update.deviceId]) {
              subs[update.deviceId].forEach(callback => {
                callback(update);
              });
            }
          });
          return subs;
        });

        return updated;
      });
    });

    return unsubscribe;
  }, [isConnected, on]);

  const initializeDeviceStatuses = (updates: DeviceStatusUpdate[]) => {
    const statusMap: Record<string, DeviceStatusUpdate> = {};
    updates.forEach(update => {
      statusMap[update.deviceId] = update;
    });

    setDeviceStatuses(statusMap);
  };

  const updateDeviceStatus = (deviceId: string, status: DeviceStatus) => {
    const update: DeviceStatusUpdate = {
      deviceId,
      status,
      timestamp: Date.now(),
    };

    setDeviceStatuses(prev => ({
      ...prev,
      [deviceId]: update,
    }));

    // Notify subscribers
    if (subscribers[deviceId]) {
      subscribers[deviceId].forEach(callback => {
        callback(update);
      });
    }
  };

  const getDeviceStatus = (deviceId: string) => {
    return deviceStatuses[deviceId];
  };

  const subscribeToDevice = useCallback((deviceId: string, callback: (update: DeviceStatusUpdate) => void) => {
    // Add callback to subscribers (single state update)
    setSubscribers(prev => {
      const updated = { ...prev };
      if (!updated[deviceId]) {
        updated[deviceId] = new Set();
      }
      updated[deviceId].add(callback);
      return updated;
    });

    // Call callback immediately with current status if available
    setDeviceStatuses(prevStatuses => {
      if (prevStatuses[deviceId]) {
        callback(prevStatuses[deviceId]);
      }
      return prevStatuses;
    });

    // Return unsubscribe function
    return () => {
      setSubscribers(prev => {
        const updated = { ...prev };
        if (updated[deviceId]) {
          updated[deviceId].delete(callback);
          if (updated[deviceId].size === 0) {
            delete updated[deviceId];
          }
        }
        return updated;
      });
    };
  }, []);

  return (
    <DeviceStatusContext.Provider
      value={{
        deviceStatuses,
        isConnected,
        isInitialized,
        updateDeviceStatus,
        getDeviceStatus,
        subscribeToDevice,
        initializeDeviceStatuses,
      }}
    >
      {children}
    </DeviceStatusContext.Provider>
  );
}

export function useDeviceStatus() {
  const context = useContext(DeviceStatusContext);
  if (context === undefined) {
    throw new Error('useDeviceStatus must be used within DeviceStatusProvider');
  }
  return context;
}
