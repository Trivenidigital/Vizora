/**
 * Display Polling Service
 * 
 * Provides fallback polling mechanism when WebSocket connections fail
 * Automatically switches between WebSocket real-time updates and polling
 */

import { Display } from './displayService';
import { displayService } from './displayService';
import { ConnectionManager } from '@vizora/common';
import { tokenManager } from './authService';
import { failedDisplays, hasFailedWith404, markAsFailed } from './displayState';
import { useConnectionState } from '@vizora/common';

// Polling interval in milliseconds (10 seconds)
const POLLING_INTERVAL = 10000;
// Maximum consecutive 404 errors before stopping monitoring
const MAX_404_ERRORS = 3;
// Maximum polling retries overall before giving up
const MAX_POLLING_RETRIES = 5;

// Add this after other constants
const DELETED_DISPLAYS_KEY = 'vizora_deleted_displays';

interface MonitoredDisplay {
  displayId: string;
  callbacks: Array<(display: Display) => void>;
  errorCallbacks: Array<(error: Error) => void>;
  lastUpdated: number;
  isPolling: boolean;
  pollingIntervalId?: number;
  // Track 404 errors to auto-cleanup displays that no longer exist
  consecutive404Errors: number;
  pollingRetries: number;
  lastPollingAttempt: number;
  isSubscribed: boolean;
  subscriptionTime: number;
}

type DisplayPollingCallback = (display: Display) => void;
type DisplayErrorCallback = (error: Error) => void;
type SocketEventCallback = () => void;

// Create dedicated connection manager instance for display polling
export const displayConnectionManager = new ConnectionManager({
  baseUrl: import.meta.env.VITE_API_URL || '/api',
  socketPath: import.meta.env.VITE_SOCKET_PATH || '/socket.io',
  tokenProvider: async () => {
    try {
      // Use the token manager to get the current token
      const token = await tokenManager.getToken();
      console.log('ConnectionManager token provider called, token available:', !!token);
      return token;
    } catch (error) {
      console.error('Error in tokenProvider:', error);
      return null;
    }
  },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  reconnectionDelayMax: 10000,
  timeout: 30000,
  autoConnect: false,
  debug: import.meta.env.DEV,
});

// Event handler types
type DisplayStatusHandler = (displayId: string, status: any) => void;
type DisplayListHandler = (displays: any[]) => void;
type ErrorHandler = (error: Error) => void;

class DisplayPollingService {
  private monitoredDisplays: Map<string, MonitoredDisplay> = new Map();
  private socketConnected: boolean = false;
  private socketConnectListeners: SocketEventCallback[] = [];
  private socketDisconnectListeners: SocketEventCallback[] = [];
  private initialized: boolean = false;
  private pollingInterval: number | null = null;
  private displayStatusHandlers: Set<DisplayStatusHandler> = new Set();
  private displayListHandlers: Set<DisplayListHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private activePolling = false;
  private pollingFrequency = 30000; // 30 seconds
  // Track displays that have failed with 404
  private failedDisplays: Set<string> = new Set();

  constructor() {
    // We don't initialize the connection here to avoid connecting before needed
    // Try to restore failed displays from localStorage
    try {
      const deletedDisplays = this.getDeletedDisplays();
      deletedDisplays.forEach(id => this.failedDisplays.add(id));
      console.log(`Initialized failedDisplays with ${this.failedDisplays.size} entries from localStorage`);
    } catch (error) {
      console.warn('Error initializing failedDisplays from localStorage:', error);
    }
  }

  /**
   * Initialize the service and socket connection
   */
  public init(): void {
    if (this.initialized) return;
    
    this.initialized = true;
    this.setupConnection();
  }

  /**
   * Check if socket is currently connected
   */
  public isSocketConnected(): boolean {
    return this.socketConnected;
  }

  /**
   * Simulate a socket disconnect for testing purposes
   */
  public simulateDisconnect(): void {
    if (this.socketConnected) {
      console.log('Simulating socket disconnect...');
      displayConnectionManager.disconnect();
      
      // Reconnect after 5 seconds
      setTimeout(() => {
        console.log('Simulating socket reconnect...');
        displayConnectionManager.connect();
      }, 5000);
    } else {
      console.log('Cannot simulate disconnect - socket not connected');
    }
  }

