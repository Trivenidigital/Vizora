import { io, Socket } from 'socket.io-client';

// Types for connection status and pairing
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
export type MessageCallback = (message: any) => void;
export type StatusCallback = (status: ConnectionStatus) => void;

// Create a service object for WebSocket connections
class WebSocketService {
  private socket: Socket | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private messageListeners: MessageCallback[] = [];
  private statusListeners: StatusCallback[] = [];
  
  // URL discovery
  private discoveredUrl: string | null = null;
  private readonly WS_PATH = '/socket.io';

  constructor() {
    // Initialize with environment variables
    const envUrls = import.meta.env.VITE_WEBSOCKET_URLS;
    if (envUrls) {
      // Use the first URL in the comma-separated list
      this.discoveredUrl = envUrls.split(',')[0];
    } else if (import.meta.env.VITE_MIDDLEWARE_PORT) {
      // Construct URL from current hostname and port from env var
      const host = window.location.hostname;
      const port = import.meta.env.VITE_MIDDLEWARE_PORT;
      this.discoveredUrl = `http://${host}:${port}`;
    }
    
    // Log the initial configuration
    console.log('WebSocketService: Initial configuration', {
      discoveredUrl: this.discoveredUrl,
      wsPath: this.WS_PATH
    });
  }
  
  // Discover middleware URL
  private async discoverMiddlewareUrl(): Promise<string> {
    // If we already have a discovered URL, use it
    if (this.discoveredUrl) {
      try {
        // Verify the URL is reachable
        await this.checkUrlAvailability(this.discoveredUrl);
        return this.discoveredUrl;
      } catch (error) {
        console.warn(`Primary URL ${this.discoveredUrl} is not available, trying alternatives...`);
      }
    }
    
    // Try to discover from environment variables
    const envUrlsString = import.meta.env.VITE_WEBSOCKET_URLS;
    if (envUrlsString) {
      const envUrls = envUrlsString.split(',');
      
      // Try each URL in the list
      for (const url of envUrls) {
        try {
          await this.checkUrlAvailability(url.trim());
          this.discoveredUrl = url.trim();
          return this.discoveredUrl;
        } catch (error) {
          console.warn(`URL ${url} is not available`);
        }
      }
    }
    
    // Try to construct URL from MIDDLEWARE_PORT
    if (import.meta.env.VITE_MIDDLEWARE_PORT) {
      const host = window.location.hostname;
      const port = import.meta.env.VITE_MIDDLEWARE_PORT;
      const constructedUrl = `http://${host}:${port}`;
      
      try {
        await this.checkUrlAvailability(constructedUrl);
        this.discoveredUrl = constructedUrl;
        return this.discoveredUrl;
      } catch (error) {
        console.warn(`Constructed URL ${constructedUrl} is not available`);
      }
    }
    
    // Try fallback port if provided
    if (import.meta.env.VITE_FALLBACK_MIDDLEWARE_PORT) {
      const host = window.location.hostname;
      const port = import.meta.env.VITE_FALLBACK_MIDDLEWARE_PORT;
      const fallbackUrl = `http://${host}:${port}`;
      
      try {
        await this.checkUrlAvailability(fallbackUrl);
        this.discoveredUrl = fallbackUrl;
        return this.discoveredUrl;
      } catch (error) {
        console.warn(`Fallback URL ${fallbackUrl} is not available`);
      }
    }
    
    // Default to localhost with default port as last resort
    const defaultUrl = 'http://localhost:3003';
    console.warn(`No available URLs found, defaulting to ${defaultUrl}`);
    this.discoveredUrl = defaultUrl;
    return defaultUrl;
  }
  
