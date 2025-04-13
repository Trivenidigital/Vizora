import { useState, useEffect } from 'react';
import { ConnectionState as InternalConnectionState } from '../services/ConnectionManager';
import { getConnectionManager } from '../services/ConnectionManagerFactory';

// Simplified ConnectionState enum for components
export enum ConnectionState {
  Connected = "connected",
  Disconnected = "disconnected",
  Connecting = "connecting"
}

/**
 * Maps internal ConnectionManager states to simplified ConnectionState for components
 */
function mapConnectionState(internalState: InternalConnectionState): ConnectionState {
  switch (internalState) {
    case InternalConnectionState.CONNECTED:
      return ConnectionState.Connected;
    case InternalConnectionState.CONNECTING:
    case InternalConnectionState.RECONNECTING:
      return ConnectionState.Connecting;
    case InternalConnectionState.DISCONNECTED:
    case InternalConnectionState.ERROR:
    default:
      return ConnectionState.Disconnected;
  }
}

/**
 * Hook to access the connection status from ConnectionManager
 * @returns The current connection state and utility properties
 */
export function useConnectionStatus() {
  const [internalState, setInternalState] = useState<InternalConnectionState>(() => {
    const manager = getConnectionManager();
    return manager.getConnectionState();
  });

  useEffect(() => {
    const manager = getConnectionManager();
    
    // Handler for connection state changes
    const handleStateChange = (data: { type: 'http' | 'socket', state: InternalConnectionState }) => {
      // We only care about socket state changes
      if (data.type === 'socket') {
        setInternalState(data.state);
      }
    };
    
    // Subscribe to state changes
    manager.on('state:change', handleStateChange);
    
    // Initial state
    setInternalState(manager.getConnectionState());
    
    // Cleanup
    return () => {
      manager.off('state:change', handleStateChange);
    };
  }, []);

  // Convert internal ConnectionState to simplified interface for components
  const connectionState = mapConnectionState(internalState);
  const isConnected = internalState === InternalConnectionState.CONNECTED;
  const isReconnecting = internalState === InternalConnectionState.RECONNECTING;
  
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