  /**
   * Set up the connection for real-time updates
   */
  private setupConnection(): void {
    try {
      console.log('Setting up display socket connection...');
      
      // Reset any existing handlers to prevent duplicates
      try {
        if (displayConnectionManager.isConnected()) {
          displayConnectionManager.disconnect();
          console.log('Disconnected existing connection before setup');
        }
      } catch (e) {
        console.warn('Error checking/disconnecting existing connection:', e);
      }
      
      // Set up connection manager event handlers
      displayConnectionManager.on('connect', () => {
        const socketId = displayConnectionManager.getSocket()?.id || 'unknown';
        console.log('Display socket connected with ID:', socketId);
        this.socketConnected = true;
        
        // Set up message handler for all custom events once connected
        this.setupMessageHandlers();
        
        // Switch all displays from polling to socket
        this.monitoredDisplays.forEach((display, displayId) => {
          this.stopPolling(displayId);
          // Re-subscribe to display updates
          this.subscribeToDisplaySocket(displayId);
        });
        
        // Notify listeners
        this.socketConnectListeners.forEach(listener => {
          try {
            listener();
          } catch (error) {
            console.error('Error in socket connect listener:', error);
          }
        });
      });

      displayConnectionManager.on('disconnect', (reason) => {
        console.log('Display socket disconnected, reason:', reason);
        this.socketConnected = false;
        
        // Switch all displays from socket to polling
        this.monitoredDisplays.forEach((display, displayId) => {
          this.startPolling(displayId);
        });
        
        // Notify listeners
        this.socketDisconnectListeners.forEach(listener => {
          try {
            listener();
          } catch (error) {
            console.error('Error in socket disconnect listener:', error);
          }
        });
        
        // If disconnect reason is 'io server disconnect' or 'io client disconnect',
        // don't attempt to automatically reconnect
        if (reason !== 'io server disconnect' && reason !== 'io client disconnect') {
          console.log('Scheduling reconnect attempt after disconnect...');
          setTimeout(() => {
            this.attemptReconnect();
          }, 5000); // 5 second delay before reconnect attempt
        }
      });
      
      displayConnectionManager.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
        
        // Switch all displays to polling on connection error
        this.monitoredDisplays.forEach((display, displayId) => {
          if (!display.isPolling) {
            this.startPolling(displayId);
          }
        });
      });
      
      displayConnectionManager.on('reconnect_attempt', (attempt) => {
        console.log(`Socket reconnect attempt ${attempt}...`);
      });
      
      displayConnectionManager.on('reconnect_failed', () => {
        console.error('Socket reconnection failed after all attempts');
        // Ensure all displays are polling after reconnection fails
        this.monitoredDisplays.forEach((display, displayId) => {
          if (!display.isPolling) {
            this.startPolling(displayId);
          }
        });
      });