  // Check if a URL is available
  private async checkUrlAvailability(url: string): Promise<string> {
    try {
      // Check if we can reach the health endpoint
      const response = await fetch(`${url}/health`, { 
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        timeout: 2000,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        return url;
      }
      throw new Error(`Health check failed for ${url}`);
    } catch (error) {
      console.warn(`Failed to connect to ${url}:`, error);
      throw error;
    }
  }
  
  // Connect to the WebSocket server
  async connect(userId?: string): Promise<Socket> {
    // Disconnect existing connection if any
    if (this.socket && this.socket.connected) {
      console.log('Already connected, disconnecting first');
      this.socket.disconnect();
    }
    
    // Discover middleware URL first
    const serverUrl = await this.discoverMiddlewareUrl();
    console.log(`Connecting to ${serverUrl} with path ${this.WS_PATH}`);
    
    this.connectionStatus = 'connecting';
    this.notifyStatusListeners();
    
    return new Promise<Socket>((resolve, reject) => {
      try {
        this.socket = io(serverUrl, {
          path: this.WS_PATH,
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          query: userId ? { userId } : undefined
        });
        
        // Set up connection event handlers
        this.socket.on('connect', () => {
          console.log('Connected to websocket server');
          this.connectionStatus = 'connected';
          this.notifyStatusListeners();
          resolve(this.socket!);
        });
        
        this.socket.on('disconnect', (reason) => {
          console.log(`Disconnected from websocket server: ${reason}`);
          this.connectionStatus = 'disconnected';
          this.notifyStatusListeners();
        });
        
        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
          this.connectionStatus = 'error';
          this.notifyStatusListeners();
          reject(error);
        });
        
        this.socket.on('reconnect_attempt', (attemptNumber) => {
          console.log(`Reconnection attempt: ${attemptNumber}`);
          this.connectionStatus = 'connecting';
          this.notifyStatusListeners();
        });
        
        // Handle incoming messages
        this.socket.on('message', (message: any) => {
          console.log('Received message:', message);
          this.notifyMessageListeners(message);
        });
      } catch (error) {
        console.error('Error connecting to websocket:', error);
        this.connectionStatus = 'error';
        this.notifyStatusListeners();
        reject(error);
      }
    });
  }

  // Disconnect from the server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionStatus = 'disconnected';
      this.notifyStatusListeners();
    }
  }
  
  // Send a message to the server
  send(event: string, data: any): boolean {
    if (!this.socket || !this.socket.connected) {
      console.warn(`Cannot emit event ${event}: socket not connected`);
      return false;
    }
    
    this.socket.emit(event, data);
    return true;
  }
  
  // Get the current connection status
  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }
  
  // Add a message listener
  onMessage(callback: MessageCallback): void {
    this.messageListeners.push(callback);
  }
  
  // Remove a message listener
  offMessage(callback: MessageCallback): void {
    this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
  }
  
  // Add a status listener
  onStatusChange(callback: StatusCallback): void {
    this.statusListeners.push(callback);
    // Immediately notify with current status
    callback(this.connectionStatus);
  }
  
  // Remove a status listener
  offStatusChange(callback: StatusCallback): void {
    this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
  }
  
  // Get the middleware base URL (for REST API calls)
  async getMiddlewareBaseUrl(): Promise<string> {
    // Discover the URL if not already discovered
    if (!this.discoveredUrl) {
      await this.discoverMiddlewareUrl();
    }
    return this.discoveredUrl!;
  }
  
  // Notify all message listeners
  private notifyMessageListeners(message: any): void {
    this.messageListeners.forEach(callback => callback(message));
  }
  
  // Notify all status listeners
  private notifyStatusListeners(): void {
    this.statusListeners.forEach(callback => callback(this.connectionStatus));
  }
  
  // Pair with a display
  async pairWithDisplay(pairingCode: string, displayName: string): Promise<any> {
    if (!this.socket || !this.socket.connected) {
      await this.connect();
    }
    
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      // Set up a one-time event handler for the pairing response
      this.socket.once('pairingResult', (result) => {
        console.log('Pairing result received:', result);
        resolve(result);
      });
      
      // Send the pairing request
      this.socket.emit('pairDisplay', { pairingCode, displayName });
      
      // Set a timeout in case the server doesn't respond
      setTimeout(() => {
        reject(new Error('Pairing request timed out'));
      }, 10000);
    });
  }
}

// Create and export a singleton instance
export const websocketService = new WebSocketService(); 