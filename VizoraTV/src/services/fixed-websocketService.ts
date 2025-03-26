import { io, Socket } from 'socket.io-client';
import { ConnectionStatus } from '../types';

// Create a browser-compatible EventEmitter class
class BrowserEventEmitter {
  protected events: Record<string, Function[]> = {};

  on(event: string, listener: Function): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  off(event: string, listener?: Function): this {
    if (!this.events[event]) return this;

    if (listener) {
      // Remove specific listener
      this.events[event] = this.events[event].filter(l => l !== listener);
    } else {
      // Remove all listeners for this event
      delete this.events[event];
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) return false;

    this.events[event].forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
    return true;
  }

  // Using direct implementation instead of calling this.off to avoid recursive calls
  removeListener(event: string, listener: Function): this {
    if (!this.events[event]) return this;
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  // Using direct implementation instead of calling this.off to avoid recursive calls
  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }
}

export class WebSocketService extends BrowserEventEmitter {
  socket: Socket | null = null;
  connectionStatus: ConnectionStatus = 'disconnected';
  private messageListeners: Array<(message: any) => void> = [];
  private statusListeners: Array<(status: ConnectionStatus) => void> = [];
  private reconnectTimeout: number | null = null;
  private registerAttempts: number = 0;
  private maxRegisterAttempts: number = 5;
  
  // Event handler properties that App.tsx is looking for
  public onConnected: (() => void) | null = null;
  public onDisconnected: (() => void) | null = null;
  public onError: ((error: any) => void) | null = null;
  public onRegistered: ((data: any) => void) | null = null;
  public onContentUpdated: ((content: any) => void) | null = null;
  
  // Server URL for components that need it
  public discoveredUrl: string | null = null;
  
  // Server URL accessor for components that need it
  public get serverUrl(): string {
    return this.discoveredUrl || 'not connected';
  }

  constructor() {
    super();
    // Default to middleware URL
    this.discoveredUrl = 'http://localhost:3003';
  }

  // Get the socket instance
  getSocket(): Socket | null {
    return this.socket;
  }
  
