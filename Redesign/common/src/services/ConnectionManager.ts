/**
 * ConnectionManager - Handles HTTP and WebSocket connections
 * 
 * ⚠️ IMPORTANT SOCKET.IO NAMESPACE NOTES ⚠️
 * 
 * Socket.IO Namespace Best Practices:
 * 
 * 1. ALWAYS use the root namespace (/) for your Socket.IO connections:
 *    Example: io(serverUrl) - CORRECT
 *            io(`${serverUrl}/display`) - INCORRECT, will cause "Invalid namespace" errors
 * 
 * 2. Instead of using namespaces for different concerns, use event naming conventions:
 *    Example: socket.emit('display:register', data) - CORRECT
 *            socket.emit('register', data) - AMBIGUOUS
 * 
 * 3. Server-side, use room-based segregation instead of namespaces:
 *    Example: socket.join(`display:${displayId}`) - CORRECT
 * 
 * 4. When initializing the socket, ensure the URL doesn't contain path components:
 *    Example: 'https://api.vizora.io' - CORRECT
 *            'https://api.vizora.io/' - PROBLEMATIC (trailing slash may cause issues)
 *            'https://api.vizora.io/api' - INCORRECT (path component in URL)
 * 
 * This approach ensures consistent behavior across different Socket.IO versions and environments.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import EventEmitter from 'eventemitter3';
import io, { Socket, ManagerOptions, SocketOptions } from 'socket.io-client';

export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

// Define enhanced connection state type for diagnostics
export enum DiagnosticConnectionState {
  CONNECTED = 'connected',
  CONNECTING = 'connecting',
  DISCONNECTED = 'disconnected',
  FATAL = 'fatal'
}

// Transport types for diagnostics
export type TransportType = 'polling' | 'websocket' | 'unknown';

// Socket adapter types for diagnostics
export type SocketAdapterType = 'memory' | 'redis' | 'unknown';

// Connection state change listener type
export type ConnectionStateChangeListener = (state: ConnectionDiagnostics) => void;

/**
 * Connection diagnostics interface
 */
export interface ConnectionDiagnostics {
  connectionState: DiagnosticConnectionState;
  socketId: string | null;
  retryCount: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  wasRecovered: boolean;
  transport: TransportType;
  isThrottled: boolean;
  circuitBreakerTripped: boolean;
  retryHistory: string[]; // timestamps of reconnection attempts
  fatalSocketState: boolean;
  retryCooldownRemaining?: number; // in seconds
  socketAdapter?: SocketAdapterType; // type of socket adapter being used
  redisConnected?: boolean; // whether Redis is connected (if using Redis adapter)
}

// Constants for reconnection throttling
const MIN_RECONNECT_DELAY = 5000; // 5 seconds minimum between reconnection attempts
const RECONNECT_BACKOFF_FACTOR = 1.5; // Exponential backoff factor
const MAX_RECONNECT_DELAY = 60000; // Maximum 1 minute between attempts
const MAX_CONSECUTIVE_FAILURES = 5; // After this many failures, use maximum delay
const CONNECT_TIMEOUT = 15000; // 15 seconds timeout for connection attempts

// Constants for reconnection controls
const MIN_RECONNECTION_DELAY = 5000; // 5 seconds minimum
const MAX_RECONNECTION_DELAY = 60000; // 1 minute maximum 
const RECONNECTION_ATTEMPTS_MAX = 10;
const RECONNECTION_MULTIPLIER = 1.5; // Exponential backoff factor

// Circuit breaker specific constants
const CIRCUIT_BREAKER_THRESHOLD = 10; // Max reconnection attempts within window
const CIRCUIT_BREAKER_WINDOW_MS = 2 * 60 * 1000; // 2 minute window
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown

// Defines the maximum number of connection state change listeners
const MAX_LISTENERS = 50;

export interface ConnectionConfig {
  baseUrl: string;
  socketPath?: string;
  tokenProvider?: () => Promise<string | null> | string | null;
  tokenHeader?: string;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  timeout?: number;
  autoConnect?: boolean;
  debug?: boolean;
  serviceName?: string;
  withCredentials?: boolean;
}

export type ConnectionEventType = 
  | 'connect'
  | 'disconnect'
  | 'reconnect'
  | 'reconnect_attempt'
  | 'reconnect_error'
  | 'reconnect_failed'
  | 'error'
  | 'connect_error'
  | 'state:change'
  | 'token:refresh'
  | 'token:refresh:error'
  | 'namespace_error';

export type LogEntry = {
  timestamp: number;
  event: string;
  data?: any;
  level: 'info' | 'warn' | 'error';
};

export type ConnectionHistoryEntry = {
  event: string;
  timestamp: number;
};

/**
 * Connection Manager for handling HTTP and WebSocket connections
 */
export class ConnectionManager extends EventEmitter {
  private config: ConnectionConfig;
  private socket: Socket | null = null;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private consecutiveFailures = 0;
  private http: AxiosInstance;
  private httpConnectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private socketConnectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private isTokenRefreshing = false;
  private tokenRefreshPromise: Promise<string | null> | null = null;
  private readonly serviceName: string;
  private lastError: Error | null = null;
  private lastErrorTime: Date | null = null;
  private reconnecting = false;
  private lastConnectedAt: Date | null = null;
  private lastReconnectAttempt: number = 0;
  private connectTimeoutTimer: any = null;
  private connectionInProgress = false;
  private lastReconnectTime = 0;
  
  // Add tracking for last connection error
  private lastConnectionError: Error | null = null;
  
  // New fields for enhanced diagnostics
  private lastDisconnectedAt: number | null = null;
  private wasRecovered = false;
  private isThrottled = false;
  private circuitBreakerTripped = false;
  private currentTransport: TransportType = 'unknown';
  private stateChangeListeners: ConnectionStateChangeListener[] = [];
  private maxRetries = RECONNECTION_ATTEMPTS_MAX;
  private eventHandlersInitialized = false;
  private connectionLogs: LogEntry[] = [];
  private connectionHistory: ConnectionHistoryEntry[] = [];
  private lastHeartbeat: number | null = null;
  private maxLogEntries: number = 100;
  private maxHistoryEntries: number = 50;

