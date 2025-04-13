import EventEmitter from 'eventemitter3';
import { ConnectionManager, ConnectionDiagnostics, DiagnosticConnectionState } from './ConnectionManager';
import { TokenManager } from './TokenManager';
import type { Socket } from 'socket.io-client';

export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  deviceType: string;
  platform: string;
  userAgent: string;
  resolution?: string;
  devicePixelRatio?: number;
  manufacturer?: string;
  model?: string;
  osVersion?: string;
  appVersion?: string;
  ipAddress?: string;
  macAddress?: string;
  registeredAt?: Date;
  lastActiveAt?: Date;
  pairingCode?: string;
  status?: string;
  pairedUserId?: string;
}

export interface DeviceRegistrationOptions {
  autoRegister?: boolean;
  cacheDeviceInfo?: boolean;
  generateIdIfNotExist?: boolean;
  deviceStorageKey?: string;
  deviceIdPrefix?: string; 
  deviceTokenStorageKey?: string;
  storage?: Storage;
}

export interface DeviceRegistrationRequest {
  deviceName?: string;
  deviceInfo?: Partial<DeviceInfo>;
}

export interface DeviceRegistrationResponse {
  deviceId: string;
  token: string;
  deviceInfo?: DeviceInfo;
  pairingInfo?: {
    pairingCode?: string;
    expiresAt?: string;
  };
}

export type DeviceEventType =
  | 'device:registered'
  | 'device:registration:failed'
  | 'device:paired'
  | 'device:pairing:failed'
  | 'device:pairing:code'
  | 'device:info:updated'
  | 'device:content:pushed'
  | 'device:content:updated'
  | 'device:command'
  | 'device:error';

/**
 * Device Manager for handling device registration, pairing, and communication
 */
export class DeviceManager extends EventEmitter {
  private connectionManager: ConnectionManager;
  private tokenManager: TokenManager;
  private deviceInfo: DeviceInfo | null = null;
  private options: DeviceRegistrationOptions;
  private storage: Storage;
  private readonly serviceName: string;
  private registrationInProgress = false;
  private registrationPromise: Promise<DeviceInfo | null> | null = null;
  
  // Store the listener function for cleanup
  private connectionStateUnsubscribeFn: (() => void) | null = null;
  // Track previous connection state to detect transitions
  private previousConnectionState: DiagnosticConnectionState | null = null;
  
  constructor(
    connectionManager: ConnectionManager,
    tokenManager: TokenManager,
    options: DeviceRegistrationOptions = {},
    serviceName = 'DeviceManager'
  ) {
    super();
    this.connectionManager = connectionManager;
    this.tokenManager = tokenManager;
    this.serviceName = serviceName;
    
    // Set default options
    this.options = {
      autoRegister: true,
      cacheDeviceInfo: true,
      generateIdIfNotExist: true,
      deviceStorageKey: 'device_info',
      deviceIdPrefix: 'vizora-device-',
      deviceTokenStorageKey: 'device_token',
      ...options
    };
    
    // Use provided storage or fall back to localStorage if available
    if (options.storage) {
      this.storage = options.storage;
    } else if (typeof localStorage !== 'undefined') {
      this.storage = localStorage;
    } else {
      // Memory-only storage fallback
      this.storage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0
      };
    }
    
    // Initialize device info from storage if available
    this.loadDeviceInfo();
    
    // Set up connection event listeners
    this.setupConnectionListeners();
    
