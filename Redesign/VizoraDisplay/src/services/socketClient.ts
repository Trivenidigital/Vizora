import { ConnectionManager, ConnectionConfig as SocketIoConfig } from '@vizora/common';
import { EventEmitter } from '../utils/EventEmitter';
import { io, Socket } from 'socket.io-client';
import { TokenManager } from '@vizora/common/services/TokenManager';

// Create singleton token manager instance
const tokenManager = new TokenManager(
  {
    storageKey: 'display_token',
    autoRefresh: true,
    validateOnLoad: true,
  },
  null, // No refresh config for this simple implementation
  'VizoraDisplay'
);

// Main socket client class that extends EventEmitter
// This offers backward compatibility with the existing implementation
// while leveraging the new ConnectionManager internally
export class VizoraSocketClient extends EventEmitter {
  private connectionManager: ConnectionManager;
  public connected: boolean = false;

  constructor(url: string, config: Partial<SocketIoConfig> = {}) {
    super();
    
    // Determine if in development environment
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Create connection manager with appropriate configuration
    this.connectionManager = new ConnectionManager({
      baseUrl: url,
      reconnection: config.reconnection ?? true,
      reconnectionAttempts: config.reconnectionAttempts || 5,
      reconnectionDelay: config.reconnectionDelay || 1000,
      reconnectionDelayMax: config.reconnectionDelayMax || 5000,
      timeout: config.timeout || 20000,
      autoConnect: config.autoConnect ?? false,
      debug: isDevelopment || config.debug || false,
      serviceName: config.serviceName || 'VizoraDisplay',
    });
    
    // Set up event forwarding
    this.setupEventForwarding();
  }

  // Set up event listeners that forward events to this emitter
  private setupEventForwarding(): void {
    // Forward connection events
    this.connectionManager.on('connect', () => {
      this.connected = true;
      this.emit('connect');
    });
    
    // Forward disconnection events
    this.connectionManager.on('disconnect', (data) => {
      this.connected = false;
      this.emit('disconnect', data.reason);
    });
    
    // Forward error events
    this.connectionManager.on('connect_error', (data) => {
      this.emit('error', data.error);
    });
    
    // Forward content events
    this.connectionManager.on('content:update', (data) => {
      this.emit('content:update', data);
    });
    
    // Forward content push events
    this.connectionManager.on('content:push', (data) => {
      this.emit('content:push', data);
    });
    
    // Forward schedule events
    this.connectionManager.on('schedule:update', (data) => {
      this.emit('schedule:update', data);
    });
    
    // Forward command events
    this.connectionManager.on('command', (data) => {
      this.emit('command', data);
    });
    
    // Set up catch-all event forwarder for other events
    this.connectionManager.onAny((event, ...args) => {
      // Don't re-emit events we've already handled
      if (!['connect', 'disconnect', 'connect_error', 'content:update', 
           'content:push', 'schedule:update', 'command'].includes(event)) {
        this.emit(event, ...args);
      }
    });
  }

  // Connect to the socket server
  public async connect(token?: string): Promise<void> {
    // If token is provided, set it in the token manager
    if (token) {
      tokenManager.setToken(token);
    }
    
    // Connect using the connection manager
    await this.connectionManager.connect();
    this.connected = this.connectionManager.isConnected();
  }

  // Disconnect from the socket server
  public disconnect(): void {
    this.connectionManager.disconnect();
    this.connected = false;
  }

  // Override emit to send events to the server
  public emit(event: string, data?: unknown): any {
    // Special case for events that should be forwarded to listeners
    if (['connect', 'disconnect', 'error'].includes(event)) {
      return super.emit(event, data);
    }
    
    // Otherwise, emit to the server
    if (this.connected) {
      // this.connectionManager.send(event, data);
    } else {
      throw new Error('Socket is not connected');
    }
    
    // Also emit locally for any listeners on this instance
    return super.emit(event, data);
  }
  
  // Send an event to the server (explicitly, without emitting locally)
  public send(event: string, data?: unknown): void {
    console.warn('VizoraSocketClient.send - underlying ConnectionManager.send missing?');
    // if (!this.connected) { throw new Error('Socket is not connected'); }
    // this.connectionManager.send(event, data);
  }
  
  // Get the socket ID
  public getSocketId(): string | null {
    return this.connectionManager.getSocketId();
  }
  
  // Get the token manager
  public getTokenManager(): TokenManager {
    return tokenManager;
  }
  
  // Get the connection manager
  public getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }
  
  // Get current connection latency (ping)
  public async getLatency(): Promise<number> {
    console.warn('VizoraSocketClient.getLatency - underlying ConnectionManager.getLatency missing?');
    // return this.connectionManager.getLatency();
    return Promise.resolve(999);
  }
} 