import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useDevicesStore } from '../stores/devices';
import type { DeviceStatusEvent } from '../types';

/**
 * Listens for real-time device status events and updates the devices store.
 * Returns the socket connection state for UI indicators.
 */
export function useRealtimeEvents() {
  const { on, isConnected, connectionError } = useSocket();
  const updateDisplayStatus = useDevicesStore((s) => s.updateDisplayStatus);

  useEffect(() => {
    const unsubscribe = on('device:status', (data: unknown) => {
      const event = data as DeviceStatusEvent;
      if (event?.deviceId && event?.status) {
        updateDisplayStatus(event);
      }
    });

    return unsubscribe;
  }, [on, updateDisplayStatus]);

  return { isConnected, connectionError };
}
