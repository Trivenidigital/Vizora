'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSocket } from '@/lib/hooks/useSocket';

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
  updateDeviceStatus: (deviceId: string, status: DeviceStatus) => void;
  getDeviceStatus: (deviceId: string) => DeviceStatusUpdate | undefined;
  subscribeToDevice: (deviceId: string, callback: (update: DeviceStatusUpdate) => void) => () => void;
}

const DeviceStatusContext = createContext<DeviceStatusContextType | undefined>(undefined);

export function DeviceStatusProvider({ children }: { children: ReactNode }) {
  const { isConnected, on } = useSocket();
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, DeviceStatusUpdate>>({});
  const [subscribers, setSubscribers] = useState<Record<string, Set<Function>>>({});

  // Listen for device status updates from Socket.io
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = on('device:status', (data: DeviceStatusUpdate) => {
      setDeviceStatuses(prev => ({
        ...prev,
        [data.deviceId]: data,
      }));

      // Notify subscribers for this specific device
      if (subscribers[data.deviceId]) {
        subscribers[data.deviceId].forEach(callback => {
          callback(data);
        });
      }
    });

    return unsubscribe;
  }, [isConnected, on, subscribers]);

  // Listen for batch status updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = on('device:status:batch', (data: DeviceStatusUpdate[]) => {
      setDeviceStatuses(prev => {
        const updated = { ...prev };
        data.forEach(update => {
          updated[update.deviceId] = update;

          // Notify individual subscribers
          if (subscribers[update.deviceId]) {
            subscribers[update.deviceId].forEach(callback => {
              callback(update);
            });
          }
        });
        return updated;
      });
    });

    return unsubscribe;
  }, [isConnected, on, subscribers]);

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

  const subscribeToDevice = (deviceId: string, callback: (update: DeviceStatusUpdate) => void) => {
    // Initialize subscriber set if it doesn't exist
    if (!subscribers[deviceId]) {
      setSubscribers(prev => ({
        ...prev,
        [deviceId]: new Set(),
      }));
    }

    // Add callback to subscribers
    setSubscribers(prev => {
      const updated = { ...prev };
      if (!updated[deviceId]) {
        updated[deviceId] = new Set();
      }
      updated[deviceId].add(callback);
      return updated;
    });

    // Call callback immediately with current status if available
    if (deviceStatuses[deviceId]) {
      callback(deviceStatuses[deviceId]);
    }

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
  };

  return (
    <DeviceStatusContext.Provider
      value={{
        deviceStatuses,
        isConnected,
        updateDeviceStatus,
        getDeviceStatus,
        subscribeToDevice,
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
