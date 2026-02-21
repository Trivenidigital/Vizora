import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';
import type { ScreenshotReadyEvent } from '../types';

/**
 * Listens for screenshot:ready events for a specific device.
 */
export function useScreenshotListener(deviceId: string | undefined) {
  const { on } = useSocket();
  const [screenshot, setScreenshot] = useState<ScreenshotReadyEvent | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    const unsubscribe = on('screenshot:ready', (data: unknown) => {
      const event = data as ScreenshotReadyEvent;
      if (event?.deviceId === deviceId) {
        setScreenshot(event);
      }
    });

    return unsubscribe;
  }, [on, deviceId]);

  return { screenshot, clearScreenshot: () => setScreenshot(null) };
}
