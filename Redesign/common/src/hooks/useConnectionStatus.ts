import { useState, useEffect } from 'react';
import { ConnectionState } from '../services/ConnectionManager';
import { getConnectionManager } from '../services/ConnectionManagerFactory';

/**
 * Hook to access the connection status from ConnectionManager
 * @returns The current connection state and utility properties
 */
export function useConnectionStatus() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => {
    const manager = getConnectionManager();
    return manager.getConnectionState();
  });

  useEffect(() => {
    const manager = getConnectionManager();
    
    const handleStateChange = (data: { type: 'http' | 'socket', state: ConnectionState }) => {
      if (data.type === 'socket') {
        setConnectionState(data.state);
      }
    };
    
    manager.on('state:change', handleStateChange);
    
    setConnectionState(manager.getConnectionState());
    
    return () => {
      manager.off('state:change', handleStateChange);
    };
  }, []);

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isReconnecting = connectionState === ConnectionState.RECONNECTING;
  
  return {
    connectionState,
    isConnected,
    isReconnecting
  };
}

// Export getConnectionManager directly for convenience
export { getConnectionManager };

// For backwards compatibility with existing code that uses useConnectionState
export const useConnectionState = useConnectionStatus; 