  // Add these properties to the ConnectionManager class
  private reconnectAttemptHistory: number[] = []; // Timestamps of reconnection attempts
  private circuitBreakerCooldownTimer: any = null;
  private circuitBreakerCooldownStartedAt: number | null = null;
  private fatalSocketState = false;

  /**
   * Create a new ConnectionManager
   */
  constructor(config: ConnectionConfig) {
    super();
    
    this.config = {
      // Default config
      tokenHeader: 'Authorization',
      reconnection: true,
      reconnectionAttempts: config.reconnectionAttempts,
      reconnectionDelay: MIN_RECONNECT_DELAY, // Use minimum reconnect delay as default
      reconnectionDelayMax: MAX_RECONNECT_DELAY,
      timeout: CONNECT_TIMEOUT,
      autoConnect: true,
      debug: false,
      withCredentials: true,
      ...config
    };
    
    this.serviceName = config.serviceName || 'ConnectionManager';
    
    // Initialize HTTP client
    this.http = this.setupHttpClient();
    
    // Auto-connect if configured
    if (this.config.autoConnect) {
      // Verify HTTP connection first
      // this.testHttpConnection()
      //   .then(() => {
          // Then try to establish socket connection if needed
          if (this.config.socketPath) {
            this.connect();
          }
      //   })
      //   .catch(error => {
      //     this.log('Failed to establish initial HTTP connection:', error);
      //   });
    }
  }
  
