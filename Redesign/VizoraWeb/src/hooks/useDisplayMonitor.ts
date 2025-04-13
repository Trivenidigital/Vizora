import { useState, useEffect, useCallback } from 'react';
import { Display } from '@/types/display';
import { displayPollingService } from '@/services/displayPollingService';
import { toast } from 'react-hot-toast';

interface UseDisplayMonitorOptions {
  displayId: string;
  onUpdate?: (display: Display) => void;
  onError?: (error: Error) => void;
  showToasts?: boolean;
}

/**
 * Hook for monitoring a display status with automatic fallback 
 * between WebSockets and polling
 */
export function useDisplayMonitor({
  displayId,
  onUpdate,
  onError,
  showToasts = false
}: UseDisplayMonitorOptions) {
  const [display, setDisplay] = useState<Display | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Handle display updates
  const handleUpdate = useCallback((updatedDisplay: Display) => {
    setDisplay(updatedDisplay);
    setLoading(false);
    setError(null);

    // Call optional callback
    if (onUpdate) {
      onUpdate(updatedDisplay);
    }
  }, [onUpdate]);

  // Handle errors
  const handleError = useCallback((err: Error) => {
    setError(err);
    setLoading(false);

    // Show toast notification
    if (showToasts) {
      toast.error(`Error monitoring display: ${err.message}`);
    }

    // Call optional callback
    if (onError) {
      onError(err);
    }
  }, [onError, showToasts]);

  // Refresh display data manually
  const refreshDisplay = useCallback(() => {
    if (displayId) {
      displayPollingService.refreshDisplay(displayId);
    }
  }, [displayId]);

  // Check polling status
  const checkPollingStatus = useCallback(() => {
    if (displayId) {
      setIsPolling(displayPollingService.isPolling(displayId));
    }
  }, [displayId]);

  // Set up monitoring on mount
  useEffect(() => {
    if (!displayId) {
      setError(new Error('No display ID provided'));
      setLoading(false);
      return;
    }

    setLoading(true);

    // Initialize the polling service if not already initialized
    if (!displayPollingService.isMonitoring(displayId)) {
      displayPollingService.monitorDisplay(displayId, {
        onUpdate: handleUpdate,
        onError: handleError
      });
    } else {
      // If already monitoring, refresh to get latest data
      refreshDisplay();
    }

    // Check initial polling status
    checkPollingStatus();

    // Set up interval to check polling status
    const pollingCheckInterval = setInterval(checkPollingStatus, 5000);

    // Clean up on unmount
    return () => {
      clearInterval(pollingCheckInterval);
      // Don't stop monitoring as other components might be using it
    };
  }, [displayId, handleUpdate, handleError, refreshDisplay, checkPollingStatus]);

  return {
    display,
    loading,
    error,
    isPolling,
    refreshDisplay
  };
} 