  // Get current connection status
  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }
  
  // Set connection status and notify listeners
  setStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.notifyStatusListeners(status);
  }
  
  // Notify status listeners with current status
  notifyStatusListeners(status: ConnectionStatus): void {
    this.emit('connectionStatus', status);
  }
  
  // Register a display to get a pairing code
  async registerDisplay(deviceId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log('WebSocketService: Registering display with deviceId:', deviceId);
      
      if (!this.socket || !this.socket.connected) {
        console.error('WebSocketService: Cannot register display - socket not connected');
        reject(new Error('Socket not connected'));
        return;
      }
      
      let hasReceivedResponse = false;
      
      try {
        console.log('WebSocketService: Emitting register_display event with deviceId:', deviceId);
        
        this.socket.emit('register_display', { deviceId }, (response: any) => {
          hasReceivedResponse = true;
          
          if (!response) {
            console.error('WebSocketService: Empty response from register_display');
            reject(new Error('Empty response from server'));
            return;
          }
          
          console.log('WebSocketService: Registration response:', response);
          
          // Process response data
          let responseData = response;
          
          // Sometimes the response might be wrapped in a data property
          if (response.data && typeof response.data === 'object') {
            responseData = response.data;
          }
          
          // Extract display ID and pairing code from the response
          const displayId = responseData.displayId || responseData.id || deviceId;
          const pairingCode = responseData.pairingCode || responseData.code;
          
          // Create a response object with available data
          const result = {
            displayId,
            pairingCode,
            originalResponse: response
          };
          
          // Emit the registration success event
          this.emit('message', {
            type: 'display_registered',
            data: result
          });
          
          resolve(result);
        });
        
        // Set a timeout for the response
        setTimeout(() => {
          if (!hasReceivedResponse) {
            console.error('WebSocketService: Registration response timeout');
            
            // Create a synthetic response with the device ID
            const syntheticResponse = {
              displayId: deviceId,
              pairingCode: null,
              error: 'Response timeout'
            };
            
            // Emit a synthetic event for the app to handle
            this.emit('message', {
              type: 'display_registered',
              data: syntheticResponse
            });
            
            reject(new Error('Registration response timeout'));
          }
        }, 15000);
        
      } catch (error) {
        console.error('WebSocketService: Error during registration:', error);
        
        // Create a synthetic response with the device ID
        const syntheticResponse = {
          displayId: deviceId,
          pairingCode: null,
          error: error.message || 'Unknown error'
        };
        
        // Emit a synthetic event for the app to handle
        this.emit('message', {
          type: 'display_registered',
          data: syntheticResponse
        });
        
        reject(error);
      }
    });
  }
  
  // Set up message handlers for the socket
  setupMessageHandlers(): void {
    if (!this.socket) {
      console.error('WebSocketService: Cannot setup message handlers - socket not initialized');
      return;
    }
    
    try {
      // Handle display registration response with error handling
      this.socket.on('display_registered', (data: any) => {
        try {
          console.log('WebSocketService: Received display_registered event:', data);
          
          // Validate data before emitting
          if (data !== null && data !== undefined) {
            this.emit('message', { type: 'display_registered', data });
          } else {
            console.warn('WebSocketService: Received empty display_registered data');
            // Create minimal data object to avoid downstream errors
            this.emit('message', { 
              type: 'display_registered', 
              data: { 
                displayId: this.socket?.handshake?.query?.deviceId || null,
                error: 'Empty data received from server'
              }
            });
          }
        } catch (error) {
          console.error('WebSocketService: Error handling display_registered:', error);
        }
      });
      
      // Handle other event types safely
      const eventHandlers: Record<string, (data: any) => void> = {
        'display_paired': (data) => {
          console.log('WebSocketService: Received display_paired event:', data);
          this.emit('message', { type: 'display_paired', data });
        },
        'paired': (data) => {
          console.log('WebSocketService: Received paired event:', data);
          this.emit('message', { type: 'paired', data });
        },
        'content_updated': (data) => {
          console.log('WebSocketService: Received content_updated event:', data);
          this.emit('message', { type: 'content_updated', data });
        },
        'message': (data) => {
          console.log('WebSocketService: Received generic message:', data);
          
          // Handle message based on its type
          if (data && data.type) {
            this.emit('message', data);
          } else {
            // If no type, wrap it in a generic message
            this.emit('message', { type: 'generic_message', data });
          }
        }
      };
      
      // Additional pairing-related event types
      ['pair_success', 'pairing_successful'].forEach(eventName => {
        eventHandlers[eventName] = (data) => {
          console.log(`WebSocketService: Received ${eventName} event:`, data);
          this.emit('message', { type: eventName, data });
        };
      });
      
      // Register all event handlers with error handling
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        this.socket?.on(event, (data) => {
          try {
            handler(data);
          } catch (error) {
            console.error(`WebSocketService: Error handling ${event}:`, error);
          }
        });
      });
      
      console.log('WebSocketService: Message handlers setup complete');
    } catch (error) {
      console.error('WebSocketService: Error setting up message handlers:', error);
    }
  }
  
  // Method App.tsx is looking for
  async connectToServer(deviceId?: string) {
    console.log(`Connecting to server with deviceId: ${deviceId || 'none'}`);
    return this.connect(deviceId);
  }
  
  // Reconnect method with backoff
  reconnect() {
    console.log('Reconnecting to WebSocket server...');
    this.disconnect();
    
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Set a short timeout before reconnecting to allow cleanup
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
      this.reconnectTimeout = null;
    }, 1000);
    
    return new Promise<Socket>((resolve, reject) => {
      // Wait for reconnection to complete
      const checkConnection = () => {
        if (this.socket && this.socket.connected) {
          resolve(this.socket);
        } else if (this.connectionStatus === 'error') {
          reject(new Error('Reconnection failed'));
        } else {
          setTimeout(checkConnection, 500);
        }
      };
      
      setTimeout(checkConnection, 1500);
    });
  }
  
  // Connect to the socket
  connect(deviceId?: string) {
    // If already connected, return the socket
    if (this.socket && this.socket.connected) {
      console.log('Socket already connected');
      return Promise.resolve(this.socket);
    }
    
    // Disconnect if socket exists but not connected
    if (this.socket) {
      console.log('Socket exists but not connected, cleaning up...');
      this.disconnect();
    }

    // Ensure we have a discovered URL
    if (!this.discoveredUrl) {
      // Set a default URL
      this.discoveredUrl = 'http://localhost:3003';
    }

    console.log(`Connecting to ${this.discoveredUrl}`);
    this.connectionStatus = 'connecting';
    this.notifyStatusListeners(this.connectionStatus);
    
    return new Promise<Socket>((resolve, reject) => {
      try {
        console.log(`Creating socket to ${this.discoveredUrl} with deviceId: ${deviceId || 'none'}`);
        // Create new socket connection with better options
        this.socket = io(this.discoveredUrl!, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000, 
          autoConnect: true,
          forceNew: true,
          query: deviceId ? {
            deviceId,
            deviceType: 'tv',
            timestamp: Date.now() 
          } : undefined
        });

        // Set up connection event handlers
        this.socket.on('connect', () => {
          console.log('Connected to websocket server', this.socket?.id);
          this.connectionStatus = 'connected';
          this.notifyStatusListeners(this.connectionStatus);
          
          // Reset registration attempts on new connection
          this.registerAttempts = 0;
          
          // Call the event handler if defined
          if (this.onConnected && typeof this.onConnected === 'function') {
            this.onConnected();
          }
          
          // If deviceId was provided, auto-register with delay to ensure the socket is ready
          if (deviceId) {
            console.log('Auto-registering with deviceId:', deviceId);
            setTimeout(() => {
              this.registerDisplay(deviceId).catch(err => {
                console.error('Auto-registration failed:', err);
              });
            }, 1000);
          }
          
          resolve(this.socket!);
        });

        this.socket.on('disconnect', (reason) => {
          console.log(`Disconnected from websocket server: ${reason}`);
          this.connectionStatus = 'disconnected';
          this.notifyStatusListeners(this.connectionStatus);
          
          // Call the event handler if defined
          if (this.onDisconnected && typeof this.onDisconnected === 'function') {
            this.onDisconnected();
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          this.connectionStatus = 'error';
          this.notifyStatusListeners(this.connectionStatus);
          
          // Call the event handler if defined
          if (this.onError && typeof this.onError === 'function') {
            this.onError(error);
          }
        });

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
          this.connectionStatus = 'error';
          this.notifyStatusListeners(this.connectionStatus);
          
          // Call the event handler if defined
          if (this.onError && typeof this.onError === 'function') {
            this.onError(error);
          }
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
          console.log(`Reconnection attempt: ${attemptNumber}`);
          this.connectionStatus = 'connecting';
          this.notifyStatusListeners(this.connectionStatus);
        });
        
        // Handle socket errors more gracefully
        this.socket.io.on('error', (error: any) => {
          console.error('Socket.io error:', error);
        });

        // Set up message handlers with better error handling
        this.setupMessageHandlers();
        
        // Set a connection timeout
        setTimeout(() => {
          if (this.socket && !this.socket.connected) {
            console.error('Connection timeout - force reconnecting');
            this.connectionStatus = 'connecting';
            this.notifyStatusListeners(this.connectionStatus);
            
            if (this.socket) {
              // Force a new connection attempt
              this.socket.connect();
            }
          }
        }, 10000);
        
      } catch (error) {
        console.error('Error connecting to websocket:', error);
        this.connectionStatus = 'error';
        this.notifyStatusListeners(this.connectionStatus);
        reject(error);
      }
    });
  }
  
  // Disconnect the socket
  disconnect(): void {
    console.log('WebSocketService: Disconnecting socket');
    
    try {
      if (this.socket) {
        // Clean up socket event listeners without causing recursive calls
        try {
          // Save reference to avoid potential null issues
          const currentSocket = this.socket;
          
          // Only remove socket-specific listeners, not our EventEmitter listeners
          // This avoids potential recursive calls to our own off/removeListener methods
          currentSocket.off();
          
          // Disconnect the socket
          currentSocket.disconnect();
        } catch (listenerError) {
          console.error('Error removing socket listeners:', listenerError);
        }
        
        // Reset the socket
        this.socket = null;
      }
      
      // Update the connection status
      this.connectionStatus = 'disconnected';
      
      // Notify status listeners directly to avoid recursion
      if (this.events['connectionStatus']) {
        this.events['connectionStatus'].forEach(listener => {
          try {
            listener(this.connectionStatus);
          } catch (err) {
            console.error('Error in status listener:', err);
          }
        });
      }
      
      console.log('WebSocketService: Socket disconnected successfully');
    } catch (error) {
      console.error('WebSocketService: Error during socket disconnect:', error);
    }
  }

  // Emit an event
  emitEvent(event: string, data: any) {
    if (!this.socket) {
      console.warn(`Cannot emit event ${event}: socket is null`);
      return false;
    }
    
    if (!this.socket.connected) {
      console.warn(`Cannot emit event ${event}: socket not connected`);
      return false;
    }
    
    try {
      this.socket.emit(event, data);
      return true;
    } catch (error) {
      console.error(`Error emitting event ${event}:`, error);
      return false;
    }
  }

  // Method App.tsx is looking for
  subscribeToMessage(callback: (message: any) => void) {
    if (typeof callback !== 'function') {
      console.warn('Invalid callback provided to subscribeToMessage:', callback);
      return () => {}; // Return empty function to avoid errors
    }
    
    this.onMessage(callback);
    return () => this.offMessage(callback);
  }

  // Add a message listener
  onMessage(callback: (message: any) => void) {
    if (typeof callback !== 'function') {
      console.warn('Invalid callback provided to onMessage:', callback);
      return;
    }
    this.messageListeners.push(callback);
  }

  // Remove a message listener
  offMessage(callback: (message: any) => void) {
    this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
  }

  // Add a status listener
  onStatusChange(callback: (status: ConnectionStatus) => void) {
    if (typeof callback !== 'function') {
      console.warn('Invalid callback provided to onStatusChange:', callback);
      return;
    }
    this.statusListeners.push(callback);
    // Immediately notify with current status
    callback(this.connectionStatus);
  }

  // Remove a status listener
  offStatusChange(callback: (status: ConnectionStatus) => void) {
    this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
  }

  // Notify all message listeners
  private notifyMessageListeners(message: any) {
    this.messageListeners.forEach(callback => {
      if (typeof callback === 'function') {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in message listener callback:', error);
        }
      } else {
        console.warn(`Invalid message listener: callback is not a function ${message.type}`, callback);
      }
    });
  }

  // Debug method to simulate pairing (might be needed later)
  debugSimulatePairing(displayId: string) {
    console.log(`[DEBUG] Simulating pairing for display ${displayId}`);
    this.emitEvent('debug-simulate-pairing', { displayId });
  }
}