      // Connect to the socket server
      this.attemptConnect();
      
    } catch (error) {
      console.error('Error setting up display socket connection:', error);
      
      // Start polling for all displays as fallback
      this.monitoredDisplays.forEach((display, displayId) => {
        if (!display.isPolling) {
          this.startPolling(displayId);
        }
      });
    }
  }
  
  /**
   * Attempt to connect to the socket server
   */
  private attemptConnect(): void {
    try {
      console.log('Attempting to connect to display socket server...');
      displayConnectionManager.connect();
    } catch (error) {
      console.error('Failed to connect to display socket:', error);
      
      // Start polling for all displays on connection error
      this.monitoredDisplays.forEach((display, displayId) => {
        if (!display.isPolling) {
          this.startPolling(displayId);
        }
      });
      
      // Schedule reconnect attempt
      setTimeout(() => {
        this.attemptReconnect();
      }, 5000); // 5 second delay
    }
  }
  
  /**
   * Attempt to reconnect to the socket server
   */
  private attemptReconnect(): void {
    // Only attempt reconnect if not already connected and not already reconnecting
    if (!this.socketConnected && !displayConnectionManager.isReconnecting()) {
      console.log('Attempting to reconnect to display socket server...');
      try {
        displayConnectionManager.connect();
      } catch (error) {
        console.error('Failed to reconnect to display socket:', error);
      }
    }
  }

  private setupMessageHandlers(): void {
    const socket = displayConnectionManager.getSocket();
    if (!socket) {
      console.warn('Cannot set up socket message handlers: socket is not available');
      return;
    }
    
    console.log('Setting up socket message handlers for socket ID:', socket.id);
    
    // Handle display updates
    socket.on('display-update', (data: { displayId: string, display: Display }) => {
      try {
        if (!data || !data.displayId || !data.display) {
          console.warn('Received invalid display-update event:', data);
          return;
        }
        
        // Check if this display is known to be deleted
        if (hasFailedWith404(data.displayId)) {
          console.log(`SKIP UPDATE PROCESSING: Display ${data.displayId} is marked as deleted in localStorage`);
          return;
        }
        
        console.log(`Socket received update for display ${data.displayId}`, data.display);
        const monitoredDisplay = this.monitoredDisplays.get(data.displayId);
        
        if (monitoredDisplay) {
          // Update last updated timestamp
          monitoredDisplay.lastUpdated = Date.now();
          
          // Notify all callbacks for this display
          monitoredDisplay.callbacks.forEach(callback => {
            try {
              callback(data.display);
            } catch (error) {
              console.error('Error in display update callback:', error);
            }
          });
        } else {
          console.log(`Received update for unmonitored display: ${data.displayId}`);
        }
      } catch (error) {
        console.error('Error handling display-update event:', error);
      }
    });

    // Handle display status updates
    socket.on('display-status', (data: { displayId: string, status: any }) => {
      try {
        if (!data || !data.displayId) {
          console.warn('Received invalid display-status event:', data);
          return;
        }
        
        console.log(`Socket received status update for display ${data.displayId}:`, data.status);
        this.notifyDisplayStatus(data.displayId, data.status);
      } catch (error) {
        console.error('Error handling display-status event:', error);
      }
    });

    // Handle display list updates
    socket.on('display-list', (data: { displays: any[] }) => {
      try {
        if (!data || !Array.isArray(data.displays)) {
          console.warn('Received invalid display-list event:', data);
          return;
        }
        
        console.log(`Socket received display list with ${data.displays.length} displays`);
        this.notifyDisplayList(data.displays);
      } catch (error) {
        console.error('Error handling display-list event:', error);
      }
    });
    
    // Handle connect, disconnect, reconnect events
    socket.on('connect', () => {
      console.log('Socket.IO transport connected:', socket.id);
    });
    
    socket.on('disconnect', (reason: string) => {
      console.log('Socket.IO transport disconnected, reason:', reason);
    });
    
    socket.on('reconnect', (attemptNumber: number) => {
      console.log('Socket.IO transport reconnected after', attemptNumber, 'attempts');
      
      // Only resubscribe to non-deleted displays on reconnect
      this.monitoredDisplays.forEach((_, displayId) => {
        if (hasFailedWith404(displayId)) {
          console.log(`SKIP RESUBSCRIBE ON RECONNECT: Display ${displayId} is marked as deleted`);
        } else {
          console.log(`Resubscribing to display ${displayId} after reconnection`);
          this.subscribeToDisplaySocket(displayId);
        }
      });
    });
    
    socket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log('Socket.IO transport reconnect attempt:', attemptNumber);
    });
    
    socket.on('reconnect_error', (error: any) => {
      console.error('Socket.IO reconnect error:', error);
    });
    
    socket.on('reconnect_failed', () => {
      console.error('Socket.IO reconnection failed after all attempts');
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      console.error('Socket error:', error);
      this.notifyError(error);
    });
    
    socket.on('connect_error', (error: Error) => {
      console.error('Socket connect error:', error);
      this.notifyError(error);
    });
    
    // Handle server heartbeat for connection health check
    socket.on('heartbeat', (data: any) => {
      console.log('Received heartbeat from server:', data);
    });
    
    // Subscribe to display updates for all currently monitored displays
    this.monitoredDisplays.forEach((_, displayId) => {
      this.subscribeToDisplaySocket(displayId);
    });
  }

  /**
   * Subscribe to socket updates for a display
   */
  private subscribeToDisplaySocket(displayId: string): void {
    if (!displayId) {
      console.warn('Attempted to subscribe to socket updates for undefined displayId');
      return;
    }
    
    const socket = displayConnectionManager.getSocket();
    if (!socket) {
      console.warn(`Socket not available, starting polling for display ${displayId}`);
      this.startPolling(displayId);
      return;
    }
    
    // Ensure we are not already subscribing/subscribed
    const display = this.getMonitoredDisplay(displayId);
    if (display?.isSubscribed) {
      console.log(`Already subscribed to updates for display ${displayId}`);
      return;
    }
    
    try {
      console.log(`Subscribing to updates for display ${displayId} via socket ${socket.id}`);
      
      // Check if the socket is actually connected
      if (!socket.connected) {
        console.warn(`Socket is initialized but not connected. Starting polling fallback for ${displayId}`);
        this.startPolling(displayId);
        return;
      }
      
      // FIXED: Remove any namespace usage - use root namespace with event identifiers
      // Emit the subscription event with error handling
      socket.emit('subscribe-display', { displayId }, (response: any) => {
        // This is an acknowledgement callback if the server supports it
        if (response && response.error) {
          console.error(`Error subscribing to display ${displayId}:`, response.error);
          // Start polling as fallback
          this.startPolling(displayId);
        } else if (response && response.success) {
          console.log(`Successfully subscribed to display ${displayId} updates`);
          
          // Mark as subscribed
          const display = this.getMonitoredDisplay(displayId);
          if (display) {
            display.isSubscribed = true;
            display.subscriptionTime = Date.now();
          }
        }
      });
      
    } catch (error) {
      console.error(`Error subscribing to display ${displayId} updates:`, error);
      // Start polling as fallback when subscription fails
      this.startPolling(displayId);
    }
  }

  public onSocketConnect(callback: SocketEventCallback): void {
    this.socketConnectListeners.push(callback);
    
    // If already connected, call the callback immediately
    if (this.socketConnected) {
      try {
        callback();
      } catch (error) {
        console.error('Error in socket connect callback:', error);
      }
    }
  }

  public offSocketConnect(callback: SocketEventCallback): void {
    const index = this.socketConnectListeners.indexOf(callback);
    if (index !== -1) {
      this.socketConnectListeners.splice(index, 1);
    }
  }

  public onSocketDisconnect(callback: SocketEventCallback): void {
    this.socketDisconnectListeners.push(callback);
    
    // If already disconnected, call the callback immediately
    if (!this.socketConnected) {
      try {
        callback();
      } catch (error) {
        console.error('Error in socket disconnect callback:', error);
      }
    }
  }

  public offSocketDisconnect(callback: SocketEventCallback): void {
    const index = this.socketDisconnectListeners.indexOf(callback);
    if (index !== -1) {
      this.socketDisconnectListeners.splice(index, 1);
    }
  }

  public isMonitoring(displayId: string): boolean {
    return this.monitoredDisplays.has(displayId);
  }

  public isPolling(displayId: string): boolean {
    const display = this.monitoredDisplays.get(displayId);
    return display ? display.isPolling : false;
  }

  // Add this to the class as a private method
  private getDeletedDisplays(): string[] {
    try {
      const storedValue = localStorage.getItem(DELETED_DISPLAYS_KEY);
      if (storedValue) {
        const parsed = JSON.parse(storedValue);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.warn('Error reading deleted displays from localStorage:', error);
    }
    return [];
  }

  // Public helper for checking deleted displays from other components
  public isDisplayDeleted(displayId: string): boolean {
    return this.getDeletedDisplays().includes(displayId);
  }

  private addToDeletedDisplays(displayId: string): void {
    try {
      const deletedDisplays = this.getDeletedDisplays();
      if (!deletedDisplays.includes(displayId)) {
        deletedDisplays.push(displayId);
        localStorage.setItem(DELETED_DISPLAYS_KEY, JSON.stringify(deletedDisplays));
        console.log(`Added ${displayId} to deleted displays list`);
      }
    } catch (error) {
      console.warn('Error updating deleted displays in localStorage:', error);
    }
  }

  public monitorDisplay(
    displayId: string, 
    options: {
      onUpdate?: DisplayPollingCallback;
      onError?: DisplayErrorCallback;
    } = {}
  ): void {
    if (!displayId) {
      console.error("Cannot monitor display: displayId is undefined");
      return;
    }

    // Check if this display is known to be deleted/invalid or has failed with 404
    if (hasFailedWith404(displayId)) {
      console.log(`SKIP MONITORING: Display ${displayId} has previously failed with 404`);
      if (options.onError) {
        const notFoundError = new Error(`Display ${displayId} has been removed or no longer exists`);
        (notFoundError as any).type = 'not_found';
        (notFoundError as any).displayId = displayId;
        (notFoundError as any).permanent = true;
        options.onError(notFoundError);
      }
      return;
    }
    
    // Also check local storage for deleted displays (backward compatibility)
    const deletedDisplays = this.getDeletedDisplays();
    if (deletedDisplays.includes(displayId)) {
      console.log(`SKIP MONITORING: Display ${displayId} is in deleted displays list`);
      // Add to failedDisplays set for faster future checks
      markAsFailed(displayId);
      
      if (options.onError) {
        const notFoundError = new Error(`Display ${displayId} has been removed or no longer exists`);
        (notFoundError as any).type = 'not_found';
        (notFoundError as any).displayId = displayId;
        (notFoundError as any).permanent = true;
        options.onError(notFoundError);
      }
      return;
    }

    // Check if we're already monitoring this display to prevent duplicate monitoring
    const existingDisplay = this.monitoredDisplays.get(displayId);
    if (existingDisplay) {
      console.log(`SKIP NEW MONITORING: Display ${displayId} already being monitored, just adding callbacks`);
      
      // Check if we need to add the new callbacks
      let callbacksAdded = false;
      
      // Already monitoring, just add the new callbacks
      if (options.onUpdate && !existingDisplay.callbacks.some(cb => cb === options.onUpdate)) {
        existingDisplay.callbacks.push(options.onUpdate);
        callbacksAdded = true;
      }
      
      if (options.onError && !existingDisplay.errorCallbacks.some(cb => cb === options.onError)) {
        existingDisplay.errorCallbacks.push(options.onError);
        callbacksAdded = true;
      }
      
      if (callbacksAdded) {
        console.log(`Added new callbacks to existing monitoring for display ${displayId}`);
      }
      
      return;
    }
    
    console.log(`Starting to monitor display: ${displayId}`);
    
    // Create a new monitored display entry
    const display: MonitoredDisplay = {
      displayId,
      callbacks: options.onUpdate ? [options.onUpdate] : [],
      errorCallbacks: options.onError ? [options.onError] : [],
      lastUpdated: 0,
      isPolling: false,
      consecutive404Errors: 0,
      pollingRetries: 0,
      lastPollingAttempt: 0,
      isSubscribed: false,
      subscriptionTime: 0
    };
    
    // Add to our map
    this.monitoredDisplays.set(displayId, display);
    
    // If not yet initialized, initialize
    if (!this.initialized) {
      this.init();
    }
    
    if (this.socketConnected) {
      // Subscribe to updates via socket
      this.subscribeToDisplaySocket(displayId);
    } else {
      // Start polling if socket not connected
      this.startPolling(displayId);
    }
  }

  /**
   * Stop monitoring a display and mark it as failed if it had 404 errors
   * @param displayId The display ID to stop monitoring
   * @param shouldMarkAsFailed Whether to add this display to the failedDisplays set
   */
  public stopMonitoringDisplay(displayId: string, shouldMarkAsFailed: boolean = false): void {
    console.log(`Stopping monitoring for display: ${displayId}${shouldMarkAsFailed ? ' (marking as failed)' : ''}`);
    
    const display = this.monitoredDisplays.get(displayId);
    
    if (display) {
      // Log why we're stopping monitoring
      const reason = shouldMarkAsFailed
        ? 'PERMANENT FAILURE: Display returned 404 (not found)'
        : display.consecutive404Errors >= MAX_404_ERRORS 
          ? `AUTO-CLEANUP: Display returned 404 ${display.consecutive404Errors} times`
          : 'User initiated or component unmounted';
      
      console.log(`UNSUBSCRIBING: Display ${displayId} - Reason: ${reason}`);
      
      // Stop polling if active
      if (display.isPolling) {
        this.stopPolling(displayId);
      }
      
      // Unsubscribe from socket events
      if (this.socketConnected) {
        this.unsubscribeFromDisplaySocket(displayId);
      }
      
      // Remove from our map
      this.monitoredDisplays.delete(displayId);
      
      // If marking as failed, add to failedDisplays set in shared state
      if (shouldMarkAsFailed) {
        markAsFailed(displayId);
        console.log(`✓ Added display ${displayId} to failed displays set`);
      }
      
      console.log(`✓ Successfully removed display ${displayId} from monitoring`);
    } else {
      console.log(`Display ${displayId} was not being monitored`);
    }
  }
  
  /**
   * Backward compatibility method - just wraps stopMonitoringDisplay
   */
  public stopMonitoring(displayId: string): void {
    this.stopMonitoringDisplay(displayId, false);
  }
  
  /**
   * Check if a display is known to have failed with 404
   */
  public hasFailedWith404(displayId: string): boolean {
    return hasFailedWith404(displayId);
  }

  private startPolling(displayId: string): void {
    const display = this.monitoredDisplays.get(displayId);
    
    if (!display) {
      console.warn(`Cannot start polling: Display ${displayId} is not monitored`);
      return;
    }
    
    if (display.isPolling) {
      console.log(`Polling already active for display: ${displayId}`);
      return;
    }
    
    console.log(`STARTING POLLING: Display ${displayId} - Socket unavailable or disconnected`);
    
    display.isPolling = true;
    
    // Immediately fetch data
    this.fetchDisplayData(displayId);
    
    // Set up interval
    display.pollingIntervalId = window.setInterval(() => {
      this.fetchDisplayData(displayId);
    }, POLLING_INTERVAL);
  }

  private stopPolling(displayId: string): void {
    const display = this.monitoredDisplays.get(displayId);
    
    if (!display) {
      console.warn(`Cannot stop polling: Display ${displayId} is not monitored`);
      return;
    }
    
    if (!display.isPolling) {
      console.log(`Polling not active for display: ${displayId}`);
      return;
    }
    
    // Determine reason for stopping
    let reason = 'Unknown reason';
    if (this.socketConnected) {
      reason = 'Socket connection established';
    } else if (display.consecutive404Errors >= MAX_404_ERRORS) {
      reason = `AUTO-CLEANUP: Display returned 404 ${display.consecutive404Errors} times`;
    } else if (display.pollingRetries >= MAX_POLLING_RETRIES) {
      reason = `Too many errors (${display.pollingRetries} attempts)`;
    }
    
    console.log(`STOPPING POLLING: Display ${displayId} - Reason: ${reason}`);
    
    // Clear interval
    if (display.pollingIntervalId) {
      clearInterval(display.pollingIntervalId);
      display.pollingIntervalId = undefined;
    }
    
    display.isPolling = false;
  }

  private async fetchDisplayData(displayId: string): Promise<void> {
    const display = this.monitoredDisplays.get(displayId);
    
    if (!display) {
      console.warn(`Attempted to fetch data for unmonitored display: ${displayId}`);
      return;
    }
    
    // Check if this is a failed display first
    if (hasFailedWith404(displayId)) {
      console.log(`SKIP POLLING: Display ${displayId} is in failed displays set`);
      this.stopPolling(displayId);
      return;
    }
    
    // Implement throttling - only allow one fetch every 3 seconds for the same display
    const now = Date.now();
    const minInterval = 3000; // 3 seconds minimum between polls for same display
    
    if (now - display.lastPollingAttempt < minInterval) {
      console.log(`THROTTLED: Skipping polling for display ${displayId}, last attempt was ${now - display.lastPollingAttempt}ms ago`);
      return;
    }
    
    // Update last polling attempt timestamp
    display.lastPollingAttempt = now;
    
    // Check if this display is known to be deleted
    const deletedDisplays = this.getDeletedDisplays();
    if (deletedDisplays.includes(displayId)) {
      console.log(`SKIP POLLING: Display ${displayId} is marked as deleted in localStorage`);
      this.stopPolling(displayId);
      // Add to failed displays set for future reference
      this.failedDisplays.add(displayId);
      return;
    }
    
    try {
      // Only log at debug level to avoid console spam
      console.log(`Polling for display data: ${displayId}`);
      
      // Fetch display data using display service
      const displayData = await displayService.getDisplayById(displayId);
      
      if (displayData) {
        // Reset error counters on successful fetch
        display.consecutive404Errors = 0;
        display.pollingRetries = 0;
        
        // Update last updated timestamp
        display.lastUpdated = Date.now();
        
        // Log successful data retrieval
        console.log(`Successfully fetched data for display ${displayId}`, {
          name: displayData.name,
          status: displayData.status,
          updated: displayData.updatedAt
        });
        
        // Notify all callbacks
        display.callbacks.forEach(callback => {
          try {
            callback(displayData);
          } catch (error) {
            console.error('Error in display update callback:', error);
          }
        });
      } else {
        console.warn(`Received undefined or null data for display ${displayId}`);
        throw new Error('No display data received');
      }
    } catch (error) {
      // Determine error type and provide appropriate details
      let errorMessage = 'Unknown error';
      let errorType = 'unknown';
      let is404Error = false;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for custom error properties we might have added
        if ('status' in error && (error as any).status === 404) {
          is404Error = true;
        }
      }
      
      // Check if it's an Axios error with response data
      if (error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError) {
        const axiosError = error as any;
        
        if (axiosError.response) {
          // Server responded with an error status code
          const status = axiosError.response.status;
          errorType = 'api';
          errorMessage = `API error (${status}): ${
            axiosError.response.data?.message || axiosError.response.statusText
          }`;
          
          // Check for 404 not found - immediately stop monitoring on 404
          if (status === 404) {
            is404Error = true;
            errorMessage = `Display ${displayId} no longer exists`;
            
            // Immediately stop monitoring this display on 404
            console.warn(`PERMANENT FAILURE: Display ${displayId} returned 404. Immediately stopping monitoring.`);
            
            // Notify with friendly message before stopping monitoring
            const notFoundError = new Error(`Display ${displayId} has been removed or no longer exists`);
            (notFoundError as any).type = 'not_found';
            (notFoundError as any).displayId = displayId;
            (notFoundError as any).permanent = true;
            
            display.errorCallbacks.forEach(callback => {
              try {
                callback(notFoundError);
              } catch (callbackError) {
                console.error('Error in display error callback:', callbackError);
              }
            });
            
            // Stop monitoring and mark as failed
            this.stopMonitoringDisplay(displayId, true);
            return;
          }
        } else if (axiosError.request) {
          // Request was made but no response received
          errorType = 'network';
          errorMessage = 'Network error: No response received from server';
          // Increment polling retries for network errors
          display.pollingRetries++;
        } else {
          // Error in setting up the request
          errorType = 'request';
          errorMessage = `Request error: ${axiosError.message}`;
          display.pollingRetries++;
        }
      } else {
        // General error - increment counter
        display.pollingRetries++;
      }
      
      // Check if we've exceeded max retries
      if (display.pollingRetries >= MAX_POLLING_RETRIES && !is404Error) {
        console.warn(`PAUSING POLLING: Display ${displayId} failed polling ${display.pollingRetries} times (>=${MAX_POLLING_RETRIES}). Pausing monitoring to prevent further console spam.`);
        // Don't stop monitoring, but pause polling to prevent unnecessary spam
        this.stopPolling(displayId);
        
        // Create a recoverable error that indicates monitoring is paused but can be resumed
        const maxRetriesError = new Error(`Display ${displayId} is currently unavailable. Click Refresh to try again.`);
        (maxRetriesError as any).type = 'max_retries';
        (maxRetriesError as any).displayId = displayId;
        (maxRetriesError as any).recoverable = true;
        
        // Notify error callbacks
        display.errorCallbacks.forEach(callback => {
          try {
            callback(maxRetriesError);
          } catch (callbackError) {
            console.error('Error in display error callback:', callbackError);
          }
        });
        return;
      }
      
      // For first-time errors, or when we need to log, use console.error
      // For repeated errors, especially 404s, log at warn level
      if (display.pollingRetries === 1 || (!is404Error && display.pollingRetries % 5 === 0)) {
        console.error(`Error fetching display data for ${displayId} (${errorType}):`, errorMessage);
      } else if (is404Error && display.consecutive404Errors === 1) {
        console.warn(`First 404 error for display ${displayId}: ${errorMessage}`);
      }
      
      // Notify error callbacks with structured error
      const structuredError = new Error(errorMessage);
      (structuredError as any).type = errorType;
      (structuredError as any).displayId = displayId;
      (structuredError as any).is404 = is404Error;
      
      display.errorCallbacks.forEach(callback => {
        try {
          callback(structuredError);
        } catch (callbackError) {
          console.error('Error in display error callback:', callbackError);
        }
      });
    }
  }

  // Force refresh a display with improved error handling
  public refreshDisplay(displayId: string): Promise<boolean> {
    if (!displayId) {
      console.error('Cannot refresh display: displayId is undefined');
      return Promise.resolve(false);
    }
    
    const display = this.monitoredDisplays.get(displayId);
    if (!display) {
      console.warn(`Attempted to refresh unmonitored display: ${displayId}`);
      return Promise.resolve(false);
    }
    
    // If display was previously having retry issues, reset counters to give it another chance
    if (display.pollingRetries >= MAX_POLLING_RETRIES) {
      display.pollingRetries = 0;
      // If we were in polling mode but it was paused due to errors, restart polling
      if (!display.isPolling && !this.socketConnected) {
        this.startPolling(displayId);
      }
    }
    
    return new Promise((resolve) => {
      try {
        // Try socket refresh first if connected
        if (this.socketConnected) {
          const socket = displayConnectionManager.getSocket();
          if (socket && socket.connected) {
            console.log(`Requesting refresh for display ${displayId} via socket`);
            
            // Set up a one-time listener for the refresh response
            socket.once(`refresh-response-${displayId}`, (data: any) => {
              if (data && data.success) {
                console.log(`Successfully refreshed display ${displayId} via socket`);
                resolve(true);
              } else {
                console.warn(`Socket refresh failed for display ${displayId}, falling back to polling`);
                // Fall back to polling to get the data
                this.fetchDisplayData(displayId);
                resolve(true);
              }
            });
            
            // Set a timeout in case we don't get a response
            setTimeout(() => {
              console.warn(`Socket refresh timeout for display ${displayId}, falling back to polling`);
              this.fetchDisplayData(displayId);
              resolve(true);
            }, 3000);
            
            // Request the refresh
            socket.emit('refresh-display', { displayId });
          } else {
            // Socket exists but not connected, fall back to direct fetch
            console.warn(`Socket exists but not connected. Falling back to direct fetch for ${displayId}`);
            this.fetchDisplayData(displayId);
            resolve(true);
          }
        } else {
          // No socket connection, use polling
          console.log(`No socket connection available, using direct fetch for ${displayId}`);
          this.fetchDisplayData(displayId);
          resolve(true);
        }
      } catch (error) {
        console.error(`Error in refreshDisplay for ${displayId}:`, error);
        // Always try the direct fetch as last resort
        this.fetchDisplayData(displayId);
        resolve(true);
      }
    });
  }

  // Master polling methods for multiple displays
  async start(): Promise<void> {
    if (this.activePolling) return;
    
    console.log('Starting display polling service');
    this.activePolling = true;
    
    // Initialize socket connection if needed
    if (!this.initialized) {
      this.init();
    }
    
    // Request initial display list
    this.requestDisplayList();
    
    // Start polling if socket not connected
    if (!this.socketConnected) {
      this.startGlobalPolling();
    }
  }

  stop(): void {
    if (!this.activePolling) return;
    
    console.log('Stopping display polling service');
    this.activePolling = false;
    
    // Clear global polling interval
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    // Stop polling for individual displays
    this.monitoredDisplays.forEach((display, displayId) => {
      this.stopPolling(displayId);
    });
  }

  private startGlobalPolling(): void {
    console.log('Starting global display polling');
    
    // Clear existing interval if any
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
    }
    
    // Request display list immediately
    this.requestDisplayList();
    
    // Set up interval for future requests
    this.pollingInterval = window.setInterval(() => {
      this.requestDisplayList();
    }, this.pollingFrequency);
  }

  private requestDisplayList(): void {
    console.log('Requesting display list...');
    
    displayService.getDisplays()
      .then(response => {
        console.log('Display list response received:', {
          hasData: !!response,
          type: typeof response,
          isArray: Array.isArray(response),
          hasDisplaysProperty: response && typeof response === 'object' && 'displays' in response
        });
        
        // Handle the { displays: [...] } response format or direct array
        let displaysList: any[] = [];
        
        if (response && typeof response === 'object') {
          // Case 1: { displays: [...] }
          if ('displays' in response && Array.isArray(response.displays)) {
            displaysList = response.displays;
          } 
          // Case 2: { success: true, data: [...] }
          else if ('success' in response && response.success === true && 'data' in response && Array.isArray(response.data)) {
            displaysList = response.data;
          }
        } 
        // Case 3: Direct array
        else if (Array.isArray(response)) {
          displaysList = response;
        }
        
        // Validate the list
        if (!Array.isArray(displaysList)) {
          console.error('Invalid display list format received:', response);
          displaysList = [];
        }
        
        console.log(`Received ${displaysList.length} displays in list`);
        
        // Process list with validation checks
        const validDisplays = displaysList.filter(display => {
          // Ensure each item has at least an id
          return display && typeof display === 'object' && ('id' in display || '_id' in display);
        });
        
        if (validDisplays.length !== displaysList.length) {
          console.warn(`Filtered out ${displaysList.length - validDisplays.length} invalid displays from list`);
        }
        
        // Notify with validated list
        this.notifyDisplayList(validDisplays);
      })
      .catch(error => {
        // Handle specific error scenarios
        let errorMessage = 'Unknown error fetching display list';
        let errorType = 'unknown';
        
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        // Check if it's an Axios error
        if (error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError) {
          const axiosError = error as any;
          
          if (axiosError.response) {
            // Server responded with an error status code
            const status = axiosError.response.status;
            const responseData = axiosError.response.data;
            
            errorType = 'api';
            errorMessage = `API error (${status}): ${
              responseData?.message || axiosError.response.statusText
            }`;
            
            // Special handling for common status codes
            if (status === 401) {
              errorMessage = 'Authentication error: Please log in again';
            } else if (status === 403) {
              errorMessage = 'Authorization error: You do not have permission to access displays';
            } else if (status === 404) {
              errorMessage = 'The displays endpoint was not found';
            } else if (status >= 500) {
              errorMessage = 'Server error: The display service is currently unavailable';
            }
          } else if (axiosError.request) {
            // Request was made but no response received
            errorType = 'network';
            errorMessage = 'Network error: Could not connect to the display service';
          }
        }
        
        console.error(`Error fetching display list (${errorType}):`, errorMessage);
        
        // Create structured error
        const structuredError = new Error(errorMessage);
        (structuredError as any).type = errorType;
        
        this.notifyError(structuredError);
      });
  }

  subscribeToDisplay(displayId: string): void {
    if (this.socketConnected) {
      console.log(`Subscribing to display updates: ${displayId}`);
      this.subscribeToDisplaySocket(displayId);
    } else {
      console.warn(`Cannot subscribe to display ${displayId}: socket not connected`);
      // Start polling as fallback
      this.startPolling(displayId);
    }
  }

  unsubscribeFromDisplay(displayId: string): void {
    if (this.socketConnected) {
      console.log(`Unsubscribing from display updates: ${displayId}`);
      this.unsubscribeFromDisplaySocket(displayId);
    }
    
    // Stop polling if active
    this.stopPolling(displayId);
  }

  sendDisplayCommand(displayId: string, command: string, data: any): void {
    if (this.socketConnected) {
      console.log(`Sending command to display ${displayId}:`, command, data);
      const socket = displayConnectionManager.getSocket();
      if (socket) {
        socket.emit('display-command', { displayId, command, data });
      }
    } else {
      console.warn(`Cannot send command to display ${displayId}: socket not connected`);
      this.notifyError(new Error(`Cannot send command to display: not connected`));
    }
  }

  onDisplayStatus(handler: DisplayStatusHandler): void {
    this.displayStatusHandlers.add(handler);
  }

  offDisplayStatus(handler: DisplayStatusHandler): void {
    this.displayStatusHandlers.delete(handler);
  }

  onDisplayList(handler: DisplayListHandler): void {
    this.displayListHandlers.add(handler);
  }

  offDisplayList(handler: DisplayListHandler): void {
    this.displayListHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlers.add(handler);
  }

  offError(handler: ErrorHandler): void {
    this.errorHandlers.delete(handler);
  }

  private notifyDisplayStatus(displayId: string, status: any): void {
    this.displayStatusHandlers.forEach(handler => {
      try {
        handler(displayId, status);
      } catch (error) {
        console.error('Error in display status handler:', error);
      }
    });
  }

  private notifyDisplayList(displays: any[]): void {
    this.displayListHandlers.forEach(handler => {
      try {
        handler(displays);
      } catch (error) {
        console.error('Error in display list handler:', error);
      }
    });
  }

  private notifyError(error: Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }

  isActive(): boolean {
    return this.activePolling;
  }

  async getLatency(): Promise<number> {
    if (this.socketConnected) {
      const socket = displayConnectionManager.getSocket();
      if (socket) {
        try {
          // Use a simple ping/pong approach with Promise to measure latency
          return new Promise((resolve) => {
            const start = Date.now();
            
            // Set up a one-time handler for pong response
            const handlePong = () => {
              const latency = Date.now() - start;
              resolve(latency);
            };
            
            // Use either built-in ping or emit custom event
            if (typeof socket.ping === 'function') {
              socket.ping();
              socket.once('pong', handlePong);
            } else {
              socket.emit('ping');
              socket.once('pong', handlePong);
            }
            
            // Timeout after 3 seconds
            setTimeout(() => {
              if (typeof socket.off === 'function') {
                socket.off('pong', handlePong);
              }
              resolve(-1);
            }, 3000);
          });
        } catch (error) {
          console.error('Error measuring latency:', error);
          return -1;
        }
      }
    }
    return -1; // Not connected
  }

  // Helper method to unsubscribe from display updates via socket
  private unsubscribeFromDisplaySocket(displayId: string): void {
    if (!displayId) {
      console.error('Cannot unsubscribe from display updates: displayId is undefined');
      return;
    }
    
    const socket = displayConnectionManager.getSocket();
    if (!socket) {
      console.warn(`Cannot unsubscribe from display updates for ${displayId}: socket not connected`);
      return;
    }
    
    try {
      console.log(`Unsubscribing from updates for display ${displayId} via socket ${socket.id}`);
      socket.emit('unsubscribe-display', { displayId });
      
      // Also leave room for this display if that's how the server handles it
      if (typeof socket.leave === 'function') {
        socket.leave(`display:${displayId}`);
      }
    } catch (error) {
      console.error(`Error unsubscribing from display ${displayId} updates:`, error);
    }
  }

  private getMonitoredDisplay(displayId: string): MonitoredDisplay | undefined {
    return this.monitoredDisplays.get(displayId);
  }
}

// Create and export singleton instance
export const displayPollingService = new DisplayPollingService();
export default displayPollingService;

// Utility function to check if a display is deleted - can be used without instance
export const isDisplayDeleted = (displayId: string): boolean => {
  return displayPollingService.isDisplayDeleted(displayId);
};

// Utility function to check if a display has failed with 404
export const hasFailedWith404 = (displayId: string): boolean => {
  return displayPollingService.hasFailedWith404(displayId);
}; 