    // Auto-register if enabled and device info not found
    if (this.options.autoRegister && !this.deviceInfo) {
      this.register();
    }
  }
  
  /**
   * Get current device info
   * @returns Device info or null if not registered
   */
  public getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo ? { ...this.deviceInfo } : null;
  }
  
  /**
   * Check if device is registered
   * @returns Whether the device is registered
   */
  public isRegistered(): boolean {
    return !!this.deviceInfo && !!this.deviceInfo.deviceId;
  }
  
  /**
   * Register the device with the server
   * @param options Registration options
   * @returns Promise resolving to device info if registration successful
   */
  public async register(options: DeviceRegistrationRequest = {}): Promise<DeviceInfo | null> {
    // If registration already in progress, return existing promise
    if (this.registrationInProgress && this.registrationPromise) {
      return this.registrationPromise;
    }
    
    // Start registration
    this.registrationInProgress = true;
    
    // Create registration promise
    this.registrationPromise = this.performRegistration(options);
    
    try {
      // Wait for registration to complete
      const deviceInfo = await this.registrationPromise;
      
      if (deviceInfo) {
        this.emit('device:registered', { deviceInfo });
      } else {
        this.emit('device:registration:failed', { reason: 'Registration failed' });
      }
      
      return deviceInfo;
    } catch (error) {
      this.log('Device registration failed', error);
      this.emit('device:registration:failed', { reason: String(error) });
      return null;
    } finally {
      // Reset registration state
      this.registrationInProgress = false;
      this.registrationPromise = null;
    }
  }
  
  /**
   * Request a pairing code for the device
   * @returns Promise resolving to pairing code if successful
   */
  public async requestPairingCode(): Promise<string | null> {
    if (!this.isRegistered()) {
      this.log('Cannot request pairing code, device not registered');
      return null;
    }
    
    try {
      // Request pairing code from server
      const config = {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true // Add credentials for CORS
      };
      
      const response = await this.connectionManager.post<{ pairingCode: string }>(
        '/api/devices/pairing-code', 
        { deviceId: this.deviceInfo!.deviceId },
        config
      );
      
      if (response && response.data && response.data.pairingCode) {
        // Update device info with pairing code
        this.updateDeviceInfo({
          pairingCode: response.data.pairingCode
        });
        
        // Emit event for listeners
        this.emit('device:pairing:code', { pairingCode: response.data.pairingCode });
        this.log('Pairing code received:', response.data.pairingCode);
        
        return response.data.pairingCode;
      }
      
      this.log('No pairing code in response:', response);
      return null;
    } catch (error) {
      this.log('Error requesting pairing code', error);
      
      // Emit error event
      this.emit('device:error', { 
        error, 
        context: 'pairing-code',
        deviceId: this.deviceInfo?.deviceId
      });
      
      return null;
    }
  }
  
  /**
   * Check if device is paired
   * @returns Whether the device is paired
   */
  public isPaired(): boolean {
    return !!this.deviceInfo && !!this.deviceInfo.pairedUserId;
  }
  
  /**
   * Confirm pairing with a user
   * @param userId User ID that paired with the device
   */
  public confirmPairing(userId: string): void {
    if (!this.isRegistered()) {
      this.log('Cannot confirm pairing, device not registered');
      return;
    }
    
    // Collect connection health information
    let connectionInfo: any = {};
    
    try {
      // Get socket ID
      connectionInfo.socketId = this.connectionManager.getSocketId();
      
      // Get transport info if available
      const socket = this.connectionManager.getSocket();
      if (socket?.io?.engine?.transport) {
        connectionInfo.transport = socket.io.engine.transport.name;
      } else {
        connectionInfo.transport = 'unknown';
      }
      
      // Get health metrics if available
      if (typeof this.connectionManager.getHealthStatus === 'function') {
        const health = this.connectionManager.getHealthStatus();
        connectionInfo = {
          ...connectionInfo,
          roundTripMs: health.roundTripMs,
          stability: health.stability,
          healthScore: health.healthScore || 0
        };
      } else if (typeof this.connectionManager.getLatency === 'function') {
        // Fallback to just latency if full health metrics aren't available
        this.connectionManager.getLatency().then(latency => {
          if (latency !== null) {
            connectionInfo.roundTripMs = latency;
          }
        }).catch(() => {
          // Ignore errors measuring latency
        });
      }
    } catch (e) {
      this.log('Error getting connection health info', e);
    }
    
    // Update device info with pairing info
    this.updateDeviceInfo({
      pairedUserId: userId,
      pairingCode: undefined,  // Clear pairing code after pairing
      status: 'paired'
    });
    
    // Emit paired event with connection info
    this.emit('device:paired', { 
      userId, 
      deviceId: this.deviceInfo?.deviceId,
      connectionInfo
    });
  }
  
  /**
   * Update device info
   * @param info New device info to merge with existing info
   */
  public updateDeviceInfo(info: Partial<DeviceInfo>): void {
    if (!this.deviceInfo) {
      this.deviceInfo = {
        deviceId: info.deviceId || this.generateDeviceId(),
        deviceType: info.deviceType || 'unknown',
        platform: info.platform || this.getPlatform(),
        userAgent: info.userAgent || this.getUserAgent(),
        ...info
      };
    } else {
      // Merge new info with existing info
      this.deviceInfo = {
        ...this.deviceInfo,
        ...info
      };
    }
    
    // Persist device info if caching enabled
    if (this.options.cacheDeviceInfo) {
      this.saveDeviceInfo();
    }
    
    this.emit('device:info:updated', { deviceInfo: this.deviceInfo });
  }
  
  /**
   * Handle content pushed to the device
   * @param content Content pushed to the device
   */
  public handleContentPush(content: any): void {
    if (!this.isRegistered()) {
      this.log('Cannot handle content push, device not registered');
      return;
    }
    
    this.emit('device:content:pushed', { content });
  }
  
  /**
   * Handle content updates for the device
   * @param update Content update for the device
   */
  public handleContentUpdate(update: any): void {
    if (!this.isRegistered()) {
      this.log('Cannot handle content update, device not registered');
      return;
    }
    
    this.emit('device:content:updated', { update });
  }
  
  /**
   * Handle commands sent to the device
   * @param command Command to execute
   * @param data Command data
   */
  public handleCommand(command: string, data: any): void {
    if (!this.isRegistered()) {
      this.log('Cannot handle command, device not registered');
      return;
    }
    
    this.emit('device:command', { command, data });
  }
  
  /**
   * Register event handler
   * @param event Event name
   * @param listener Event callback
   */
  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
  
  /**
   * Register one-time event handler
   * @param event Event name
   * @param listener Event callback
   */
  public once(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }
  
  /**
   * Remove event handler
   * @param event Event name
   * @param listener Event callback
   */
  public off(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }
  
  /**
   * Perform the device registration
   * @param options Registration options
   * @returns Promise resolving to device info if registration successful
   */
  private async performRegistration(
    options: DeviceRegistrationRequest
  ): Promise<DeviceInfo | null> {
    try {
      // Prepare device info for registration
      const deviceId = this.deviceInfo?.deviceId || this.loadDeviceId() || (this.options.generateIdIfNotExist ? this.generateDeviceId() : undefined);
      
      if (!deviceId && !this.options.generateIdIfNotExist) {
        throw new Error('No device ID available and generation disabled');
      }
      
      // Prepare device info
      const deviceInfo: DeviceInfo = {
        deviceId: deviceId!,
        deviceName: options.deviceName || this.deviceInfo?.deviceName || `Device ${deviceId!.substring(deviceId!.length - 6)}`,
        deviceType: options.deviceInfo?.deviceType || this.deviceInfo?.deviceType || 'display',
        platform: options.deviceInfo?.platform || this.deviceInfo?.platform || this.getPlatform(),
        userAgent: options.deviceInfo?.userAgent || this.deviceInfo?.userAgent || this.getUserAgent(),
        resolution: options.deviceInfo?.resolution || this.deviceInfo?.resolution || this.getResolution(),
        devicePixelRatio: options.deviceInfo?.devicePixelRatio || this.deviceInfo?.devicePixelRatio || this.getDevicePixelRatio(),
        ...options.deviceInfo
      };
      
      // Update device info
      this.updateDeviceInfo(deviceInfo);
      
      // --- ADDED: Log request details ---
      this.log(`[${this.serviceName}] 🚀 Attempting registration API call...`);
      const requestPayload = {
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName,
          deviceInfo // Send the full info object
      };
      this.log(`[${this.serviceName}]   Payload:`, requestPayload);
      
      // Register device with server
      const response = await this.connectionManager.post<DeviceRegistrationResponse>(
        '/api/devices/register',
        requestPayload
      );
      
      // --- ADDED: Log response details ---
      this.log(`[${this.serviceName}] ✅ Registration API response received:`, response);
      
      if (!response || !response.data || !response.data.deviceId || !response.data.token) {
        // --- ADDED: Log invalid response ---
        this.log(`[${this.serviceName}] ❌ Invalid registration response received from server.`);
        throw new Error('Invalid registration response from server');
      }
      
      // Store device ID and token
      this.log(`[${this.serviceName}] Storing token for device:`, response.data.deviceId);
      this.storeDeviceId(response.data.deviceId);
      this.tokenManager.setToken(response.data.token);
      
      // Update device info with server response
      if (response.data.deviceInfo) {
        this.log(`[${this.serviceName}] Updating device info with server data:`, response.data.deviceInfo);
        this.updateDeviceInfo(response.data.deviceInfo);
      } else {
        // Ensure the stored info reflects registration success even if server sent minimal info
        this.log(`[${this.serviceName}] No explicit deviceInfo in response, ensuring local state reflects registration.`);
        this.updateDeviceInfo({ status: 'registered' }); // Mark as registered locally
      }
      
      // If pairing code included, emit event
      if (response.data.pairingInfo?.pairingCode) {
        this.log(`[${this.serviceName}] Pairing code included in registration response:`, response.data.pairingInfo.pairingCode);
        // Ensure the correct event name is used
        this.emit('device:pairing:code', { pairingCode: response.data.pairingInfo.pairingCode }); 
      }
      
      // --- ADDED: Log before emitting registered event ---
      this.log(`[${this.serviceName}] Emitting device:registered event with info:`, this.deviceInfo);
      this.emit('device:registered', { deviceInfo: this.deviceInfo }); // Explicitly emit after success
      
      return this.deviceInfo;
    } catch (error) {
      // --- ADDED: Log registration error --- 
      this.log(`[${this.serviceName}] ❌ Registration API call failed:`, error);
      this.emit('device:registration:failed', { reason: String(error) }); // Emit failure event
      throw error; // Re-throw to be caught by the public register method
    }
  }
  
  /**
   * Store device ID in storage
   * @param deviceId Device ID to store
   */
  private storeDeviceId(deviceId: string): void {
    try {
      this.storage.setItem('device_id', deviceId);
    } catch (error) {
      this.log('Error storing device ID', error);
    }
  }
  
  /**
   * Load device ID from storage
   * @returns Stored device ID or null if not found
   */
  private loadDeviceId(): string | null {
    try {
      return this.storage.getItem('device_id') || 
             this.storage.getItem('vizora_device_id') || 
             null;
    } catch (error) {
      this.log('Error loading device ID', error);
      return null;
    }
  }
  
  /**
   * Generate a new device ID
   * @returns Generated device ID
   */
  private generateDeviceId(): string {
    const prefix = this.options.deviceIdPrefix || 'vizora-device-';
    const random = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now().toString(36);
    return `${prefix}${random}-${timestamp}`;
  }
  
  /**
   * Save device info to storage
   */
  private saveDeviceInfo(): void {
    if (!this.deviceInfo) {
      return;
    }
    
    try {
      this.storage.setItem(
        this.options.deviceStorageKey!,
        JSON.stringify(this.deviceInfo)
      );
    } catch (error) {
      this.log('Error saving device info', error);
    }
  }
  
  /**
   * Load device info from storage
   */
  private loadDeviceInfo(): void {
    try {
      const storedInfo = this.storage.getItem(this.options.deviceStorageKey!);
      
      if (storedInfo) {
        this.deviceInfo = JSON.parse(storedInfo);
      } else {
        // Try to load just the device ID
        const deviceId = this.loadDeviceId();
        
        if (deviceId) {
          this.deviceInfo = {
            deviceId,
            deviceType: 'display',
            platform: this.getPlatform(),
            userAgent: this.getUserAgent(),
            resolution: this.getResolution(),
            devicePixelRatio: this.getDevicePixelRatio()
          };
        }
      }
    } catch (error) {
      this.log('Error loading device info', error);
    }
  }
  
  /**
   * Set up connection event listeners
   */
  private setupConnectionListeners(): void {
    this.log('Setting up connection listeners...');

    // Define the single listener for connection state changes
    const handleConnectionStateChange = (diagnostics: ConnectionDiagnostics): void => {
      const newState = diagnostics.connectionState;
      // Only log if state actually changes
      if (newState !== this.previousConnectionState) {
          this.log(`Connection state changed: ${this.previousConnectionState} -> ${newState}`);

          // Handle state transitions
          if (newState === DiagnosticConnectionState.CONNECTED) { // Use Enum member
            this.handleConnect();
          }
          if (newState === DiagnosticConnectionState.DISCONNECTED) { // Use Enum member
            // Pass a generic reason or try to infer from diagnostics if possible
            this.handleDisconnect('State changed to disconnected');
          }
          // Remove the incorrect 'reconnecting' check
          // if (newState === 'reconnecting' && this.previousConnectionState !== 'reconnecting') {
          //   // Maybe trigger some UI indication
          //   this.log('Connection manager is attempting to reconnect...');
          // }

          this.previousConnectionState = newState; // Update previous state
      }
    };

    // Attach the listener and store the unsubscribe function
    if (this.connectionStateUnsubscribeFn) {
        this.log('Warning: Unsubscribing existing connection state listener before attaching new one.');
        this.connectionStateUnsubscribeFn(); // Ensure no duplicates if called multiple times
    }
    this.connectionStateUnsubscribeFn = this.connectionManager.onConnectionStateChange(handleConnectionStateChange);
    this.log('Attached ConnectionStateChange listener and stored unsubscribe function.');

    // Get initial state
    const initialDiagnostics = this.connectionManager.getDiagnostics();
    this.previousConnectionState = initialDiagnostics.connectionState;
    this.log(`Initial connection state: ${this.previousConnectionState}`);
    if (this.previousConnectionState === 'connected') {
        this.handleConnect(); // Handle initial connected state
    }

    // Get socket and set up event listeners
    const socket = this.connectionManager.getSocket();
    
    if (socket) {
      this.log('Attaching direct socket event listeners...');
      socket.on('device:paired', this.handleDevicePaired);
      socket.on('device:pairing:failed', this.handlePairingFailed);
      socket.on('device:content:pushed', this.handleContentPush);
      socket.on('device:content:updated', this.handleContentUpdate);
      socket.on('device:command', this.handleCommand);
      socket.on('device:error', this.handleDeviceError);
      socket.on('connect_error', this.handleConnectError);
      socket.on('reconnect_error', this.handleReconnectError);
    } else {
        this.log('Socket not available during setupConnectionListeners, cannot attach socket listeners.');
    }
  }
  
  /**
   * Get platform information
   * @returns Platform information
   */
  private getPlatform(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.platform || 'unknown';
    }
    return 'unknown';
  }
  
  /**
   * Get user agent information
   * @returns User agent information
   */
  private getUserAgent(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent || 'unknown';
    }
    return 'unknown';
  }
  
  /**
   * Get screen resolution
   * @returns Screen resolution
   */
  private getResolution(): string {
    if (typeof window !== 'undefined' && window.screen) {
      return `${window.screen.width}x${window.screen.height}`;
    }
    return 'unknown';
  }
  
  /**
   * Get device pixel ratio
   * @returns Device pixel ratio
   */
  private getDevicePixelRatio(): number {
    if (typeof window !== 'undefined') {
      return window.devicePixelRatio || 1;
    }
    return 1;
  }
  
  /**
   * Log a message with service prefix
   * @param message Log message
   * @param args Additional arguments
   */
  private log(message: string, ...args: any[]): void {
    if (typeof console !== 'undefined') {
      console.log(`[${this.serviceName}] ${message}`, ...args);
    }
  }
  
  /**
   * Set the pairing confirmed status
   * @param confirmed Whether the device is paired with a user
   */
  public setPairingConfirmed(confirmed: boolean): void {
    this.log(`Setting pairing confirmed: ${confirmed}`);
    
    if (!this.isRegistered()) {
      this.log('Cannot set pairing confirmed, device not registered');
      return;
    }
    
    // Update device info with pairing info
    this.updateDeviceInfo({
      pairedUserId: confirmed ? (this.deviceInfo?.pairedUserId || 'unknown') : undefined,
      status: confirmed ? 'paired' : 'registered'
    });
    
    if (confirmed) {
      this.emit('device:paired', { 
        userId: this.deviceInfo?.pairedUserId || 'unknown',
        displayId: this.deviceInfo?.deviceId
      });
    }
  }

  // --- Connection Event Handlers (Refactored for single state change listener) ---

  // Called when state becomes 'connected'
  private handleConnect = (): void => {
    this.log('Connection established (via state change).');
    // Potentially re-register or verify state on connect
    if (!this.isRegistered() && this.options.autoRegister) {
      this.log('Attempting auto-registration on connect...');
      this.register(); // No await needed, runs in background
    }
    // If already registered, maybe verify status with backend?
  };

  // Called when state becomes 'disconnected'
  private handleDisconnect = (reason: string): void => {
    this.log(`Connection lost (via state change): ${reason}`);
    // Update status or handle offline state
  };

  // Note: handleReconnect might not be directly callable from state changes,
  // reconnection attempts are managed by ConnectionManager.
  // The state will transition connected -> disconnected -> reconnecting -> connected.

  // --- Direct Socket Event Handlers (Implementations likely needed) ---
  private handleDevicePaired = (data: { userId: string }): void => {
    this.log(`Received device:paired event with userId: ${data.userId}`);
    this.confirmPairing(data.userId);
  };

  private handlePairingFailed = (data: { reason: string }): void => {
    this.log(`Received device:pairing:failed event: ${data.reason}`);
    this.emit('device:pairing:failed', data);
  };

  private handleDeviceError = (data: { error: any; context?: string }): void => {
      this.log(`Received device:error event. Context: ${data.context}`, data.error);
      this.emit('device:error', data);
  };

  private handleConnectError = (error: Error): void => {
      this.log('Received connect_error event:', error);
      this.emit('device:error', { error, context: 'connection' });
  };

  private handleReconnectError = (error: Error): void => {
      this.log('Received reconnect_error event:', error);
      this.emit('device:error', { error, context: 'reconnection' });
  };

  /**
   * Clean up listeners and resources used by the DeviceManager.
   * Should be called when the manager is no longer needed.
   */
  public cleanup(): void {
    this.log('Cleaning up DeviceManager listeners...');
    // Call the stored unsubscribe function
    if (this.connectionStateUnsubscribeFn) {
      this.connectionStateUnsubscribeFn();
      this.log('Called ConnectionStateChange unsubscribe function.');
      this.connectionStateUnsubscribeFn = null;
    }
    // if (this.connectionStateChangeListener) {
    //   this.connectionManager.offConnectionStateChange(this.connectionStateChangeListener);
    //   this.log('Removed ConnectionStateChange listener.');
    //   this.connectionStateChangeListener = null;
    // }

    // Remove direct socket listeners if socket is still available
    const socket = this.connectionManager.getSocket();
    if (socket) {
      socket.off('device:paired', this.handleDevicePaired);
      socket.off('device:pairing:failed', this.handlePairingFailed);
      socket.off('device:content:pushed', this.handleContentPush);
      socket.off('device:content:updated', this.handleContentUpdate);
      socket.off('device:command', this.handleCommand);
      socket.off('device:error', this.handleDeviceError);
      socket.off('connect_error', this.handleConnectError);
      socket.off('reconnect_error', this.handleReconnectError);
      this.log('Removed direct socket event listeners.');
    }
    this.removeAllListeners(); // Remove listeners attached via this.on()
  }
} 