  /**
   * Setup the HTTP client with interceptors for token handling
   */
  private setupHttpClient(): AxiosInstance {
    const client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      withCredentials: this.config.withCredentials
    });
    
    // Request interceptor to add auth token
    client.interceptors.request.use(async (config) => {
      // Get token if provider is available
      if (this.config.tokenProvider) {
        try {
          const token = await this.getToken();
          
          if (token) {
            // Set auth header
            config.headers[this.config.tokenHeader!] = token.startsWith('Bearer ') 
              ? token 
              : `Bearer ${token}`;
          }
        } catch (error) {
          this.log('Error getting token for request:', error);
        }
      }
      
      return config;
    });
    
    // Response interceptor for error handling
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (axios.isAxiosError(error) && error.response) {
          // Handle 401 errors by refreshing token
          if (error.response.status === 401) {
            // Log the 401 error
            this.log('Received 401 unauthorized response, attempting token refresh');
            
            // Try to refresh token if we have a token provider
            if (this.config.tokenProvider) {
              try {
                // Force token refresh
                await this.refreshToken();
                
                // Retry the original request with new token
                const token = await this.getToken();
                
                if (token && error.config) {
                  // Update the Authorization header
                  error.config.headers[this.config.tokenHeader!] = token.startsWith('Bearer ') 
                    ? token 
                    : `Bearer ${token}`;
                  
                  // Create a new request with the updated config
                  return axios(error.config);
                }
              } catch (refreshError) {
                this.log('Token refresh failed:', refreshError);
                // Update connection state
                this.updateState(ConnectionState.ERROR);
              }
            }
          }
        }
        
        // For network errors, update HTTP connection state
        if (axios.isAxiosError(error) && !error.response) {
          this.updateState(ConnectionState.DISCONNECTED);
        }
        
        // Propagate the error
        return Promise.reject(error);
      }
    );
    
    return client;
  }
  
  /**
   * Make an HTTP request and handle errors
   */
  private async request<T = any>(method: string, url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      const requestConfig: AxiosRequestConfig = {
        method,
        url,
        ...config
      };
      
      if (data && (method === 'post' || method === 'put' || method === 'patch')) {
        requestConfig.data = data;
      } else if (data) {
        requestConfig.params = data;
      }
      
      // Update HTTP connection state
      this.updateState(ConnectionState.CONNECTING, 'http');
      
      const response = await this.http.request<T>(requestConfig);
      
      // Update HTTP connection state on success
      this.updateState(ConnectionState.CONNECTED, 'http');
      
      return response;
    } catch (error) {
      // Update HTTP connection state on error
      if (axios.isAxiosError(error) && error.response) {
        // Server responded with error status
        this.updateState(ConnectionState.ERROR, 'http');
      } else {
        // Network error or other issue
        this.updateState(ConnectionState.DISCONNECTED, 'http');
      }
      
      throw error;
    }
  }
  
  /**
   * Make a GET request
   */
  public async get<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>('get', url, params, config);
  }
  
  /**
   * Make a POST request
   */
  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>('post', url, data, config);
  }
  
  /**
   * Make a PUT request
   */
  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>('put', url, data, config);
  }
  
  /**
   * Make a DELETE request
   */
  public async delete<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>('delete', url, params, config);
  }
  
  /**
   * Initialize socket instance
   */
  private async setupSocket(token?: string | null): Promise<void> {
    try {
      const apiUrl = this.config.baseUrl || '';
      
      // Parse the URL to ensure it's a valid socket.io server URL
      // Important: Socket.io URLs should NOT include paths
      let serverUrl = apiUrl;
      
      try {
        const url = new URL(apiUrl);
        // Strip any path components to avoid namespace errors
        serverUrl = `${url.protocol}//${url.host}`;
      } catch (error) {
        // If URL parsing fails, use the original URL but log a warning
        this.log(`⚠️ WARNING: Could not parse API URL "${apiUrl}". Using as-is.`, error);
      }
      
      // Log the normalized URL
      this.log(`Socket connecting to normalized URL: "${serverUrl}" with path "${this.config.socketPath || '/socket.io'}"`);
      
      // Clean up existing socket if it exists
      if (this.socket) {
        // Properly disconnect before creating a new socket
        if (this.socket.connected) {
          this.log('Disconnecting existing socket before reconnect');
          try {
            this.socket.disconnect();
          } catch (e) {
            this.log('Error disconnecting socket:', e);
          }
        }
        this.socket.removeAllListeners();
        this.socket = null;
      }
      
      // Initialize socket options with reconnection settings
          const socketOptions: Partial<ManagerOptions & SocketOptions> = {
            reconnection: this.config.reconnection,
            reconnectionAttempts: this.config.reconnectionAttempts,
            reconnectionDelay: this.config.reconnectionDelay,
            reconnectionDelayMax: this.config.reconnectionDelayMax,
            timeout: this.config.timeout,
        autoConnect: false, // Important: we'll connect manually
        path: this.config.socketPath,
        transports: ['websocket', 'polling'],
        withCredentials: true // Enable CORS with credentials
      };
      
      // Add token to auth if provided
          if (token) {
        socketOptions.auth = { token };
      }
      
      // Log the configuration
      this.log('Socket.IO configuration:', {
        url: serverUrl,
        path: this.config.socketPath,
        reconnection: socketOptions.reconnection,
        reconnectionDelay: socketOptions.reconnectionDelay,
        reconnectionDelayMax: socketOptions.reconnectionDelayMax,
        timeout: socketOptions.timeout,
        hasToken: !!token
      });
      
      // Initialize the socket with the root namespace (VERY IMPORTANT)
      // Namespace errors often occur when using the wrong URL format
      // ALWAYS use root namespace (/) and handle namespaces via events/rooms
      this.socket = io(serverUrl, socketOptions);
      
      // WORKAROUND: Override socket.io's internal reconnection settings 
      // This ensures our throttling approach actually works
      if (this.socket && this.socket.io && this.socket.io.opts) {
        // Force minimum reconnection delay for socket.io's internal mechanism
        this.socket.io.opts.reconnectionDelay = MIN_RECONNECT_DELAY;
        this.socket.io.opts.reconnectionDelayMax = MAX_RECONNECT_DELAY;
        
        this.log(`Set socket.io internal reconnection delays: ${MIN_RECONNECT_DELAY}-${MAX_RECONNECT_DELAY}ms`);
      }
      
      // Mark socket as ready to connect
      this.log('Socket instance created and configured successfully');
          
        } catch (error) {
      this.log('Failed to set up socket:', error);
      throw error;
    }
  }
  
  /**
   * Set up socket event handlers
   */
  private setupSocketEventHandlers(): void {
    if (!this.socket) {
      this.log('Cannot set up event handlers: socket is null');
      return;
    }
    
    // Skip if handlers are already initialized
    if (this.eventHandlersInitialized) {
      this.log('Event handlers already initialized, skipping');
      return;
    }
    
    this.log('Setting up socket event handlers');
    
    // Remove existing listeners to prevent duplicates
    this.socket.removeAllListeners();
    
    // Basic Socket.IO events
    this.socket.on('connect', () => {
      // Clear connect timeout if it exists
      if (this.connectTimeoutTimer) {
        clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
      }
      
      // Update state and track connection time
      this.lastConnectedAt = new Date();
      console.log('[Socket] ✅ Successfully connected to server! Socket ID:', this.socket?.id);
      this.log('Socket connected with ID:', this.socket?.id);
      this.updateState(ConnectionState.CONNECTED, 'socket');
      this.reconnectAttempts = 0;
      this.reconnecting = false;
      this.lastError = null;
      
      // Force emit the ID for debugging
      this.emit('socket:id', this.socket?.id);
      this.emit('connect');
      
      // Detect and track transport type
      // @ts-ignore - Accessing internal property for diagnostics
      const transport = this.socket?.io?.engine?.transport?.name;
      if (transport) {
        this.currentTransport = transport as TransportType;
        this.log(`🔌 Initial transport type: ${this.currentTransport}`);
      }
      
      // Log additional debug info
      if (this.config.debug) {
        this.log('Socket details:', {
          id: this.socket?.id,
          connected: this.socket?.connected,
          active: !!this.socket,
          connectedAt: this.lastConnectedAt,
          transport: this.currentTransport
        });
      }
      
      this.reconnectAttempts = 0;
      this.addConnectionHistoryEntry('connect', `Socket connected: ${this.socket?.id || 'unknown'}`);
    });
    
    this.socket.on('disconnect', (reason) => {
      this.log('Socket disconnected:', reason);
      
      // Track disconnection reason and timestamp
      this.lastDisconnectedAt = Date.now();
      
      // Different handling based on disconnect reason
      if (reason === 'io server disconnect') {
        // Server has forcefully disconnected the socket
        this.updateState(ConnectionState.DISCONNECTED, 'socket');
        this.emit('disconnect', reason);
      } else if (reason === 'io client disconnect') {
        // Client has disconnected the socket
        this.updateState(ConnectionState.DISCONNECTED, 'socket');
        this.emit('disconnect', reason);
      } else {
        // Other disconnections should automatically reconnect if configured
        this.updateState(ConnectionState.RECONNECTING, 'socket');
        this.reconnecting = true;
        this.emit('disconnect', reason);
        
        // Handle reconnection if configured
        if (this.config.reconnection) {
          this.handleReconnect();
      }
      }
      
      this.addConnectionHistoryEntry('disconnect', `Socket disconnected: ${reason}`);
    });
    
    this.socket.on('connect_error', (error) => {
      this.lastError = error;
      this.lastErrorTime = new Date();
      this.lastConnectionError = error;
      console.error('[Socket] ❌ Connect error:', error.message);
      this.log('Socket connection error:', error);
      
      // Increment failure counter
      this.consecutiveFailures++;
      
      // Check if circuit breaker should trip
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.circuitBreakerTripped = true;
        this.log('🔌 Circuit breaker tripped after consecutive failures');
      }
      
      this.updateState(ConnectionState.ERROR, 'socket');
      
      // Extract error details for better logging
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Socket connection error details: ${errorMessage}`);
      
      // Check for namespace errors which indicate incorrect configuration
      if (errorMessage && (
          errorMessage.includes('namespace') || 
          errorMessage.includes('Namespace'))) {
        this.log('ERROR: Invalid namespace detected. Using root namespace only.', error);
        
        // Emit a specific error type for invalid namespace
        this.emit('namespace_error', error);
      }
      
      // Check for CORS errors
      if (errorMessage && (
          errorMessage.includes('CORS') || 
          errorMessage.includes('Cross-Origin') ||
          errorMessage.includes('Access-Control'))) {
        this.log('ERROR: CORS policy violation detected.', error);
      }
      
      // Check for network errors
      if (errorMessage && (
          errorMessage.includes('network') || 
          errorMessage.includes('Network') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('unreachable'))) {
        this.log('ERROR: Network connectivity issue detected.', error);
      }
      
      this.emit('connect_error', error);
      
      // If we're not already reconnecting, start reconnection process
      if (this.config.reconnection && !this.reconnecting) {
        this.handleReconnect();
      }
      
      this.reconnectAttempts++;
      this.addConnectionHistoryEntry('connect_error', `Connection error: ${error.message}`);
    });
    
    // Error event
    this.socket.on('error', (error) => {
      this.log(`Socket error: ${error.message || error}`);
      this.lastError = error;
      this.lastErrorTime = new Date();
      
      // Increment failure counter but only if this is a real error
      this.consecutiveFailures++;
      
      this.updateState(ConnectionState.ERROR, 'socket');
      this.emit('error', error);
    });
    
    // Reconnection events
    // @ts-ignore - Reconnect events may be on socket.io
    if (this.socket.io) {
      // @ts-ignore - Access socket.io for reconnect events
    this.socket.io.on('reconnect', (attempt) => {
      this.log(`Socket reconnected after ${attempt} attempts`);
      this.updateState(ConnectionState.CONNECTED, 'socket');
      this.reconnecting = false;
        
        // Set wasRecovered flag since this is a reconnection
        this.wasRecovered = true;
        
        // Reset failure counter
        this.consecutiveFailures = 0;
        
      this.emit('reconnect', attempt);
    });
    
      // @ts-ignore - Access socket.io for reconnect events
    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.log(`Socket reconnect attempt ${attempt}`);
      this.reconnecting = true;
        this.reconnectAttempts = attempt;
        
        // Set throttling flag if attempting too frequently
        const now = Date.now();
        this.isThrottled = (now - this.lastReconnectTime < MIN_RECONNECT_DELAY);
        this.lastReconnectTime = now;
        
        // Track reconnection attempt for circuit breaker
        this.trackReconnectionAttempt();
        
        this.updateState(ConnectionState.RECONNECTING, 'socket');
      this.emit('reconnect_attempt', attempt);
        
        this.reconnectAttempts = attempt;
        this.addConnectionHistoryEntry('reconnect_attempt', `Reconnect attempt: ${attempt}`);
    });
    
      // @ts-ignore - Access socket.io for reconnect events
    this.socket.io.on('reconnect_error', (error) => {
      this.lastError = error;
      this.lastErrorTime = new Date();
      this.log('Socket reconnection error:', error);
        
        // Increment failure counter
        this.consecutiveFailures++;
        
      this.emit('reconnect_error', error);
    });
    
      // @ts-ignore - Access socket.io for reconnect events
    this.socket.io.on('reconnect_failed', () => {
      this.log('Socket reconnection failed after all attempts');
      this.updateState(ConnectionState.ERROR, 'socket');
      this.reconnecting = false;
        
        // Update circuit breaker state
        this.circuitBreakerTripped = true;
        
      this.lastError = new Error('Reconnection failed after all attempts');
      this.lastErrorTime = new Date();
      this.emit('reconnect_failed');
    });
    }
    
    // Add additional debug support in development
    if (this.config.debug && typeof this.socket.onAny === 'function') {
      this.socket.onAny((event: string, ...args: any[]) => {
        // Skip logging ping/pong events to reduce noise
        if (!event.startsWith('ping') && !event.startsWith('pong')) {
          this.log(`Socket event: ${event}`, args);
        }
      });
    }
    
    // Add transport detection and monitoring
    // @ts-ignore - Access internal engine for diagnostics
    if (this.socket.io?.engine) {
      // Initial transport
      // @ts-ignore - Access internal engine for diagnostics  
      this.currentTransport = (this.socket.io.engine.transport?.name || 'unknown') as TransportType;
      this.log(`🔌 Initial transport: ${this.currentTransport}`);
      
      // Listen for transport upgrades (polling -> websocket)
      // @ts-ignore - Access internal engine for diagnostics
      this.socket.io.engine.on('upgrade', (transport: any) => {
        // Update the current transport
        this.currentTransport = (transport?.name || 'unknown') as TransportType;
        this.log(`🔌 Transport upgraded to: ${this.currentTransport}`);
        
        // Notify listeners of the transport change
        this.notifyStateChangeListeners();
      });
      
      // Listen for transport errors
      // @ts-ignore - Access internal engine for diagnostics
      this.socket.io.engine.on('transport_error', (err: any) => {
        this.log(`❌ Transport error: ${err?.message || 'unknown error'}`);
        
        // If there was a transport error, update the diagnostics
        this.lastError = err instanceof Error ? err : new Error(String(err));
        this.lastErrorTime = new Date();
        
        // Notify listeners of the error
        this.notifyStateChangeListeners();
      });
    }
    
    // Set up heartbeat for connection monitoring
    this.socket.on('pong', () => {
      this.lastHeartbeat = Date.now();
    });
    
    // Emit ping every 30 seconds to keep track of connection health
    setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000);
    
    // Mark handlers as initialized
    this.eventHandlersInitialized = true;
  }
  
  /**
   * Calculate reconnection delay with exponential backoff
   */
  private getReconnectionDelay(): number {
    // Calculate delay with exponential backoff
    const baseDelay = this.config.reconnectionDelay || MIN_RECONNECT_DELAY;
    const maxDelay = this.config.reconnectionDelayMax || MAX_RECONNECT_DELAY;
    
    // Use exponential backoff: baseDelay * (multiplier ^ attempts)
    let delay = baseDelay * Math.pow(RECONNECT_BACKOFF_FACTOR, this.reconnectAttempts);
    
    // Add some randomness (jitter) to prevent synchronized reconnection attempts
    delay = delay * (0.9 + Math.random() * 0.2);
    
    // Ensure delay is within bounds
    delay = Math.max(MIN_RECONNECT_DELAY, Math.min(maxDelay, delay));
    
    this.log(`Calculated reconnection delay: ${Math.round(delay)}ms (attempt #${this.reconnectAttempts})`);
    return delay;
  }
  
  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect() {
    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Check if reconnection is enabled
    if (!this.config.reconnection) {
      this.log('Reconnection disabled, not attempting to reconnect');
      return;
    }
    
    // Check if we've exceeded the maximum reconnection attempts
    const maxAttempts = this.config.reconnectionAttempts || RECONNECTION_ATTEMPTS_MAX;
    if (this.reconnectAttempts >= maxAttempts) {
      this.log(`Maximum reconnection attempts (${maxAttempts}) reached, giving up`);
      this.emit('reconnect_failed');
      this.socketConnectionState = ConnectionState.ERROR;
      return;
    }
    
    // Calculate next reconnection delay using exponential backoff
    const delay = this.getReconnectionDelay();
    
    // Increment reconnection attempts counter
    this.reconnectAttempts++;
    
    // Set state to reconnecting
    this.socketConnectionState = ConnectionState.RECONNECTING;
    this.emit('reconnecting', this.reconnectAttempts);
    
    this.log(`Scheduling reconnect attempt #${this.reconnectAttempts} in ${Math.round(delay)}ms`);
    
    // Set reconnect timer
    this.reconnectTimer = setTimeout(() => {
      this.log(`Executing reconnect attempt #${this.reconnectAttempts}`);
      this.lastReconnectTime = Date.now();
      
      // Store current attempts in case reconnect succeeds
      const currentAttempt = this.reconnectAttempts;
      
      // Try to reconnect
      this.connect()
        .then(() => {
          this.log(`Reconnect successful after ${currentAttempt} attempts`);
          this.emit('reconnect', currentAttempt);
          this.reconnectAttempts = 0; // Reset counter on success
        })
        .catch((err) => {
          this.log(`Reconnect attempt #${currentAttempt} failed: ${err.message}`);
          this.lastConnectionError = err;
          
          // Schedule next reconnect attempt
          this.handleReconnect();
        });
    }, delay);
  }
  
  /**
   * Get authentication token
   */
  private async getToken(): Promise<string | null> {
    if (!this.config.tokenProvider) {
      return null;
    }
    
    try {
      const token = this.config.tokenProvider ? await this.config.tokenProvider() : null;
      return token;
    } catch (error) {
      this.log('Error getting token:', error);
      return null;
    }
  }
  
  /**
   * Refresh authentication token
   */
  public async refreshToken(): Promise<string | null> {
    if (!this.config.tokenProvider) {
      return null;
    }
    
    // If already refreshing, return the existing promise
    if (this.isTokenRefreshing && this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }
    
    // Set flag and create promise
    this.isTokenRefreshing = true;
    this.emit('token:refresh');
    
    this.tokenRefreshPromise = (async () => {
      try {
        // Force tokenProvider to refresh if it's designed to do so
        const token = this.config.tokenProvider ? await this.config.tokenProvider() : null;
        
        // If we got a new token and have a socket, update auth
        if (token && this.socket) {
          this.socket.auth = { token: token.startsWith('Bearer ') ? token.substring(7) : token };
          
          // If socket is connected, disconnect and reconnect to use new token
          if (this.socket.connected) {
            this.log('Socket connected, disconnecting to use new token');
            this.socket.disconnect();
            this.socket.connect();
          }
        }
        
        this.log('Token refreshed successfully');
        return token;
      } catch (error) {
        this.log('Token refresh failed:', error);
        this.emit('token:refresh:error', error);
        return null;
      } finally {
        this.isTokenRefreshing = false;
      }
    })();
    
    return this.tokenRefreshPromise;
  }
  
  /**
   * Test HTTP connection
   */
  public async testHttpConnection(): Promise<boolean> {
    try {
      const response = await this.get('/');
      this.updateState(ConnectionState.CONNECTED, 'http');
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        // Got a response, so connection is working even if it's an error
        this.updateState(ConnectionState.CONNECTED, 'http');
        return true;
      }
      
      // Network error
      this.updateState(ConnectionState.DISCONNECTED, 'http');
      return false;
    }
  }
  
  /**
   * Update connection state and notify listeners
   */
  private updateState(state: ConnectionState, type: 'http' | 'socket' = 'socket'): void {
    // Update the relevant state
    if (type === 'http') {
      if (this.httpConnectionState !== state) {
        this.httpConnectionState = state;
        this.log(`HTTP connection state changed to: ${state}`);
        this.emit('state:change', { type: 'http', state });
      }
    } else {
      const prevState = this.socketConnectionState;
      
      if (prevState !== state) {
        this.socketConnectionState = state;
        this.log(`Socket connection state changed to: ${state}`);
        this.emit('state:change', { type: 'socket', state });
        
        // Track connection and disconnection timestamps
        if (state === ConnectionState.CONNECTED) {
          this.lastConnectedAt = new Date();
          
          // Determine if this was a recovery
          if (prevState === ConnectionState.RECONNECTING || 
              (this.lastDisconnectedAt && Date.now() - this.lastDisconnectedAt < 30000)) {
            this.wasRecovered = true;
          } else {
            this.wasRecovered = false;
          }
          
          // Reset throttled state on successful connection
          this.isThrottled = false;
        } else if (state === ConnectionState.DISCONNECTED) {
          this.lastDisconnectedAt = Date.now();
        }
        
        // Update throttled state
        if (state === ConnectionState.RECONNECTING) {
          const now = Date.now();
          this.isThrottled = (now - this.lastReconnectTime < MIN_RECONNECT_DELAY);
        }
        
        // Update circuit breaker state
        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.circuitBreakerTripped = true;
        } else if (state === ConnectionState.CONNECTED) {
          this.circuitBreakerTripped = false;
        }
        
        // Detect transport when connected
        if (state === ConnectionState.CONNECTED && this.socket) {
          // @ts-ignore - Accessing internal property for diagnostics
          const transport = this.socket.io?.engine?.transport?.name;
          if (transport) {
            this.currentTransport = transport as TransportType;
            this.log(`🔌 Transport type: ${this.currentTransport}`);
          }
        }
        
        // Notify all connection state change listeners
        this.notifyStateChangeListeners();
      }
    }
  }
  
  /**
   * Connect to socket server
   */
  async connect(): Promise<void> {
    // Don't attempt connection if circuit breaker is tripped
    if (this.circuitBreakerTripped && !this.circuitBreakerCooldownStartedAt) {
      this.log('⚠️ Connection attempt blocked due to tripped circuit breaker');
      return;
    }
    
    // Prevent concurrent connection attempts
    if (this.connectionInProgress) {
      this.log('Connection already in progress, skipping');
      return;
    }
    
    // Apply throttling to connection attempts to prevent flickering
    const now = Date.now();
    if (now - this.lastReconnectAttempt < MIN_RECONNECT_DELAY && this.reconnectAttempts > 0) {
      this.log(`Connection throttled, need to wait at least ${MIN_RECONNECT_DELAY}ms between attempts`);
      
      // Return a promise that resolves after the throttling period
      const remainingWait = MIN_RECONNECT_DELAY - (now - this.lastReconnectAttempt);
      await new Promise(resolve => setTimeout(resolve, remainingWait));
    }
    
    this.connectionInProgress = true;
    this.lastReconnectAttempt = now;
    
    // Check connection state first
    if (this.socketConnectionState === ConnectionState.CONNECTED) {
      this.log('Socket already connected, skipping connect');
      this.connectionInProgress = false;
      return;
    }
    
    // Update state
    this.updateState(ConnectionState.CONNECTING, 'socket');
    
    try {
      // Get token for authentication
      const token = await this.getToken();
      
      // Setup socket parameters
      await this.setupSocket(token)
        .then(() => {
          if (!this.socket) {
            throw new Error('Failed to create socket instance');
          }
          
          // Set up event handlers
          this.setupSocketEventHandlers();
          
          // Add safety check before connecting
          if (this.socket.connected) {
            this.log('⚠️ Socket already connected, skipping connect()');
            this.connectionInProgress = false;
            return;
          }
          
          this.log('🔌 Initiating socket connection...');
          this.socket.connect();
          
          // Set a timeout for connection to prevent hanging in CONNECTING state
          if (this.connectTimeoutTimer) {
            clearTimeout(this.connectTimeoutTimer);
          }
          
          this.connectTimeoutTimer = setTimeout(() => {
            if (this.socketConnectionState === ConnectionState.CONNECTING) {
              this.log('Socket connection timeout after timeout period');
              this.updateState(ConnectionState.ERROR, 'socket');
              this.consecutiveFailures++;
              
              // Force a reconnect after timing out
              this.handleReconnect();
            }
          }, CONNECT_TIMEOUT); // Use the constant timeout value
          
        }).catch(error => {
          this.log('Error setting up socket:', error);
          this.updateState(ConnectionState.ERROR, 'socket');
          this.consecutiveFailures++;
          
          // Try to reconnect after a delay
          this.handleReconnect();
        }).finally(() => {
          this.connectionInProgress = false;
        });
    } catch (error) {
      this.log('Error getting token for socket setup:', error);
      this.updateState(ConnectionState.ERROR, 'socket');
      this.consecutiveFailures++;
      
      // Try to reconnect after a delay even if token fails
      this.handleReconnect();
      this.connectionInProgress = false;
    }
  }
  
  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
    
    // Clear any reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.updateState(ConnectionState.DISCONNECTED, 'socket');
  }
  
  /**
   * Get the socket instance
   */
  public getSocket(): Socket | null {
    return this.socket;
  }
  
  /**
   * Get the socket ID if connected
   */
  public getSocketId(): string | null {
    // First check if the socket exists
    if (!this.socket) {
      return null;
    }
    
    // Then check if the socket has an ID (which means it's connected)
    if (this.socket.id) {
      return this.socket.id;
    }
    
    // Finally check connected state
    if (this.socket.connected) {
      return this.socket.id || 'connected-without-id';
    }
    
    return null;
  }
  
  /**
   * Check if socket is connected with a more robust check
   */
  public isConnected(): boolean {
    return (
      !!this.socket && 
      this.socket.connected && 
      this.socketConnectionState === ConnectionState.CONNECTED
    );
  }
  
  /**
   * Check if socket is reconnecting
   */
  public isReconnecting(): boolean {
    return this.reconnecting;
  }
  
  /**
   * Get the current socket connection state
   */
  public getConnectionState(): ConnectionState {
    return this.socketConnectionState;
  }
  
  /**
   * Get the current HTTP connection state
   */
  public getHttpConnectionState(): ConnectionState {
    return this.httpConnectionState;
  }
  
  /**
   * Get the last error that occurred
   */
  public getLastError(): { error: Error | null, time: Date | null } {
    return { 
      error: this.lastError,
      time: this.lastErrorTime
    };
  }
  
  /**
   * Get the socket health status
   */
  public getSocketHealth(): {
    socketConnected: boolean;
    connected: boolean;
    reconnecting: boolean;
    connectionState: ConnectionState;
    lastError: { error: Error | null, time: Date | null };
    reconnectAttempts?: number;
    circuitBreakerTripped?: boolean;
  } {
    return {
      socketConnected: !!this.socket,
      connected: this.isConnected(),
      reconnecting: this.reconnecting,
      connectionState: this.socketConnectionState,
      lastError: this.getLastError(),
      reconnectAttempts: this.reconnectAttempts,
      circuitBreakerTripped: this.circuitBreakerTripped
    };
  }
  
  /**
   * Get latency to the server in milliseconds
   * @returns Promise resolving to the latency in ms, or null if couldn't measure
   */
  public async getLatency(): Promise<number | null> {
    if (!this.socket || !this.isConnected()) {
      return null;
    }
    
    try {
      const start = Date.now();
      return new Promise<number | null>((resolve) => {
        // Set a timeout to handle cases where the pong isn't received
        const timeout = setTimeout(() => resolve(null), 5000);
        
        // @ts-ignore: Internal Socket.IO API
        this.socket.emit('ping', () => {
          clearTimeout(timeout);
          resolve(Date.now() - start);
        });
      });
    } catch (e) {
      console.error('Error measuring latency:', e);
      return null;
    }
  }
  
  /**
   * Get health status of the connection
   * @returns Object with health metrics
   */
  public getHealthStatus(): { 
    roundTripMs: number | null; 
    stability: 'good' | 'fair' | 'poor' | 'lost';
    transport: string;
    healthScore?: number;
  } {
    // Default implementation - can be overridden by ConnectionManagerFactory
    return {
      roundTripMs: null,
      stability: this.isConnected() ? 'good' : 'lost',
      transport: this.socket?.io?.engine?.transport?.name || 'unknown'
    };
  }
  
  /**
   * Emit an event on the socket
   */
  public emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }
  
  /**
   * Listen for an event
   */
  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
  
  /**
   * Listen for an event once
   */
  public once(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }
  
  /**
   * Remove event listener
   */
  public off(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }
  
  /**
   * Listen for all events (passes through to socket.onAny if available)
   */
  public onAny(listener: (event: string, ...args: any[]) => void): this {
    // Check if we have an active socket with onAny method
    if (this.socket && typeof this.socket.onAny === 'function') {
      // Pass through to socket.onAny
      this.socket.onAny(listener);
    } else {
      this.log('Warning: Socket.onAny not available, using alternative implementation');
      
      // If socket doesn't have onAny, we can simulate it by attaching to known events
      // This isn't as good as true Socket.IO onAny, but it helps for debugging
      const commonEvents = [
        'connect', 'disconnect', 'error', 'connect_error',
        'reconnect', 'reconnect_attempt', 'reconnect_error', 'reconnect_failed'
      ];
      
      // Listen for each common event
      commonEvents.forEach(event => {
        this.on(event, (...args) => {
          listener(event, ...args);
        });
      });
    }
    
    return this;
  }
  
  /**
   * Log a message with service name
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.log(`[${this.serviceName}]`, message, ...args);
    }
  }
  
  /**
   * Force a reconnection attempt, even if we're in connecting state
   */
  public forceReconnect(): void {
    this.log('Forcing socket reconnection');
    
    // Disconnect existing socket if connected
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Clear any reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Clear connect timeout
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    
    // Set state to disconnected
    this.updateState(ConnectionState.DISCONNECTED, 'socket');
    
    // Immediately try to reconnect
    this.setupSocket();
  }

  // Add new methods for centralized socket diagnostics
  private notifyStateChangeListeners(): void {
    const diagnostics = this.getDiagnostics();
    
    // Notify all listeners
    if (this.stateChangeListeners.length > 0) {
      this.log(`🔔 Notifying ${this.stateChangeListeners.length} state change listeners`);
      
      this.stateChangeListeners.forEach(listener => {
        try {
          listener(diagnostics);
        } catch (error) {
          this.log('❌ Error in connection state change listener:', error);
        }
      });
    }
  }

  /**
   * Get comprehensive diagnostics about the connection
   */
  public getDiagnostics(): ConnectionDiagnostics {
    // Map internal state to diagnostic state
    let connectionState: DiagnosticConnectionState;
    
    switch (this.socketConnectionState) {
      case ConnectionState.CONNECTED:
        connectionState = DiagnosticConnectionState.CONNECTED;
        break;
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        connectionState = DiagnosticConnectionState.CONNECTING;
        break;
      case ConnectionState.DISCONNECTED:
        connectionState = DiagnosticConnectionState.DISCONNECTED;
        break;
      case ConnectionState.ERROR:
        connectionState = this.fatalSocketState
          ? DiagnosticConnectionState.FATAL 
          : DiagnosticConnectionState.DISCONNECTED;
        break;
      default:
        connectionState = DiagnosticConnectionState.DISCONNECTED;
    }
    
    // Calculate cooldown remaining
    const cooldownRemaining = this.getCircuitBreakerCooldownRemaining();
    
    // Format retry history
    const retryHistory = this.reconnectAttemptHistory.map(timestamp => 
      new Date(timestamp).toISOString()
    );
    
    // Get adapter info if available
    const adapterInfo = this.getAdapterInfo();
    
    if (this.config.debug) {
      console.debug('[ConnectionManager] 🔍 Diagnostics:', {
        connectionState,
        socketId: this.getSocketId(),
        retryCount: this.reconnectAttempts,
        lastConnectedAt: this.lastConnectedAt ? this.lastConnectedAt.getTime() : null,
        lastDisconnectedAt: this.lastDisconnectedAt,
        wasRecovered: this.wasRecovered,
        transport: this.currentTransport,
        isThrottled: this.isThrottled,
        circuitBreakerTripped: this.circuitBreakerTripped,
        fatalSocketState: this.fatalSocketState,
        retryHistory,
        retryCooldownRemaining: cooldownRemaining ? Math.ceil(cooldownRemaining / 1000) : undefined,
        socketAdapter: adapterInfo.adapterType,
        redisConnected: adapterInfo.redisConnected
      });
    }
    
    return {
      connectionState,
      socketId: this.getSocketId(),
      retryCount: this.reconnectAttempts,
      lastConnectedAt: this.lastConnectedAt ? this.lastConnectedAt.getTime() : null,
      lastDisconnectedAt: this.lastDisconnectedAt,
      wasRecovered: this.wasRecovered,
      transport: this.currentTransport,
      isThrottled: this.isThrottled,
      circuitBreakerTripped: this.circuitBreakerTripped,
      fatalSocketState: this.fatalSocketState,
      retryHistory,
      retryCooldownRemaining: cooldownRemaining ? Math.ceil(cooldownRemaining / 1000) : undefined,
      socketAdapter: adapterInfo.adapterType,
      redisConnected: adapterInfo.redisConnected
    };
  }
  
  /**
   * Get information about the socket adapter
   * @private
   */
  private getAdapterInfo(): { adapterType: SocketAdapterType; redisConnected: boolean | undefined } {
    if (!this.socket) {
      return { adapterType: 'unknown', redisConnected: undefined };
    }
    
    try {
      // @ts-ignore - Access adapter for diagnostics
      const adapter = this.socket.nsp?.adapter;
      
      if (!adapter) {
        return { adapterType: 'unknown', redisConnected: undefined };
      }
      
      // Check if we're using Redis adapter
      if (adapter.constructor?.name?.includes('Redis')) {
        // @ts-ignore - Access Redis adapter properties
        const redisConnected = !!adapter.pubClient?.connected;
        return { adapterType: 'redis', redisConnected };
      }
      
      // Otherwise assume in-memory adapter
      return { adapterType: 'memory', redisConnected: undefined };
    } catch (error) {
      this.log('Error getting adapter info:', error);
      return { adapterType: 'unknown', redisConnected: undefined };
    }
  }
  
  /**
   * Subscribe to connection state changes
   * @param callback Function to call when state changes
   * @returns Unsubscribe function
   */
  public onConnectionStateChange(callback: ConnectionStateChangeListener): () => void {
    // Check if we already have too many listeners (possible memory leak)
    if (this.stateChangeListeners.length >= MAX_LISTENERS) {
      this.log(`⚠️ Warning: Adding too many connection state listeners (${this.stateChangeListeners.length}). Possible memory leak.`);
    }
    
    // Add the listener
    this.stateChangeListeners.push(callback);
    
    // Call immediately with current state
    try {
      callback(this.getDiagnostics());
    } catch (error) {
      this.log('❌ Error in connection state change listener (initial call):', error);
    }
    
    // Return unsubscribe function
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(listener => listener !== callback);
      this.log(`🧹 Removed connection state listener (${this.stateChangeListeners.length} remaining)`);
    };
  }
  
  /**
   * Add an entry to the connection history log
   */
  private addConnectionHistoryEntry(event: string, message: string): void {
    const entry: ConnectionHistoryEntry = {
      event: message,
      timestamp: Date.now()
    };
    
    this.connectionHistory.unshift(entry);
    
    // Keep only the most recent entries
    if (this.connectionHistory.length > this.maxHistoryEntries) {
      this.connectionHistory = this.connectionHistory.slice(0, this.maxHistoryEntries);
    }
    
    // Also add to the logs
    this.addLogEntry(event, message, event.includes('error') ? 'error' : 'info');
  }
  
  /**
   * Add a log entry to the connection logs
   */
  public addLogEntry(event: string, message: string, level: 'info' | 'warn' | 'error' = 'info', data?: any): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      event: message,
      level,
      data
    };
    
    this.connectionLogs.unshift(entry);
    
    // Keep only the most recent log entries
    if (this.connectionLogs.length > this.maxLogEntries) {
      this.connectionLogs = this.connectionLogs.slice(0, this.maxLogEntries);
    }
  }

  /**
   * Tracks reconnection attempt and checks if circuit breaker should be tripped
   */
  private trackReconnectionAttempt(): void {
    const now = Date.now();
    
    // Add current timestamp to history
    this.reconnectAttemptHistory.push(now);
    
    // Add log entry
    this.log(`🔄 Reconnection attempt tracked at ${new Date(now).toISOString()}`);
    
    // Clean up old attempts outside the window
    this.reconnectAttemptHistory = this.reconnectAttemptHistory.filter(
      timestamp => now - timestamp < CIRCUIT_BREAKER_WINDOW_MS
    );
    
    // If too many attempts within window, trip the circuit breaker
    if (this.reconnectAttemptHistory.length >= CIRCUIT_BREAKER_THRESHOLD && !this.circuitBreakerTripped) {
      this.log('🚫 Circuit breaker threshold reached, tripping circuit breaker');
      this.tripCircuitBreaker();
    }
  }

  /**
   * Trips the circuit breaker and starts the cooldown timer
   */
  private tripCircuitBreaker(): void {
    if (this.circuitBreakerTripped) return; // Already tripped
    
    this.log('🚫 Circuit breaker tripped. Disabling reconnection for 5 minutes.');
    
    // Set circuit breaker state
    this.circuitBreakerTripped = true;
    this.fatalSocketState = true;
    
    // Disable socket.io auto-reconnect
    if (this.socket && this.socket.io) {
      this.socket.io.reconnection(false);
      this.log('Socket.io auto-reconnection disabled due to circuit breaker');
    }
    
    // Start cooldown timer
    this.startCircuitBreakerCooldown();
    
    // Emit fatal state change
    this.updateState(ConnectionState.ERROR, 'socket');
    this.emit('connection:fatal', {
      message: 'Too many connection attempts. Circuit breaker tripped.',
      cooldownTimeMs: CIRCUIT_BREAKER_COOLDOWN_MS
    });
  }

  /**
   * Starts the circuit breaker cooldown timer
   */
  private startCircuitBreakerCooldown(): void {
    // Clear existing timer if any
    if (this.circuitBreakerCooldownTimer) {
      clearTimeout(this.circuitBreakerCooldownTimer);
    }
    
    // Record cooldown start time
    this.circuitBreakerCooldownStartedAt = Date.now();
    
    // Start new cooldown timer
    this.circuitBreakerCooldownTimer = setTimeout(() => {
      this.log('🔁 Circuit breaker cooldown completed. Allowing one retry attempt.');
      this.resetCircuitBreaker();
    }, CIRCUIT_BREAKER_COOLDOWN_MS);
  }

  /**
   * Resets the circuit breaker after cooldown
   */
  public resetCircuitBreaker(): void {
    this.log('✅ Resetting circuit breaker');
    
    // Reset circuit breaker state
    this.circuitBreakerTripped = false;
    this.fatalSocketState = false;
    
    // Clear cooldown timer
    if (this.circuitBreakerCooldownTimer) {
      clearTimeout(this.circuitBreakerCooldownTimer);
      this.circuitBreakerCooldownTimer = null;
    }
    
    this.circuitBreakerCooldownStartedAt = null;
    
    // Clear reconnect attempt history
    this.reconnectAttemptHistory = [];
    
    // Re-enable socket.io auto-reconnect
    if (this.socket && this.socket.io) {
      this.socket.io.reconnection(true);
      this.log('Socket.io auto-reconnection re-enabled after circuit breaker reset');
    }
    
    // Emit event
    this.emit('circuit_breaker:reset');
    
    // Attempt one reconnection
    this.log('Attempting one reconnection after circuit breaker reset');
    this.connect();
  }

  /**
   * Get the remaining cooldown time in milliseconds
   */
  private getCircuitBreakerCooldownRemaining(): number | null {
    if (!this.circuitBreakerCooldownStartedAt) return null;
    
    const elapsed = Date.now() - this.circuitBreakerCooldownStartedAt;
    const remaining = Math.max(0, CIRCUIT_BREAKER_COOLDOWN_MS - elapsed);
    
    return remaining > 0 ? remaining : null;
  }
} 