// Create and export a singleton instance
export const websocketService = new WebSocketService();

// Initialize the socket with better error handling 
export function initializeSocket(deviceId: string) {
  console.log(`Initializing socket with device ID: ${deviceId}`);
  
  // Ensure deviceId is valid - if not, generate a fallback
  if (!deviceId || deviceId === 'undefined' || deviceId === 'null') {
    const timestamp = Date.now().toString();
    const randomStr = Math.random().toString(36).substring(2, 8);
    deviceId = `tv-${timestamp}-${randomStr}`;
    console.log(`Generated fallback device ID: ${deviceId}`);
    localStorage.setItem('vizora-device-id', deviceId);
  }
  
  try {
    if (websocketService.socket) {
      // If socket exists but is disconnected, attempt to reconnect
      if (!websocketService.socket.connected) {
        console.log('Socket exists but disconnected. Reconnecting...');
        
        // Clean up existing socket first
        try {
          if (websocketService.socket) {
            websocketService.socket.removeAllListeners();
            websocketService.socket.disconnect();
          }
        } catch (err) {
          console.error('Error cleaning up existing socket:', err);
        }
        
        // Create a fresh socket
        websocketService.socket = null;
      } else {
        console.log('Socket already initialized and connected');
        return websocketService.socket;
      }
    }
    
    // Set server URL fixed to port 3003
    websocketService.discoveredUrl = 'http://localhost:3003'; 
    
    console.log(`Creating new socket connection with ID: ${deviceId} to ${websocketService.discoveredUrl}`);
    
    // Connect to socket
    return websocketService.connect(deviceId);
  } catch (error) {
    console.error('Error initializing WebSocket:', error);
    websocketService.connectionStatus = 'error';
    websocketService.notifyStatusListeners(websocketService.connectionStatus);
    return null;
  }
} 