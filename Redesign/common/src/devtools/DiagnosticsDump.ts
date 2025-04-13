/**
 * DiagnosticsDump
 * 
 * Provides utilities for capturing and exporting the current connection state
 * for debugging purposes.
 */

import { connectionDiagnosticsHistory$ } from './ConnectionStateObservable';
import { getConnectionManager } from '../services/ConnectionManagerFactory';

export interface ConnectionDumpData {
  timestamp: number;
  deviceId: string | null;
  socketId: string | null;
  connectionState: string;
  transport: string;
  isConnected: boolean;
  lastEvents: any[];
  socketHealth: {
    roundTripMs: number | null;
    reconnectAttempts: number;
    circuitBreakerTripped: boolean;
  };
  deviceInfo: {
    userAgent: string;
    screenSize: string;
    language: string;
    timeZone: string;
    networkType: string;
  };
  // Add any other useful diagnostic data
}

/**
 * Captures the current connection state and diagnostic information
 */
export async function captureConnectionDiagnostics(): Promise<ConnectionDumpData> {
  const manager = getConnectionManager();
  const socket = manager.getSocket();
  const socketId = manager.getSocketId();
  
  // Attempt to measure current latency
  let latency: number | null = null;
  try {
    if (socket && manager.isConnected()) {
      // Use built-in ping if available
      if (typeof manager.getLatency === 'function') {
        latency = await manager.getLatency();
      } else {
        // Fallback: manual ping-pong
        latency = await new Promise((resolve) => {
          const start = Date.now();
          // @ts-ignore: Internal Socket.IO API
          socket.emit('ping', () => {
            resolve(Date.now() - start);
          });
          
          // Timeout after 2s
          setTimeout(() => resolve(null), 2000);
        });
      }
    }
  } catch (e) {
    console.error('Error measuring latency:', e);
  }
  
  // Get socket health
  const socketHealth = typeof manager.getSocketHealth === 'function' 
    ? manager.getSocketHealth()
    : { 
        connected: manager.isConnected(),
        reconnecting: manager.isReconnecting(),
        reconnectAttempts: 0,
        circuitBreakerTripped: false
      };
  
  // Get recent events
  const recentEvents = connectionDiagnosticsHistory$.value.slice(-5);
  
  // Device information
  const deviceInfo = {
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    networkType: (navigator as any).connection 
      ? (navigator as any).connection.effectiveType 
      : 'unknown'
  };
  
  // Get device ID
  let deviceId: string | null = null;
  try {
    // Attempt to get device ID from localStorage or similar
    if (typeof localStorage !== 'undefined') {
      deviceId = localStorage.getItem('deviceId') || 
                localStorage.getItem('device_id') ||
                localStorage.getItem('vizora_device_id') ||
                null;
    }
  } catch (e) {
    // Ignore storage errors
  }
  
  // Compile all diagnostics
  const diagnostics: ConnectionDumpData = {
    timestamp: Date.now(),
    deviceId,
    socketId,
    connectionState: manager.getConnectionState(),
    transport: socket?.io?.engine?.transport?.name || 'unknown',
    isConnected: manager.isConnected(),
    lastEvents: recentEvents,
    socketHealth: {
      roundTripMs: latency,
      reconnectAttempts: socketHealth.reconnectAttempts || 0,
      circuitBreakerTripped: socketHealth.circuitBreakerTripped || false
    },
    deviceInfo
  };
  
  return diagnostics;
}

/**
 * Formats diagnostic data as a string for display or logging
 */
export function formatDiagnostics(data: ConnectionDumpData): string {
  return `
📊 CONNECTION DIAGNOSTIC REPORT
==============================
📅 Time: ${new Date(data.timestamp).toISOString()}
🆔 Device ID: ${data.deviceId || 'not set'}
🔌 Socket ID: ${data.socketId || 'not connected'}
🔄 State: ${data.connectionState}
📶 Transport: ${data.transport}
🏓 Latency: ${data.socketHealth.roundTripMs !== null ? `${data.socketHealth.roundTripMs}ms` : 'unknown'}
♻️ Reconnects: ${data.socketHealth.reconnectAttempts}
🔌 Circuit Breaker: ${data.socketHealth.circuitBreakerTripped ? 'TRIPPED' : 'OK'}

📱 DEVICE INFO
-------------
💻 User Agent: ${data.deviceInfo.userAgent}
📐 Screen: ${data.deviceInfo.screenSize}
🌐 Language: ${data.deviceInfo.language}
🕒 Timezone: ${data.deviceInfo.timeZone}
📶 Network: ${data.deviceInfo.networkType}

📝 RECENT EVENTS
--------------
${data.lastEvents.map((event, i) => 
  `[${new Date(event.timestamp).toISOString()}] ${event.type}${event.payload ? ` - ${JSON.stringify(event.payload)}` : ''}`
).join('\n')}
`;
}

/**
 * Dumps the current connection state to console and returns it
 */
export async function dumpConnectionState(): Promise<ConnectionDumpData> {
  const diagnostics = await captureConnectionDiagnostics();
  
  // Log formatted diagnostics to console
  console.group('📊 Connection Diagnostic Dump');
  console.log(formatDiagnostics(diagnostics));
  console.groupEnd();
  
  return diagnostics;
}

/**
 * Copies diagnostic dump to clipboard
 */
export async function copyDiagnosticsToClipboard(): Promise<boolean> {
  try {
    const diagnostics = await captureConnectionDiagnostics();
    const formatted = formatDiagnostics(diagnostics);
    
    await navigator.clipboard.writeText(formatted);
    console.log('📋 Diagnostics copied to clipboard');
    return true;
  } catch (e) {
    console.error('Failed to copy diagnostics to clipboard:', e);
    return false;
  }
}

/**
 * Sets up a global diagnostic dump trigger on Ctrl+Shift+D
 */
export function setupDiagnosticKeyboardTrigger(): void {
  if (typeof window === 'undefined') return;
  
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+Shift+D to dump diagnostics
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      console.log('🔍 Diagnostic dump triggered by keyboard shortcut');
      dumpConnectionState();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  
  // Expose global method for triggering diagnostics
  (window as any).debugDumpConnection = dumpConnectionState;
  
  // Add to VizoraDebug namespace if it exists
  if (!(window as any).VizoraDebug) {
    (window as any).VizoraDebug = {};
  }
  (window as any).VizoraDebug.exportState = dumpConnectionState;
  (window as any).VizoraDebug.copyState = copyDiagnosticsToClipboard;
  
  console.log('🔍 Connection diagnostics initialized. Press Ctrl+Shift+D to dump state or use window.VizoraDebug.exportState()');
}

/**
 * Initialize the diagnostic dump system
 */
export function initializeDiagnosticDump(): void {
  if (typeof window === 'undefined') return;
  
  // Only set up in dev mode or with debug flag
  if (process.env.NODE_ENV !== 'production' || (window as any).VIZORA_DEBUG) {
    setupDiagnosticKeyboardTrigger();
  }
} 