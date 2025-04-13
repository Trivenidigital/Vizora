import { ConnectionManager } from '@vizora/common';
import { tokenManager } from './authService';

// Event listener type
type SocketListener = (data: any) => void;

// Create singleton connection manager instance
const connectionManager = new ConnectionManager(
  {
    baseUrl: import.meta.env.VITE_API_URL || '/api',
    socketPath: import.meta.env.VITE_SOCKET_PATH || '/socket.io',
    tokenManager,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: false,
    debug: import.meta.env.DEV,
  },
  'VizoraWeb'
);

/**
 * Socket service for managing WebSocket connections
 */
class SocketService {
  private listeners: Map<string, Set<SocketListener>> = new Map();
  
  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    await connectionManager.connect();
    
    // Log successful connection in development
    if (import.meta.env.DEV) {
      console.log('Socket connected with ID:', connectionManager.getSocketId());
    }
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    connectionManager.disconnect();
    
    // Log disconnection in development
    if (import.meta.env.DEV) {
      console.log('Socket disconnected');
    }
  }
  
  /**
   * Check if the socket is connected
   * @returns Whether the socket is connected
   */
  isConnected(): boolean {
    return connectionManager.isConnected();
  }
  
  /**
   * Add event listener
   * @param event Event name
   * @param callback Event callback
   */
  on(event: string, callback: SocketListener): void {
    // Initialize listener set if needed
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
      
      // Register the listener with connection manager
      connectionManager.on(event, (data: any) => {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach(listener => listener(data));
        }
      });
    }
    
    // Add the callback to our listeners set
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.add(callback);
    }
  }
  
  /**
   * Remove event listener
   * @param event Event name
   * @param callback Event callback
   */
  off(event: string, callback: SocketListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      
      // If no listeners left for this event, remove from connection manager
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
        connectionManager.off(event);
      }
    }
  }
  
  /**
   * Emit event to server
   * @param event Event name
   * @param data Event data
   */
  emit(event: string, data: any): void {
    connectionManager.emit(event, data);
  }
  
  /**
   * Get the socket ID
   * @returns Socket ID or null if not connected
   */
  getSocketId(): string | null {
    return connectionManager.getSocketId();
  }
  
  /**
   * Get connection latency (ping)
   * @returns Promise resolving to latency in milliseconds
   */
  async getLatency(): Promise<number> {
    return connectionManager.getLatency();
  }
}

// Create and export singleton instance
export const socketService = new SocketService(); 