/**
 * ConnectionDebugOverlay
 * 
 * A minimal, always-on overlay for TV displays that shows critical connection status
 * information without interfering with the main content. Only appears in development mode.
 */

import React, { useState, useEffect } from 'react';
import { useConnectionDiagnostics } from '../hooks/useConnectionDiagnostics';
import { getConnectionManager } from '../services/ConnectionManagerFactory';

// Check if we should show the overlay
const shouldShowOverlay = () => {
  if (typeof window === 'undefined') return false;
  
  // Show in development mode
  if (process.env.NODE_ENV !== 'production') return true;
  
  // Allow force enabling via localStorage
  try {
    return localStorage.getItem('enableConnectionDebug') === 'true';
  } catch (e) {
    return false;
  }
};

const styles = {
  container: {
    position: 'fixed',
    top: '10px',
    left: '10px',
    maxWidth: '300px',
    background: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '5px 10px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '10px',
    zIndex: 9999,
    pointerEvents: 'none', // Don't block clicks on the screen
    userSelect: 'none', // Don't allow text selection
  } as React.CSSProperties,
  badge: (color: string) => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color,
    marginRight: '5px',
  }) as React.CSSProperties,
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2px',
  } as React.CSSProperties,
  label: {
    color: '#aaa',
    marginRight: '5px',
  } as React.CSSProperties,
  value: {
    color: 'white',
    fontWeight: 'bold',
  } as React.CSSProperties,
  ping: (value: number) => {
    // Color based on latency
    let color = '#4caf50'; // Good (green)
    if (value > 500) color = '#f44336'; // Bad (red)
    else if (value > 200) color = '#ff9800'; // Warn (orange)
    
    return {
      color,
      marginLeft: '2px',
    } as React.CSSProperties;
  },
};

interface OverlayProps {
  alwaysShow?: boolean;
}

export const ConnectionDebugOverlay: React.FC<OverlayProps> = ({ alwaysShow = false }) => {
  const [showOverlay, setShowOverlay] = useState(alwaysShow);
  const [ping, setPing] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  const diagnostic = useConnectionDiagnostics();
  const isConnected = diagnostic.connectionState === 'connected';
  const statusColor = isConnected ? '#4caf50' : diagnostic.connectionState === 'reconnecting' ? '#ff9800' : '#f44336';
  
  // Measure ping every 5 seconds
  useEffect(() => {
    if (!shouldShowOverlay() && !alwaysShow) {
      setShowOverlay(false);
      return;
    }
    
    setShowOverlay(true);
    
    const interval = setInterval(async () => {
      try {
        const manager = getConnectionManager();
        if (manager && manager.isConnected()) {
          const startTime = Date.now();
          // Use Socket.IO's ping-pong mechanism
          if (manager.getSocket()) {
            // @ts-ignore: Internal Socket.IO API
            manager.getSocket().emit('ping', () => {
              const latency = Date.now() - startTime;
              setPing(latency);
            });
          }
        }
        setLastUpdate(Date.now());
      } catch (e) {
        console.error('Error measuring ping:', e);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [alwaysShow]);
  
  // Don't render if shouldn't show
  if (!showOverlay) return null;
  
  // Format device ID for display
  const deviceId = diagnostic.payload?.deviceId || 'unknown';
  const shortDeviceId = typeof deviceId === 'string' && deviceId.length > 8 
    ? `${deviceId.substring(0, 6)}...` 
    : deviceId;
    
  // Format socket ID for display
  const socketId = diagnostic.socketId || 'none';
  const shortSocketId = socketId && socketId.length > 8 
    ? `${socketId.substring(0, 6)}...` 
    : socketId;
  
  // Get transport type
  const transport = diagnostic.payload?.transport || 'unknown';
  
  return (
    <div style={styles.container}>
      <div style={styles.row}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={styles.badge(statusColor)}></div>
          <span>{isConnected ? 'Connected' : diagnostic.connectionState}</span>
        </div>
        <div>
          {ping !== null && (
            <span style={styles.ping(ping)}>{ping}ms</span>
          )}
        </div>
      </div>
      
      <div style={styles.row}>
        <span style={styles.label}>Socket:</span>
        <span style={styles.value}>{shortSocketId}</span>
      </div>
      
      <div style={styles.row}>
        <span style={styles.label}>Device:</span>
        <span style={styles.value}>{shortDeviceId}</span>
      </div>
      
      <div style={styles.row}>
        <span style={styles.label}>Transport:</span>
        <span style={styles.value}>{transport}</span>
      </div>
      
      <div style={styles.row}>
        <span style={styles.label}>Event:</span>
        <span style={styles.value}>{diagnostic.type}</span>
      </div>
    </div>
  );
}; 