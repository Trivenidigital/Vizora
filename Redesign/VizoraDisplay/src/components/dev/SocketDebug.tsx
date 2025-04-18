import React, { useState, useEffect } from 'react';
import { ConnectionState, ConnectionManager, ConnectionConfig } from "@vizora/common";

// Provide a dummy config to satisfy constructor
const dummyConfig: Partial<ConnectionConfig> = { // Use Partial<> if not all fields are needed
  baseUrl: 'ws://localhost:3000', // Example
};
const connectionManager = new ConnectionManager(dummyConfig as ConnectionConfig); // Pass config

const styles = {
  container: {
    position: 'fixed' as const,
    bottom: '10px',
    right: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '10px',
    borderRadius: '5px',
    fontFamily: 'monospace',
    fontSize: '12px',
    maxWidth: '300px',
    zIndex: 9999,
    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: '8px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    margin: 0,
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
  },
  status: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    marginBottom: '5px',
  },
  indicator: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginRight: '8px',
  },
  connected: {
    backgroundColor: '#4CAF50',
  },
  disconnected: {
    backgroundColor: '#F44336',
  },
  reconnecting: {
    backgroundColor: '#FFC107',
  },
  error: {
    backgroundColor: '#F44336',
  },
  property: {
    margin: '3px 0',
  },
  error_message: {
    color: '#F44336',
    wordBreak: 'break-word' as const,
    maxHeight: '60px',
    overflow: 'auto' as const,
  },
  toggle: {
    position: 'fixed' as const,
    bottom: '10px',
    right: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    zIndex: 9998,
  },
  badge: {
    fontSize: '10px',
    padding: '2px 4px',
    borderRadius: '3px',
    backgroundColor: '#666',
    marginLeft: '5px',
  },
  websocket: {
    backgroundColor: '#4CAF50',
  },
  polling: {
    backgroundColor: '#FFC107',
  },
  window: (minimized: boolean) => ({
    ...(minimized ? styles.toggle : styles.container),
  }),
  content: {
    // Add any additional styles for the content section if needed
  },
};

interface SocketHealth {
  socketConnected: boolean;
  connected: boolean;
  reconnecting: boolean;
  connectionState: ConnectionState;
  lastError: { 
    error: Error | null; 
    time: Date | null 
  };
}

// Determine if in production environment using process.env.NODE_ENV
const isProduction = process.env.NODE_ENV === 'production'; 

const SocketDebug: React.FC = () => {
  const [health, setHealth] = useState<any>(connectionManager.getDiagnostics() || {}); // Use any for now
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [transport, setTransport] = useState<string>('unknown');

  useEffect(() => {
    let intervalId: number;

    if (!minimized) {
      // Update the health status every second
      intervalId = window.setInterval(() => {
        const socketHealth = connectionManager.getSocketHealth();
        setHealth(socketHealth);
        
        // Get current transport
        const socket = connectionManager.getSocket();
        if (socket) {
          // Access the underlying engine's transport
          const currentTransport = socket.io?.engine?.transport?.name || 'unknown';
          setTransport(currentTransport);
        }
      }, 1000);
    }

    return () => clearInterval(intervalId);
  }, [minimized]);

  // Don't render in production
  if (isProduction) { 
    return null;
  }

  // Create a keyboard shortcut to toggle visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+S to toggle debug panel
      if (e.altKey && e.key === 's') {
        setMinimized(!minimized);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [minimized]);

  if (minimized) {
    return (
      <div 
        style={styles.toggle} 
        onClick={() => setMinimized(false)}
        title="Show Socket Debug (Alt+S)"
      >
        S
      </div>
    );
  }

  const getStatusColor = (connectionState: ConnectionState | undefined | null): object => {
    if (connectionState === ConnectionState.CONNECTED) return styles.connected;
    if (connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.RECONNECTING) return styles.reconnecting;
    if (connectionState === ConnectionState.ERROR) return styles.error;
    return styles.disconnected;
  };

  const getStatusText = (connectionState: ConnectionState | undefined | null): string => {
    if (connectionState === ConnectionState.CONNECTED) return 'Connected';
    if (connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.RECONNECTING) return 'Reconnecting';
    if (connectionState === ConnectionState.ERROR) return 'Error';
    return 'Disconnected';
  };

  const getTransportStyle = () => {
    if (transport === 'websocket') return styles.websocket;
    if (transport === 'polling') return styles.polling;
    return {};
  };

  const statusColor = getStatusColor(health?.connectionState);

  return (
    <div style={styles.window(minimized)}>
      <div style={styles.header}>
        <h4 style={styles.title}>Socket Status</h4>
        <button style={styles.closeButton} onClick={() => setMinimized(true)}>×</button>
      </div>
      
      <div style={styles.status}>
        <div style={{...styles.indicator, ...statusColor}}></div>
        <span>{getStatusText(health?.connectionState)}</span>
        <span style={{...styles.badge, ...getTransportStyle()}}>{transport}</span>
      </div>
      
      {!minimized && (
        <div style={styles.content}>
          <div style={styles.property}>Socket: {health?.socketConnected ? 'Created' : 'Not Created'}</div>
          <div style={styles.property}>Connected: {health?.connected ? 'Yes' : 'No'}</div>
          <div style={styles.property}>Reconnecting: {health?.reconnecting ? 'Yes' : 'No'}</div>
          <div style={styles.property}>Transport: {transport}</div>
          
          {expanded && health?.lastError.error && (
            <>
              <div style={styles.property}>
                Last Error: 
                <div style={styles.error_message}>
                  {health.lastError.error.message}
                </div>
              </div>
              {health.lastError.time && (
                <div style={styles.property}>
                  Time: {health.lastError.time.toLocaleTimeString()}
                </div>
              )}
            </>
          )}
          
          <button 
            onClick={() => setExpanded(!expanded)} 
            style={{
              background: 'transparent',
              border: '1px solid #555',
              color: 'white',
              padding: '2px 5px',
              borderRadius: '3px',
              cursor: 'pointer',
              marginTop: '5px',
              fontSize: '11px',
            }}
          >
            {expanded ? 'Less Details' : 'More Details'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SocketDebug; 