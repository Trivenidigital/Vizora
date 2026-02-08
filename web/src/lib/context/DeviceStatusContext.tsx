'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
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

interface DeviceStatusProviderProps {
  children: ReactNode;
  user?: { organizationId: string } | null;
}

export function DeviceStatusProvider({ children, user }: DeviceStatusProviderProps) {
  const { isConnected, on } = useSocket({
    autoConnect: !!user,
    auth: user ? { organizationId: user.organizationId } : undefined,
  });
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, DeviceStatusUpdate>>({});
  const deviceStatusesRef = useRef<Record<string, DeviceStatusUpdate>>({});
  const subscribersRef = useRef<Record<string, Set<(status: DeviceStatusUpdate) => void>>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize device statuses from API when user is authenticated
  useEffect(() => {
    if (!user) {
      setIsInitialized(true);
      setIsInitializing(false);
      return;
    }

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
      } catch (error: any) {
        if (error?.response?.status !== 401 && error?.status !== 401) {
          console.error('Failed to initialize device statuses from API:', error);
        }
        setIsInitialized(true);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeFromAPI();
  }, [user]);

  // Listen for device status updates from Socket.io
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = on('device:status', (data: DeviceStatusUpdate) => {
      deviceStatusesRef.current = { ...deviceStatusesRef.current, [data.deviceId]: data };
      setDeviceStatuses(deviceStatusesRef.current);

      // Notify subscribers outside state setter to avoid side-effect anti-pattern
      const subs = subscribersRef.current[data.deviceId];
      if (subs) {
        subs.forEach(callback => callback(data));
      }
    });

    return unsubscribe;
  }, [isConnected, on]);

  // Listen for batch status updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = on('device:status:batch', (data: DeviceStatusUpdate[]) => {
      const updated = { ...deviceStatusesRef.current };
      data.forEach(update => {
        updated[update.deviceId] = update;
      });
      deviceStatusesRef.current = updated;
      setDeviceStatuses(updated);

      // Notify subscribers outside state setter to avoid side-effect anti-pattern
      data.forEach(update => {
        const subs = subscribersRef.current[update.deviceId];
        if (subs) {
          subs.forEach(callback => callback(update));
        }
      });
    });

    return unsubscribe;
  }, [isConnected, on]);

  const initializeDeviceStatuses = (updates: DeviceStatusUpdate[]) => {
    const statusMap: Record<string, DeviceStatusUpdate> = {};
    updates.forEach(update => {
      statusMap[update.deviceId] = update;
    });

    deviceStatusesRef.current = statusMap;
    setDeviceStatuses(statusMap);
  };

  const updateDeviceStatus = (deviceId: string, status: DeviceStatus) => {
    const update: DeviceStatusUpdate = {
      deviceId,
      status,
      timestamp: Date.now(),
    };

    deviceStatusesRef.current = { ...deviceStatusesRef.current, [deviceId]: update };
    setDeviceStatuses(deviceStatusesRef.current);

    // Notify subscribers
    const subs = subscribersRef.current[deviceId];
    if (subs) {
      subs.forEach(callback => callback(update));
    }
  };

  const getDeviceStatus = (deviceId: string) => {
    return deviceStatuses[deviceId];
  };

  const subscribeToDevice = useCallback((deviceId: string, callback: (update: DeviceStatusUpdate) => void) => {
    // Add callback to subscribers (ref mutation, no re-render needed)
    if (!subscribersRef.current[deviceId]) {
      subscribersRef.current[deviceId] = new Set();
    }
    subscribersRef.current[deviceId].add(callback);

    // Call callback immediately with current status if available
    const currentStatus = deviceStatusesRef.current[deviceId];
    if (currentStatus) {
      // Use a timeout to avoid calling setState during render
      setTimeout(() => callback(currentStatus), 0);
    }

    // Return unsubscribe function
    return () => {
      const subs = subscribersRef.current[deviceId];
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          delete subscribersRef.current[deviceId];
        }
      }
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
