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
  private lastPairingCode: string | null = null;
  
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
    
    // Try to load the last pairing code from localStorage
    try {
      this.lastPairingCode = localStorage.getItem('vizora-last-pairing-code');
    } catch (e) {
      console.warn('Could not load last pairing code from localStorage:', e);
    }
  }

  // Get the last received pairing code
  getLastPairingCode(): string | null {
    return this.lastPairingCode;
  }

  // Set the last received pairing code
  setLastPairingCode(code: string | null): void {
    this.lastPairingCode = code;
    if (code) {
      try {
        localStorage.setItem('vizora-last-pairing-code', code);
      } catch (e) {
        console.warn('Could not save pairing code to localStorage:', e);
      }
    }
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
  public async registerDisplay(displayId: string): Promise<any> {
    try {
      console.log(`WebSocketService: Registering display with deviceId: ${displayId}`);
      this.setStatus('connecting');
      
      if (!this.socket) {
        console.error('WebSocketService: Socket is null, cannot register');
        return Promise.reject(new Error('Socket not initialized'));
      }
      
      // Clean up any existing listeners to avoid duplicate handlers
      this.socket.off('display_registered');
      
      let hasReceivedResponse = false;
      
      // We're using a Promise to make this function awaitable 
      return new Promise((resolve, reject) => {
        if (!this.socket) {
          return reject(new Error('Socket not initialized'));
        }
        
        // First attempt at registration
        console.log(`WebSocketService: Registration attempt 1/2`);
        
        try {
          this.socket.emit('register_display', { displayId }, (response: any) => {
            console.log('WebSocketService: Received direct display_registered event:', response);
            hasReceivedResponse = true;
            
            if (response && response.error) {
              console.warn(`WebSocketService: Registration error: ${response.error}`);
              this.setStatus('error');
              // If we have a pairing code despite the error, we can still use it
              if (response.pairingCode) {
                this.setLastPairingCode(response.pairingCode);
                resolve({
                  displayId,
                  pairingCode: response.pairingCode,
                  error: response.error,
                  timestamp: Date.now()
                });
              } else {
                reject(new Error(response.error));
              }
            } else if (response && response.pairingCode) {
              console.log(`WebSocketService: Registration successful with pairing code: ${response.pairingCode}`);
              this.setStatus('connected');
              this.setLastPairingCode(response.pairingCode);
              resolve({
                displayId: response.displayId || displayId,
                pairingCode: response.pairingCode,
                timestamp: Date.now(),
                synthetic: false
              });
            } else {
              // We might not have gotten a valid response object
              console.warn('WebSocketService: Invalid response from registration:', response);
              this.setStatus('error');
              reject(new Error('Invalid registration response'));
            }
          });
        } catch (emitError) {
          console.error('WebSocketService: Error emitting register_display event:', emitError);
          this.setStatus('error');
          reject(emitError);
        }
        
        // Set a timeout to handle no response case
        const timeoutId = setTimeout(() => {
          if (!hasReceivedResponse) {
            console.warn('WebSocketService: No registration response received after 15 seconds');
            
            // Try to create a synthetic pairing code from our device ID
            // This will allow operation even if the Redis server is down
            const deviceIdParts = displayId.split('-');
            if (deviceIdParts.length >= 3) {
              const timestamp = deviceIdParts[1].substring(0, 6);
              const randomPart = deviceIdParts[2].substring(0, 6);
              
              // Create a 6-digit code by combining parts of the timestamp and random string
              const syntheticCode = (parseInt(timestamp) % 1000000).toString().padStart(6, '0');
              
              console.log(`WebSocketService: Using synthetic pairing code: ${syntheticCode}`);
              this.setLastPairingCode(syntheticCode);
              
              // Resolve with synthetic code
              resolve({
                displayId,
                pairingCode: syntheticCode,
                timestamp: Date.now(),
                synthetic: true
              });
              
              // Emit a synthetic message for any listeners
              this.emitMessage({
                type: 'display_registered',
                data: {
                  displayId,
                  pairingCode: syntheticCode,
                  timestamp: Date.now(),
                  synthetic: true
                }
              });
            } else {
              console.error('WebSocketService: Could not create synthetic code from device ID');
              this.setStatus('error');
              reject(new Error('Registration timeout and could not create synthetic code'));
            }
          }
        }, 15000);
        
        // Add a listener for the display_registered event
        this.socket.on('display_registered', (data: any) => {
          console.log('WebSocketService: Received display_registered event:', data);
          
          clearTimeout(timeoutId);
          hasReceivedResponse = true;
          
          if (data && data.error) {
            console.warn(`WebSocketService: Registration error: ${data.error}`);
            this.setStatus('error');
            
            // If we have a pairing code despite the error, we can still use it
            if (data.pairingCode) {
              this.setLastPairingCode(data.pairingCode);
              resolve({
                displayId: data.displayId || displayId,
                pairingCode: data.pairingCode,
                error: data.error,
                timestamp: Date.now()
              });
            } else {
              reject(new Error(data.error));
            }
          } else if (data && data.pairingCode) {
            console.log(`WebSocketService: Registration successful with pairing code: ${data.pairingCode}`);
            this.setStatus('connected');
            this.setLastPairingCode(data.pairingCode);
            
            resolve({
              displayId: data.displayId || displayId,
              pairingCode: data.pairingCode,
              timestamp: Date.now(),
              synthetic: false
            });
          } else {
            console.warn('WebSocketService: Invalid data from display_registered event:', data);
            this.setStatus('error');
            reject(new Error('Invalid display_registered data'));
          }
        });
      });
    } catch (error) {
      console.error('WebSocketService: Error during registration:', error);
      this.setStatus('error');
      return Promise.reject(error);
    }
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
          path: '/socket.io', // Make sure the path is correct
          extraHeaders: {
            "User-Agent": "VizoraTV/1.0" 
          },
          query: deviceId ? {
            deviceId,
            deviceType: 'tv',
            timestamp: Date.now().toString()
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

  // Emit a message to all subscribers
  emitMessage(message: any): void {
    try {
      // Track pairing codes in messages
      if (message.type === 'display_registered' && 
          message.data && 
          message.data.pairingCode) {
        this.setLastPairingCode(message.data.pairingCode);
      }
      
      this.notifyMessageListeners(message);
    } catch (error) {
      console.error('Error emitting message:', error);
    }
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
    
    // Check if the server is running on the standard port
    websocketService.discoveredUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3003'
      : `${window.location.protocol}//${window.location.hostname}:3003`;
    
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