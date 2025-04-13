/**
 * ConnectionManagerFactory
 * 
 * Provides centralized creation and access to ConnectionManager instances:
 * - A singleton pattern for shared use across the application
 * - A factory method for creating isolated instances when needed
 * - Integrated diagnostics for development and troubleshooting
 */

import { ConnectionManager, ConnectionConfig, ConnectionState } from "./ConnectionManager";
import { 
  emitDiagnosticEvent, 
  ConnectionDiagnosticEventType,
  getCurrentTransport
} from "../devtools/ConnectionStateObservable";
import { ConnectionHealthMonitor, getConnectionHealthMonitor } from "./ConnectionHealthMonitor";

// Singleton instance shared across the application
let sharedConnectionManager: ConnectionManager | null = null;

/**
 * Creates a new instance of ConnectionManager with the provided config
 * and attaches diagnostics
 * 
 * @param config Optional configuration for the ConnectionManager
 * @returns A new ConnectionManager instance
 */
export function createConnectionManager(config?: ConnectionConfig): ConnectionManager {
  const manager = new ConnectionManager(config || {
    baseUrl: typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.API_URL || 'http://localhost:3000',
    reconnection: true,
    autoConnect: true
  });

  // Attach diagnostics
  attachDiagnostics(manager);
  
  // Attach health monitoring
  attachHealthMonitoring(manager);

  return manager;
}

/**
 * Attaches diagnostic event listeners to a ConnectionManager instance
 */
function attachDiagnostics(manager: ConnectionManager): void {
  // Log and emit diagnostic events for socket state changes
  manager.on('state:change', ({ type, state }) => {
    if (type === 'socket') {
      const socketId = manager.getSocketId();
      
      // Convert internal state to diagnostic event type
      let eventType: ConnectionDiagnosticEventType;
      switch (state) {
        case ConnectionState.CONNECTED:
          eventType = ConnectionDiagnosticEventType.CONNECTED;
          break;
        case ConnectionState.RECONNECTING:
          eventType = ConnectionDiagnosticEventType.RECONNECTING;
          break;
        case ConnectionState.DISCONNECTED:
          eventType = ConnectionDiagnosticEventType.DISCONNECTED;
          break;
        case ConnectionState.ERROR:
          eventType = ConnectionDiagnosticEventType.ERROR;
          break;
        default:
          eventType = ConnectionDiagnosticEventType.DISCONNECTED;
      }

      // Log detailed state change
      console.log(`🔌 [ConnectionManager] State change: ${state}, socket ID: ${socketId || 'none'}`);
      
      // Get transport if connected
      let transport = 'none';
      try {
        if (state === ConnectionState.CONNECTED && manager.getSocket()) {
          transport = getCurrentTransport(manager.getSocket());
          console.log(`🔌 [ConnectionManager] Transport: ${transport}`);
        }
      } catch (e) {
        // Ignore errors accessing transport
      }
      
      // Emit diagnostic event
      emitDiagnosticEvent({
        type: eventType,
        connectionState: state,
        socketId,
        timestamp: Date.now(),
        payload: { 
          transport,
          state
        }
      });
    }
  });

  // Track connect events with transport info
  manager.on('connect', () => {
    const socketId = manager.getSocketId();
    const socket = manager.getSocket();
    const transport = getCurrentTransport(socket);
    
    console.log(`🔌 [ConnectionManager] Connected with ID: ${socketId}, transport: ${transport}`);
    
    emitDiagnosticEvent({
      type: ConnectionDiagnosticEventType.CONNECTED,
      connectionState: ConnectionState.CONNECTED,
      socketId,
      timestamp: Date.now(),
      payload: { transport }
    });
  });

  // Track socket ID changes
  let lastSocketId: string | null = null;
  manager.on('socket:id', (id: string) => {
    if (id !== lastSocketId) {
      console.log(`🔌 [ConnectionManager] Socket ID changed: ${id}`);
      lastSocketId = id;
      
      emitDiagnosticEvent({
        type: ConnectionDiagnosticEventType.SOCKET_ID_CHANGED,
        socketId: id,
        timestamp: Date.now()
      });
    }
  });

  // Track transport upgrades
  const socket = manager.getSocket();
  if (socket?.io) {
    try {
      // @ts-ignore - accessing internal property
      socket.io.on('upgrade', (transport: any) => {
        console.log(`🔌 [ConnectionManager] Transport upgraded to: ${transport.name}`);
        
        emitDiagnosticEvent({
          type: ConnectionDiagnosticEventType.TRANSPORT_UPGRADED,
          socketId: manager.getSocketId(),
          timestamp: Date.now(),
          payload: { transport: transport.name }
        });
      });
    } catch (e) {
      // Ignore errors if io property doesn't exist
    }
  }

  // Track reconnection attempts
  manager.on('reconnect_attempt', (attempt: number) => {
    console.log(`🔌 [ConnectionManager] Reconnect attempt #${attempt}`);
    
    emitDiagnosticEvent({
      type: ConnectionDiagnosticEventType.RECONNECTING,
      connectionState: ConnectionState.RECONNECTING,
      socketId: manager.getSocketId(),
      timestamp: Date.now(),
      payload: { attempt }
    });
  });

  // Track connection errors
  manager.on('connect_error', (error: Error) => {
    console.error(`🔌 [ConnectionManager] Connection error:`, error.message);
    
    emitDiagnosticEvent({
      type: ConnectionDiagnosticEventType.ERROR,
      connectionState: ConnectionState.ERROR,
      socketId: manager.getSocketId(),
      timestamp: Date.now(),
      payload: { error: error.message }
    });
  });

  // Track circuit breaker events
  manager.on('circuit_breaker:trip', () => {
    console.warn(`🔌 [ConnectionManager] Circuit breaker tripped`);
    
    emitDiagnosticEvent({
      type: ConnectionDiagnosticEventType.CIRCUIT_BREAKER_TRIPPED,
      connectionState: ConnectionState.ERROR,
      socketId: manager.getSocketId(),
      timestamp: Date.now()
    });
  });

  manager.on('circuit_breaker:reset', () => {
    console.log(`🔌 [ConnectionManager] Circuit breaker reset`);
    
    emitDiagnosticEvent({
      type: ConnectionDiagnosticEventType.CIRCUIT_BREAKER_RESET,
      connectionState: ConnectionState.DISCONNECTED,
      socketId: manager.getSocketId(),
      timestamp: Date.now()
    });
  });
}

