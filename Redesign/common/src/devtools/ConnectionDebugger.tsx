/**
 * ConnectionDebugger
 * 
 * A development tool component that provides real-time visibility into socket connection status
 * and diagnostics. Only active in development mode.
 */

import React, { useState, useEffect } from 'react';
import { useConnectionDiagnostics, useConnectionDiagnosticsHistory } from '../hooks/useConnectionDiagnostics';
import { getConnectionManager } from '../services/ConnectionManagerFactory';
import { ConnectionDiagnosticEventType } from './ConnectionStateObservable';

// Styles for the debugger
const styles = {
  container: {
    position: 'fixed',
    bottom: '10px',
    right: '10px',
    width: '300px',
    background: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    borderRadius: '8px',
    padding: '10px',
    fontFamily: 'monospace',
    fontSize: '12px',
    zIndex: 9999,
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '5px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
    paddingBottom: '5px',
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 'bold',
  } as React.CSSProperties,
  statusBadge: (isConnected: boolean) => ({
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '4px',
    background: isConnected ? '#4caf50' : '#f44336',
    color: 'white',
    fontSize: '10px',
  }) as React.CSSProperties,
  section: {
    marginBottom: '10px',
  } as React.CSSProperties,
  sectionTitle: {
    margin: '5px 0',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#9e9e9e',
  } as React.CSSProperties,
  button: {
    background: '#2196f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '10px',
    cursor: 'pointer',
    marginRight: '5px',
  } as React.CSSProperties,
  eventItem: {
    padding: '5px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '11px',
  } as React.CSSProperties,
  eventTime: {
    color: '#9e9e9e',
    fontSize: '10px',
  } as React.CSSProperties,
  eventType: (type: ConnectionDiagnosticEventType) => {
    let color = '#9e9e9e';
    switch (type) {
      case ConnectionDiagnosticEventType.CONNECTED:
        color = '#4caf50';
        break;
      case ConnectionDiagnosticEventType.DISCONNECTED:
        color = '#f44336';
        break;
      case ConnectionDiagnosticEventType.RECONNECTING:
        color = '#ff9800';
        break;
      case ConnectionDiagnosticEventType.ERROR:
        color = '#f44336';
        break;
      case ConnectionDiagnosticEventType.TRANSPORT_UPGRADED:
        color = '#2196f3';
        break;
      case ConnectionDiagnosticEventType.CIRCUIT_BREAKER_TRIPPED:
        color = '#f44336';
        break;
      case ConnectionDiagnosticEventType.CIRCUIT_BREAKER_RESET:
        color = '#4caf50';
        break;
    }
    return {
      color,
      fontWeight: 'bold',
    } as React.CSSProperties;
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '3px',
  } as React.CSSProperties,
  infoLabel: {
    color: '#9e9e9e',
  } as React.CSSProperties,
  infoValue: {
    color: 'white',
  } as React.CSSProperties,
  hidden: {
    display: 'none',
  } as React.CSSProperties,
  controls: {
    display: 'flex',
    gap: '5px',
    marginTop: '8px',
  } as React.CSSProperties,
};

/**
 * Connection debugger component
 */
export const ConnectionDebugger: React.FC = () => {
  // Only show in development
  if (process.env.NODE_ENV === 'production' && !process.env.FORCE_CONNECTION_DEBUG) {
    return null;
  }

  const event = useConnectionDiagnostics();
  const { history, clearHistory } = useConnectionDiagnosticsHistory();
  const [expanded, setExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Track if the socket is connected
  const isConnected = event.connectionState === 'connected';
  const socketId = event.socketId || 'none';

  const handleReconnect = () => {
    const manager = getConnectionManager();
    manager.disconnect();
    setTimeout(() => {
      manager.connect();
    }, 100);
  };

  const handleClearHistory = () => {
    clearHistory();
  };

  const handleToggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  // Format event timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  };

  if (!isVisible) {
    return (
      <div 
        style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px', 
          background: 'rgba(0, 0, 0, 0.5)', 
          color: 'white',
          padding: '5px 10px',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 9999,
        }}
        onClick={handleToggleVisibility}
      >
        🔌 Show Connection Debug
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>
          🔌 Connection Debugger
        </h4>
        <div>
          <span style={styles.statusBadge(isConnected)}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Socket ID:</span>
          <span style={styles.infoValue}>{socketId}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Last Event:</span>
          <span style={styles.infoValue}>{event.type}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Time:</span>
          <span style={styles.infoValue}>{formatTime(event.timestamp)}</span>
        </div>
        {event.payload?.transport && (
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Transport:</span>
            <span style={styles.infoValue}>{event.payload.transport}</span>
          </div>
        )}
      </div>

      <div style={styles.controls}>
        <button style={styles.button} onClick={handleReconnect}>
          Reconnect
        </button>
        <button style={styles.button} onClick={handleToggleVisibility}>
          Hide
        </button>
        <button style={styles.button} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide History' : 'Show History'}
        </button>
        {expanded && (
          <button style={styles.button} onClick={handleClearHistory}>
            Clear
          </button>
        )}
      </div>

      {expanded && (
        <div style={styles.section}>
          <h5 style={styles.sectionTitle}>Event History</h5>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {history.slice().reverse().map((item, index) => (
              <div key={index} style={styles.eventItem}>
                <div style={styles.eventTime}>{formatTime(item.timestamp)}</div>
                <div>
                  <span style={styles.eventType(item.type)}>{item.type}</span>
                  {item.socketId && ` (${item.socketId.substring(0, 6)}...)`}
                </div>
                {item.payload && (
                  <div style={{ fontSize: '10px', color: '#9e9e9e', marginTop: '2px' }}>
                    {Object.entries(item.payload).map(([key, value]) => (
                      <div key={key}>
                        {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 