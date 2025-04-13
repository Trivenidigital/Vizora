import React, { useState, useEffect } from 'react';

interface OfflineModeProps {
  onOfflineChange?: (isOffline: boolean) => void;
}

const OfflineMode: React.FC<OfflineModeProps> = ({ onOfflineChange }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      onOfflineChange?.(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
      onOfflineChange?.(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onOfflineChange]);

  return (
    <div className={`fixed bottom-4 right-4 rounded-lg p-4 shadow-lg ${isOffline ? 'bg-red-100' : 'bg-green-100'}`}>
      <div className="flex items-center space-x-2">
        <div className={`h-3 w-3 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500'}`} />
        <span className={`text-sm font-medium ${isOffline ? 'text-red-700' : 'text-green-700'}`}>
          {isOffline ? 'Offline Mode' : 'Online'}
        </span>
      </div>
      {isOffline && (
        <p className="mt-2 text-xs text-red-600">
          You are currently offline. Some features may be limited.
        </p>
      )}
    </div>
  );
};

export default OfflineMode; 