/**
 * Attaches health monitoring to a ConnectionManager instance
 */
function attachHealthMonitoring(manager: ConnectionManager): void {
  // Create a new health monitor for this manager, or use existing one
  let healthMonitor: ConnectionHealthMonitor;
  try {
    healthMonitor = getConnectionHealthMonitor(manager);
  } catch (e) {
    // First initialization, no need to handle error
    healthMonitor = getConnectionHealthMonitor(manager);
  }

  // Extend the manager with health-related methods
  // @ts-ignore: Adding properties to the manager instance
  manager.getLatency = async (): Promise<number | null> => {
    return await healthMonitor.measureLatency();
  };

  // @ts-ignore: Adding properties to the manager instance
  manager.getHealthStatus = (): { 
    roundTripMs: number | null; 
    stability: 'good' | 'fair' | 'poor' | 'lost';
    transport: string;
    healthScore: number;
  } => {
    const metrics = healthMonitor.getMetrics();
    return {
      roundTripMs: metrics.roundTripMs,
      stability: metrics.stability,
      transport: metrics.transport,
      healthScore: healthMonitor.getHealthScore()
    };
  };

  // @ts-ignore: Adding properties to the manager instance
  manager.getFullHealthMetrics = () => {
    return healthMonitor.getMetrics();
  };

  // Reset health metrics on disconnect
  manager.on('disconnect', () => {
    healthMonitor.reset();
  });
}

/**
 * Returns the shared singleton instance of ConnectionManager
 * Creates it if it doesn't already exist
 * 
 * @returns The shared ConnectionManager instance
 */
export function getConnectionManager(): ConnectionManager {
  if (!sharedConnectionManager) {
    sharedConnectionManager = createConnectionManager();
  }

  return sharedConnectionManager;
}

/**
 * Resets the shared connection manager instance
 * Useful for testing or when needing to force recreation with different settings
 */
export function resetConnectionManager(): void {
  if (sharedConnectionManager) {
    try {
      sharedConnectionManager.disconnect();
    } catch (e) {
      // Ignore disconnect errors during reset
    }
    sharedConnectionManager = null;
  }
}

/**
 * Sets a custom connection manager as the shared instance
 * Useful for testing with mocks
 * 
 * @param manager The ConnectionManager instance to use as singleton
 */
export function setConnectionManager(manager: ConnectionManager): void {
  sharedConnectionManager = manager;
} 