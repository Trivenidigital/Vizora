import { useState, useEffect } from 'react';

interface OfflineModeState {
  isOffline: boolean;
  lastSync: Date | null;
  pendingChanges: boolean;
}

export const useOfflineMode = () => {
  const [state, setState] = useState<OfflineModeState>({
    isOffline: !navigator.onLine,
    lastSync: null,
    pendingChanges: false,
  });

  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({
        ...prev,
        isOffline: false,
      }));
    };

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        isOffline: true,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateLastSync = () => {
    setState(prev => ({
      ...prev,
      lastSync: new Date(),
    }));
  };

  const setPendingChanges = (hasChanges: boolean) => {
    setState(prev => ({
      ...prev,
      pendingChanges: hasChanges,
    }));
  };

  return {
    ...state,
    updateLastSync,
    setPendingChanges,
  };
}; 