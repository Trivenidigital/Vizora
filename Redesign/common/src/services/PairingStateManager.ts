/**
 * PairingStateManager
 * 
 * Centralizes device registration, verification, and pairing state transitions
 * across VizoraTV and Middleware applications.
 * 
 * Responsibilities:
 * - Manage and persist state transitions (deviceId, isRegistered, isPaired, socketState)
 * - Abstract retry logic and throttling (with configurable delay settings)
 * - Expose observables (via EventEmitter) to notify consumers like PairingScreen
 * - Validate prerequisites before attempting pairing
 * - Provide clean cancellation, cleanup, and re-initialization
 */

import EventEmitter from 'eventemitter3';
import { Socket } from 'socket.io-client';
import { ConnectionManager, ConnectionState, ConnectionDiagnostics, DiagnosticConnectionState } from './ConnectionManager';
import { DeviceManager, DeviceInfo } from './DeviceManager';

// State transition constants (replacing enums)
export const RegistrationState = {
  UNREGISTERED: 'UNREGISTERED',
  REGISTERING: 'REGISTERING',
  REGISTERED: 'REGISTERED',
  VERIFYING: 'VERIFYING',
  REGISTRATION_ERROR: 'REGISTRATION_ERROR',
  THROTTLED: 'THROTTLED'
} as const;
export type RegistrationState = (typeof RegistrationState)[keyof typeof RegistrationState];

export const PairingState = {
  IDLE: 'IDLE',
  REQUESTING: 'REQUESTING',
  ACTIVE: 'ACTIVE',
  PAIRED: 'PAIRED',
  EXPIRED: 'EXPIRED',
  THROTTLED: 'THROTTLED',
  ERROR: 'ERROR'
} as const;
export type PairingState = (typeof PairingState)[keyof typeof PairingState];

// Event type constants (replacing enums)
export const PairingEvent = {
  REGISTRATION_STATE_CHANGED: 'registrationStateChanged',
  PAIRING_STATE_CHANGED: 'pairingStateChanged',
  DEVICE_ID_CHANGED: 'deviceIdChanged',
  PAIRING_CODE_GENERATED: 'pairingCodeGenerated',
  PAIRING_CODE_EXPIRED: 'pairingCodeExpired',
  PAIRING_ERROR: 'pairingError',
  PAIRING_THROTTLED: 'pairingThrottled',
  RETRY_ATTEMPT: 'retryAttempt',
  CIRCUIT_BREAKER_TRIPPED: 'circuitBreakerTripped',
  STATE_CHANGE: 'stateChange'
} as const;
export type PairingEvent = (typeof PairingEvent)[keyof typeof PairingEvent];

// Configuration options
export interface PairingStateManagerOptions {
  maxRetries?: number;
  initialBackoff?: number;
  maxBackoff?: number;
  jitterFactor?: number;
  apiService?: any;
  debug?: boolean;
  retryDelayMs?: number;
  maxRetryAttempts?: number;
  throttleMs?: number;
  pairingCodeExpiryMs?: number;
}

// Error code constants (replacing enums)
export const PairingErrorCode = {
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_DEVICE_ID: 'INVALID_DEVICE_ID',
  SOCKET_NOT_CONNECTED: 'SOCKET_NOT_CONNECTED',
  DEVICE_NOT_REGISTERED: 'DEVICE_NOT_REGISTERED',
  REGISTRATION_FAILED: 'REGISTRATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  COORDINATION_FAILED: 'COORDINATION_FAILED',
  PAIRING_CODE_GENERATION_FAILED: 'PAIRING_CODE_GENERATION_FAILED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED'
} as const;
export type PairingErrorCode = (typeof PairingErrorCode)[keyof typeof PairingErrorCode];

// Structured error interface
export interface PairingError {
  code: PairingErrorCode;
  message: string;
  details?: any;
}

// Combined state interface for the manager
export interface PairingManagerState {
  deviceId: string | null;
  socketId: string | null;
  registrationState: RegistrationState;
  pairingState: PairingState;
  pairingCode: string | null;
  pairingCodeExpiry: number | null;
  pairingUrl: string | null;
  retryCount: number;
  throttledUntil: number | null;
  error: PairingError | null;
  deviceRegistrationVerified: boolean;
  qrCodeUrl?: string | null;
  circuitBreakerTripped: boolean;
  lastError?: PairingError | null;
  lastServerVerification: number;
}

/**
 * PairingStateManager Class
 * 
 * Centralizes device registration, verification, and pairing state transitions
 * across VizoraTV and Middleware applications.
 */
export class PairingStateManager extends EventEmitter {
  // Default configuration values
  private static readonly DEFAULT_RETRY_DELAY_MS = 5000;
  private static readonly DEFAULT_MAX_RETRY_ATTEMPTS = 5;
  private static readonly DEFAULT_THROTTLE_MS = 30000; // 30 seconds
  private static readonly DEFAULT_PAIRING_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
  public static readonly SERVER_VERIFICATION_THROTTLE_MS = 30000; // 30 seconds between server verification checks
  
  // State
  private state: PairingManagerState = {
    deviceId: null,
    socketId: null,
    registrationState: RegistrationState.UNREGISTERED,
    pairingState: PairingState.IDLE,
    pairingCode: null,
    pairingCodeExpiry: null,
    pairingUrl: null,
    retryCount: 0,
    throttledUntil: null,
    error: null,
    deviceRegistrationVerified: false,
    circuitBreakerTripped: false,
    lastServerVerification: 0
  };
  
  // Dependencies
  private deviceManager: DeviceManager;
  private connectionManager: ConnectionManager;
  
  // Configuration
  private options: Required<PairingStateManagerOptions>;
  private logPrefix: string;
  
  // Timers and controllers
  private pairingCodeExpiryTimer: NodeJS.Timeout | number | null = null;
  private retryTimer: NodeJS.Timeout | number | null = null;
  private abortController = new AbortController();
  private operationInProgress = false;
  
  // --- Re-add Handler Property Declarations ---
  // These properties will hold the bound versions of the private methods
  private handleConnectionStateChange: (diagnostics: ConnectionDiagnostics) => void;
  private handleConnectionError: (error: Error) => void;
  private handleDeviceRegistered: (data: { deviceInfo: DeviceInfo }) => void;
  private handleDeviceRegistrationFailed: (data: { reason: string }) => void;
  private handleConnect: () => void;
  // Add declarations for any other bound handlers if needed
  
  /**
   * Resolve provided options with defaults
   */
  private resolveOptions(options: Partial<PairingStateManagerOptions>): Required<PairingStateManagerOptions> {
    // Define defaults here, ensure property names match the interface
    const defaults: Required<PairingStateManagerOptions> = {
      debug: false,
      maxRetries: PairingStateManager.DEFAULT_MAX_RETRY_ATTEMPTS,
      initialBackoff: PairingStateManager.DEFAULT_RETRY_DELAY_MS,
      maxBackoff: PairingStateManager.DEFAULT_THROTTLE_MS,
      jitterFactor: 0.3, // Default jitter factor
      apiService: null, // Default null for optional API service
      retryDelayMs: PairingStateManager.DEFAULT_RETRY_DELAY_MS,
      maxRetryAttempts: PairingStateManager.DEFAULT_MAX_RETRY_ATTEMPTS,
      throttleMs: PairingStateManager.DEFAULT_THROTTLE_MS,
      pairingCodeExpiryMs: PairingStateManager.DEFAULT_PAIRING_CODE_EXPIRY_MS,
      // Add defaults for any other options in PairingStateManagerOptions
    };
    // Merge provided options with defaults
    return { ...defaults, ...options };
  }
  
  /**
   * Set up event listeners for connection and device manager
   */
  private setupEventListeners(): void {
    this.log('info', 'Attaching event listeners...');
    // Ensure the connectionManager instance actually has the method before calling
    if (typeof this.connectionManager?.onConnectionStateChange !== 'function') {
      this.log('error', 'ConnectionManager instance is missing onConnectionStateChange method!', this.connectionManager);
      // Optionally throw or handle this critical error
      return; 
    }
    this.connectionManager.onConnectionStateChange(this.handleConnectionStateChange);
    this.connectionManager.on('error', this.handleConnectionError);
    this.deviceManager.on('device:registered', this.handleDeviceRegistered);
    this.deviceManager.on('device:registration:failed', this.handleDeviceRegistrationFailed);
    this.connectionManager.on('connect', this.handleConnect);
    this.log('info', `'connect' listener attached to ConnectionManager`);
  }
  
  /**
   * Perform initial checks based on current state after constructor setup
   */
  private checkInitialState(): void {
    this.log('info', 'Performing initial state checks...');
    // TEMPORARILY COMMENT OUT to isolate persistent error
    // if (this.state.registrationState === RegistrationState.VERIFYING) {
    //  this.log('info', '[checkInitialState] Initial state VERIFYING, attempting verification...');
    //  this.verifyDeviceRegistration(); // Don't call immediately
    // }
    this.log('info', '[checkInitialState] Initial checks complete (verification deferred).');
    // Add other relevant initial checks if needed
  }
  
  /**
   * Logging utility that respects debug flag
   */
  private log(level: 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (!this.options.debug && level === 'info') return; // Only log info if debug is true

    const logFunc = console[level] || console.log;
    logFunc(`${this.logPrefix} ${message}`, ...args);
  }
  
  /**
   * Creates a new PairingStateManager instance
   * @param deviceId Optional initial device ID
   * @param connectionManager Connection manager instance
   * @param deviceManager Device manager instance
   * @param options Configuration options
   */
  constructor(
    deviceId: string | null,
    connectionManager: ConnectionManager,
    deviceManager: DeviceManager,
    options: Partial<PairingStateManagerOptions> = {}
  ) {
    super();

    // 1. Assign Dependencies
    this.connectionManager = connectionManager;
    this.deviceManager = deviceManager;

    // 2. Resolve Options
    this.options = this.resolveOptions(options);

    // 3. Initialize Logger
    this.logPrefix = '[PairingStateManager]';

    // 4. Define and Bind Handlers to the Class Properties
    this.handleConnectionStateChange = this._handleConnectionStateChange.bind(this);
    this.handleConnectionError = this._handleConnectionError.bind(this);
    this.handleDeviceRegistered = this._handleDeviceRegistered.bind(this);
    this.handleDeviceRegistrationFailed = this._handleDeviceRegistrationFailed.bind(this);
    this.handleConnect = this._handleConnect.bind(this);
    // Bind any other handlers needed

    // 5. Initialize State
    this.state = {
      deviceId: deviceId,
      socketId: this.connectionManager.getSocketId(),
      registrationState: deviceId ? RegistrationState.VERIFYING : RegistrationState.UNREGISTERED,
      pairingState: PairingState.IDLE,
      pairingCode: null,
      pairingCodeExpiry: null,
      pairingUrl: null,
      retryCount: 0,
      throttledUntil: null,
      error: null,
      deviceRegistrationVerified: false,
      qrCodeUrl: null,
      circuitBreakerTripped: false,
      lastError: null,
      lastServerVerification: 0,
    };

    // 6. Set Up Listeners (Uses the bound handler properties)
    this.log('info', 'Initializing with options:', this.options);
    this.log('info', 'Initial state:', { ...this.state });
    // this.setupEventListeners(); // Do not call here anymore

    // 7. Initial Sync/Checks
    this.checkInitialState();
  }
  
  /**
   * Initializes the event listeners. Should be called after instantiation
   * when the real dependencies are confirmed to be available.
   */
  public initializeListeners(): void {
    this.log('info', 'Explicitly initializing event listeners...');
    this.setupEventListeners();
    // Potentially call checkInitialState here if it depends on listeners being active
    // this.checkInitialState(); 
  }
  
  /**
   * Update the registration state and emit appropriate events
   */
  private updateRegistrationState(newState: RegistrationState): void {
    if (this.state.registrationState !== newState) {
      this.log('info', `Registration state changed: ${this.state.registrationState} -> ${newState}`);
      
      this.state.registrationState = newState;
      
      this.emit(PairingEvent.REGISTRATION_STATE_CHANGED, newState);
      this.emit(PairingEvent.STATE_CHANGE, this.getState());
    }
  }
  
  /**
   * Update the pairing state and emit appropriate events
   */
  private updatePairingState(newState: PairingState): void {
    if (this.state.pairingState !== newState) {
      this.log('info', `Pairing state changed: ${this.state.pairingState} -> ${newState}`);
      
      this.state.pairingState = newState;
      
      this.emit(PairingEvent.PAIRING_STATE_CHANGED, newState);
      this.emit(PairingEvent.STATE_CHANGE, this.getState());
    }
  }
  
  /**
   * Set an error and emit appropriate events
   */
  private setError(code: PairingErrorCode, message: string, data?: any): void {
    const newError: PairingError = { code, message, details: data };
    this.state.error = newError;
    this.state.lastError = newError;
    this.log('error', `Error: [${code}] ${message}`, data);
    
    this.emit(PairingEvent.PAIRING_ERROR, newError);
    this.emit(PairingEvent.STATE_CHANGE, this.getState());
    
    // If we hit max retries, trip the circuit breaker
    if (code === PairingErrorCode.CIRCUIT_BREAKER_OPEN || code === PairingErrorCode.MAX_RETRIES_EXCEEDED) {
      this.tripCircuitBreaker();
    }
  }
  
  /**
   * Clear the current error
   */
  public clearError(): void {
    this.state.error = null;
    this.state.lastError = null;
    this.emit(PairingEvent.STATE_CHANGE, this.getState());
  }
  
  /**
   * Trip the circuit breaker to prevent further automatic retries
   */
  private tripCircuitBreaker(): void {
    if (!this.state.circuitBreakerTripped) {
      this.state.circuitBreakerTripped = true;
      this.log('warn', 'Circuit breaker tripped - automatic retries disabled');
      this.emit(PairingEvent.CIRCUIT_BREAKER_TRIPPED, {});
      this.emit(PairingEvent.STATE_CHANGE, this.getState());
    }
  }
  
  /**
   * Schedule a retry after a delay
   * @param operation Function to retry
   * @param delayOverrideMs Optional override for the retry delay
   */
  private scheduleRetry(operation: () => Promise<any>, delayOverrideMs?: number): void {
    // Don't schedule if circuit breaker is tripped
    if (this.state.circuitBreakerTripped) {
      this.log('warn', 'Retry canceled - circuit breaker tripped');
      return;
    }
    
    // Don't schedule if we've hit max retries
    if (this.state.retryCount >= this.options.maxRetryAttempts!) {
      this.log('warn', `Maximum retry attempts (${this.options.maxRetryAttempts}) reached`);
      this.setError(
        PairingErrorCode.MAX_RETRIES_EXCEEDED,
        'Max retries exceeded'
      );
      return;
    }
    
    // Calculate delay with exponential backoff
    const retryDelay = delayOverrideMs ?? Math.min(
      this.options.retryDelayMs * Math.pow(1.5, this.state.retryCount),
      30000 // Max 30 seconds
    );
    
    this.log('info', `Scheduling retry in ${retryDelay}ms (attempt ${this.state.retryCount + 1}/${this.options.maxRetryAttempts})`);
    
    // Clear existing timer if any
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer as any);
    }
    
    // Schedule the retry
    this.retryTimer = setTimeout(async () => {
      if (!this.state.circuitBreakerTripped) {
        try {
          await operation(); // Await the Promise<any>
        } catch (error) {
          this.log('error', 'Retry operation failed:', error);
        }
      }
    }, retryDelay);
  }
  
  /**
   * Set up a pairing code expiry timer
   */
  private setupPairingCodeExpiryTimer(): void {
    // Clear existing timer if any
    if (this.pairingCodeExpiryTimer !== null) {
      clearTimeout(this.pairingCodeExpiryTimer as any);
      this.pairingCodeExpiryTimer = null;
    }
    
    if (!this.state.pairingCode) {
      return;
    }
    
    // Calculate expiry time
    const expiryTime = Date.now() + this.options.pairingCodeExpiryMs;
    this.state.pairingCodeExpiry = expiryTime;
    
    this.log('info', `Setting up pairing code expiry timer for ${this.options.pairingCodeExpiryMs}ms`);
    
    // Set up new timer
    this.pairingCodeExpiryTimer = setTimeout(() => {
      this.log('info', 'Pairing code expired');
      this.onPairingCodeExpired();
      this.pairingCodeExpiryTimer = null;
    }, this.options.pairingCodeExpiryMs);
  }
  
  /**
   * Handle pairing code expiration
   */
  private onPairingCodeExpired(): void {
    this.state.pairingCode = null;
    this.state.pairingCodeExpiry = null;
    this.updatePairingState(PairingState.EXPIRED);
    this.emit(PairingEvent.PAIRING_CODE_EXPIRED);
  }
  
  /**
   * Check if the device ID is valid
   */
  private isValidDeviceId(deviceId: string | null): boolean {
    this.log('info', `[isValidDeviceId] Checking ID: ${deviceId}`);
    if (!deviceId) {
      this.log('info', '[isValidDeviceId] Result: false (null/empty)');
      return false;
    }

    // Check for vtv- prefix format (e.g., vtv-mfljzzq8-m9d4cdaj)
    if (deviceId.startsWith('vtv-')) {
      const isValid = /^vtv-[a-zA-Z0-9]{8}-[a-zA-Z0-9]{8}$/.test(deviceId);
      this.log('info', `[isValidDeviceId] Result: ${isValid} (vtv format)`);
      return isValid;
    }

    // Check for 6-character alphanumeric format (e.g., A1B2C3)
    const isValid = /^[A-Z0-9]{6}$/.test(deviceId);
    this.log('info', `[isValidDeviceId] Result: ${isValid} (6-char format)`);
    return isValid;
  }
  
  /**
   * Calculate throttle expiry time
   */
  private calculateThrottleExpiry(): number {
    return Date.now() + this.options.throttleMs;
  }
  
  /**
   * Check if an operation is currently throttled
   */
  private isThrottled(): boolean {
    return !!this.state.throttledUntil && Date.now() < this.state.throttledUntil;
  }
  
  /**
   * Apply throttling and emit appropriate events
   */
  private applyThrottle(): void {
    const throttleExpiry = this.calculateThrottleExpiry();
    this.state.throttledUntil = throttleExpiry;
    
    this.log('warn', `Throttling until ${new Date(throttleExpiry).toLocaleTimeString()}`);
    
    this.emit(PairingEvent.PAIRING_THROTTLED, { until: throttleExpiry });
    this.emit(PairingEvent.STATE_CHANGE, this.getState());
  }
  
  /**
   * Check if socket is connected and ready for operations
   */
  private isSocketReady(): boolean {
    const ready = this.connectionManager.isConnected() && !!this.connectionManager.getSocketId();
    if (!ready) {
      this.log('warn', 'Socket not ready check failed', { connected: this.connectionManager.isConnected(), socketId: this.connectionManager.getSocketId() });
    }
    return ready;
  }
  
  /**
   * Check if we need to verify registration with the server
   */
  private shouldVerifyWithServer(): boolean {
    // If we've never verified, we should verify
    if (this.state.lastServerVerification === null) {
      return true;
    }
    
    // If it's been a while since we last verified, we should verify again
    const timeSinceLastVerification = Date.now() - this.state.lastServerVerification;
    return timeSinceLastVerification > PairingStateManager.SERVER_VERIFICATION_THROTTLE_MS;
  }
  
  /**
   * Get the current state of the pairing manager
   */
  public getState(): PairingManagerState {
    return { ...this.state };
  }
  
  /**
   * Initialize or get the device ID
   * @param isAlreadyRegistered Whether the device registration was already verified
   * @returns Promise resolving to the device ID or rejecting with an error
   */
  public async initializeDeviceId(isAlreadyRegistered: boolean): Promise<string> {
    const currentId = this.state.deviceId;
    
    // If we already have a valid device ID, return it
    if (currentId && this.isValidDeviceId(currentId)) {
      this.log('info', `Using existing device ID: ${currentId}`);
      // Ensure state reflects known registration status
      if (isAlreadyRegistered && this.state.registrationState !== RegistrationState.REGISTERED) {
          this.log('info', '[initializeDeviceId] Updating state for existing ID based on provided status: REGISTERED');
          this.updateRegistrationState(RegistrationState.REGISTERED);
          this.state.deviceRegistrationVerified = true;
      } else if (!isAlreadyRegistered && this.state.registrationState === RegistrationState.REGISTERED) {
          this.log('warn', '[initializeDeviceId] WARNING: Existing ID but provided status is NOT registered. Setting to VERIFYING.');
          this.updateRegistrationState(RegistrationState.VERIFYING);
          this.verifyDeviceRegistration();
      }
      return currentId;
    }
    
    // Abort any existing operations
    this.abortController.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    
    this.updateRegistrationState(RegistrationState.REGISTERING);
    this.log('info', 'Initializing device ID (no valid current ID found)');
    
    try {
      // Use DeviceManager to get/generate ID
      let deviceId: string | null = await this.deviceManager.getDeviceInfo()?.deviceId || null; // Allow null initially
      if (!deviceId) {
           this.log('warn', '[initializeDeviceId] No device ID from getDeviceInfo, attempting registration to generate...');
           const regResult = await this.deviceManager.register({});
           if (regResult && regResult.deviceId) {
                deviceId = regResult.deviceId; // Assign if valid string
                this.log('info', '[initializeDeviceId] Generated device ID via register:', deviceId);
                isAlreadyRegistered = true;
           } else {
                // Handle case where registration didn't return an ID
                throw new Error('Could not retrieve or generate a device ID via DeviceManager');
           }
      }

      // Now deviceId is either the original valid string or the newly generated one
      if (!deviceId) { // This check might be redundant now but safe
          throw new Error('Could not retrieve or generate a device ID via DeviceManager');
      }
      if (!this.isValidDeviceId(deviceId)) throw new Error(`Invalid device ID: ${deviceId}`);
      
      this.state.deviceId = deviceId as string;
      this.log('info', 'Device ID initialized:', deviceId);
      this.emit(PairingEvent.DEVICE_ID_CHANGED, deviceId as string);
      
      // --- Use the passed-in registration status --- 
      this.log('info', `[initializeDeviceId] Checking registration status provided: ${isAlreadyRegistered}`);
      if (isAlreadyRegistered) {
        this.log('info', '[initializeDeviceId] Branch taken: isAlreadyRegistered = true. Setting state to REGISTERED.');
        // Only update if not already registered to avoid redundant events
        if (this.state.registrationState !== RegistrationState.REGISTERED) { 
            this.updateRegistrationState(RegistrationState.REGISTERED);
        }
        this.state.deviceRegistrationVerified = true;
      } else {
        this.log('info', '[initializeDeviceId] Branch taken: isAlreadyRegistered = false. Setting state to VERIFYING.');
        // Only update if not already verifying to avoid redundant events
        if (this.state.registrationState !== RegistrationState.VERIFYING) {
             this.updateRegistrationState(RegistrationState.VERIFYING);
        }
        // Trigger verification since the initial status check failed
        this.verifyDeviceRegistration(); 
      }
      
      return deviceId as string;
    } catch (error: any) {
       if (signal.aborted) {
         this.log('info', 'Device ID initialization aborted');
         throw new Error('Device ID initialization aborted');
       }
       this.updateRegistrationState(RegistrationState.REGISTRATION_ERROR);
       this.setError(
         PairingErrorCode.INVALID_DEVICE_ID,
         error.message || 'Failed to initialize device ID',
         error
       );
       this.scheduleRetry(() => this.initializeDeviceId(isAlreadyRegistered)); // Pass status to retry
       throw error;
    }
  }
  
  /**
   * Connect the socket using the device ID
   * @returns Promise resolving when connected or rejecting with an error
   */
  public async connectSocket(): Promise<void> {
    // Ensure we have a valid device ID
    if (!this.state.deviceId || !this.isValidDeviceId(this.state.deviceId)) {
      this.setError(
        PairingErrorCode.INVALID_DEVICE_ID,
        'Cannot connect socket without a valid device ID'
      );
      throw new Error('Cannot connect socket without a valid device ID');
    }
    
    // If we're already connected, just return
    if (this.isSocketReady()) {
      this.log('info', 'Socket already connected and ready');
      return;
    }
    
    this.log('info', `Connecting socket with device ID: ${this.state.deviceId}`);
    
    try {
      await this.connectionManager.connect();
      this.log('info', 'Socket connected successfully');
    } catch (error: any) {
      this.setError(
        PairingErrorCode.SOCKET_NOT_CONNECTED,
        error.message || 'Failed to connect socket',
        error
      );
      
      // Schedule a retry if appropriate
      this.scheduleRetry(() => this.connectSocket());
      
      throw error;
    }
  }
  
  /**
   * Verify device registration with the server
   * @param forceCheck Force a check regardless of throttling
   * @returns Promise resolving to boolean indicating if device is registered
   */
  public async verifyDeviceRegistration(forceCheck = false): Promise<boolean> {
    this.log('info', `[verifyDeviceRegistration] Method start. Current state: ${this.state.registrationState}, Device ID: ${this.state.deviceId}`);

    const isIdValid = this.state.deviceId && this.isValidDeviceId(this.state.deviceId);
    this.log('info', `[verifyDeviceRegistration] Running initial ID check. Is ID Valid? ${isIdValid}`);

    if (!isIdValid) {
        // ADD MORE LOGGING HERE
        this.log('warn', `[verifyDeviceRegistration] <<< ENTERED INVALID ID BLOCK >>>`);
        this.log('warn', `[verifyDeviceRegistration] Current ID: ${this.state.deviceId}`);
        this.log('warn', `[verifyDeviceRegistration] isValidDeviceId result: ${this.isValidDeviceId(this.state.deviceId)}`);
        this.log('warn', `[verifyDeviceRegistration] >>> EXITING VIA RETURN FALSE <<<`);
        return false; // Stop verification if ID is invalid.
    }
    this.log('info', '[verifyDeviceRegistration] <<< PASSED INITIAL ID CHECK BLOCK >>>');

    if (!this.isSocketReady()) {
      this.log('warn', '[verifyDeviceRegistration] Socket not ready, scheduling retry.');
      // Set state to VERIFYING if not already, so retry happens
      if(this.state.registrationState !== RegistrationState.VERIFYING) {
        this.updateRegistrationState(RegistrationState.VERIFYING);
      }
      this.scheduleRetry(() => this.verifyDeviceRegistration(forceCheck));
      return false; // Indicate verification couldn't complete now
    }
    this.log('info', '[verifyDeviceRegistration] Passed socket ready check.');

    if (!forceCheck && this.state.deviceRegistrationVerified && !this.shouldVerifyWithServer()) {
      this.log('info', 'Skipping server verification, using cached status.');
      return true;
    }
    
    this.log('info', `Verifying device registration for ID: ${this.state.deviceId}`);
    
    // Abort any existing operations
    this.abortController.abort();
    this.abortController = new AbortController();
    
    try {
      this.log('info', '[verifyDeviceRegistration] Performing simulated verification...');
      // In a real scenario, this would involve an API call. 
      // The error might be coming from a failed API call or a logic error here.
      // For now, we'll assume the simulation works if checks passed.
      const verificationResult = true; // Placeholder
      this.log('info', `[verifyDeviceRegistration] Simulated verification result: ${verificationResult}`);

      this.state.lastServerVerification = Date.now();
      if (verificationResult) {
        this.state.deviceRegistrationVerified = true;
        // Only update state if it wasn't already REGISTERED
        if (this.state.registrationState !== RegistrationState.REGISTERED) {
             this.log('info', `[verifyDeviceRegistration] Verification successful. Updating state ${this.state.registrationState} -> REGISTERED`);
             this.updateRegistrationState(RegistrationState.REGISTERED);
        } else {
            this.log('info', `[verifyDeviceRegistration] Verification successful, but state already REGISTERED. No update.`);
        }
      } else {
        this.state.deviceRegistrationVerified = false;
        // Only update state if it wasn't already UNREGISTERED or ERROR
        if (this.state.registrationState !== RegistrationState.UNREGISTERED && 
            this.state.registrationState !== RegistrationState.REGISTRATION_ERROR) {
             this.log('info', `[verifyDeviceRegistration] Verification failed. Updating state ${this.state.registrationState} -> UNREGISTERED`);
             this.updateRegistrationState(RegistrationState.UNREGISTERED); // Or REGISTRATION_ERROR?
        } else {
             this.log('info', `[verifyDeviceRegistration] Verification failed, but state already UNREGISTERED/ERROR. No update.`);
        }
      }
      return verificationResult;
    } catch (error: any) {
      this.log('error', 'Error during simulated verification:', error);
      this.updateRegistrationState(RegistrationState.REGISTRATION_ERROR);
      // FIX: Check if setError exists before calling it
      if (typeof this.setError === 'function') { 
        this.setError(PairingErrorCode.VERIFICATION_FAILED, `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } else {
        this.log('error', 'setError method not found on this instance!');
      }
      return false;
    }
  }
  
  /**
   * Register the device with the server
   * @returns Promise resolving when registered or rejecting with an error
   */
  public async registerDevice(): Promise<void> {
    // Ensure we have a valid device ID
    if (!this.state.deviceId || !this.isValidDeviceId(this.state.deviceId)) {
      console.error('PairingStateManager: ❌ Cannot register without a valid device ID');
      this.setError(
        PairingErrorCode.INVALID_DEVICE_ID,
        'Cannot register without a valid device ID'
      );
      throw new Error('Cannot register without a valid device ID');
    }
    
    // Get the socket ID for logging
    const socketId = this.connectionManager.getSocketId();
    
    // Check if socket is connected
    if (!this.isSocketReady()) {
      console.error('PairingStateManager: ❌ Cannot register without a connected socket');
      console.error('PairingStateManager: 📋 Socket details:', { 
        socketId,
        connected: this.connectionManager.isConnected()
      });
      
      this.setError(
        PairingErrorCode.SOCKET_NOT_CONNECTED,
        'Cannot register without a connected socket'
      );
      throw new Error('Cannot register without a connected socket');
    }
    
    // Skip if already registered
    if (this.state.registrationState === RegistrationState.REGISTERED) {
      console.log('PairingStateManager: ✅ Device already registered, skipping registration');
      return;
    }
    
    // Check if we're throttled
    if (this.isThrottled()) {
      const remainingMs = this.state.throttledUntil! - Date.now();
      console.warn(`PairingStateManager: ⏳ Registration throttled, retry in ${Math.ceil(remainingMs / 1000)}s`);
      throw new Error(`Registration throttled, retry in ${Math.ceil(remainingMs / 1000)}s`);
    }
    
    this.updateRegistrationState(RegistrationState.REGISTERING);
    
    console.log(`PairingStateManager: 🔐 Registering device with ID: ${this.state.deviceId}`);
    console.log(`PairingStateManager: 📋 Using socket ID: ${socketId}`);
    
    // Abort any existing operations
    this.abortController.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    
    try {
      // If registerDevice doesn't exist, maybe there's another method?
      // Or registration is handled by an API service?
      // Assuming we call an API service directly for registration.
      this.log('info', 'Simulating registration via API service (registerDevice missing on DeviceManager)');
      // Placeholder: In a real scenario, call the appropriate service/API here.
      // Example: await this.options.apiService.registerDevice(this.state.deviceId, this.state.socketId);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate async operation

      this.log('info', 'Simulated device registration successful.');
      this.state.deviceRegistrationVerified = true;
      this.updateRegistrationState(RegistrationState.REGISTERED);
    } catch (error: any) {
      this.log('error', 'Simulated registration failed:', error, 'error');
      // Use REGISTRATION_ERROR instead of non-existent THROTTLED
      this.updateRegistrationState(RegistrationState.REGISTRATION_ERROR);
      const message = error instanceof Error ? error.message : 'Unknown registration error';
      this.setError(PairingErrorCode.REGISTRATION_FAILED, `Registration failed: ${message}`);
      throw error;
    }
  }
  
  /**
   * Request a pairing code from the server
   * @returns Promise resolving to the pairing code or rejecting with an error
   */
  public async requestPairingCode(): Promise<string> {
    // Check prerequisites
    if (!this.state.deviceId || !this.isValidDeviceId(this.state.deviceId)) {
      this.setError(
        PairingErrorCode.INVALID_DEVICE_ID,
        'Cannot request pairing code without a valid device ID'
      );
      throw new Error('Cannot request pairing code without a valid device ID');
    }
    
    if (!this.isSocketReady()) {
      this.setError(
        PairingErrorCode.SOCKET_NOT_CONNECTED,
        'Cannot request pairing code without a connected socket'
      );
      throw new Error('Cannot request pairing code without a connected socket');
    }
    
    if (this.state.registrationState !== RegistrationState.REGISTERED) {
      this.setError(
        PairingErrorCode.REGISTRATION_FAILED,
        'Device must be registered before requesting a pairing code'
      );
      throw new Error('Device must be registered before requesting a pairing code');
    }
    
    // Check if we're throttled
    if (this.isThrottled()) {
      const remainingMs = this.state.throttledUntil! - Date.now();
      this.log('warn', `Pairing code request throttled, retry in ${Math.ceil(remainingMs / 1000)}s`);
      throw new Error(`Pairing code request throttled, retry in ${Math.ceil(remainingMs / 1000)}s`);
    }
    
    // Check if we already have a valid pairing code
    if (
      this.state.pairingCode &&
      this.state.pairingCodeExpiry &&
      Date.now() < this.state.pairingCodeExpiry
    ) {
      this.log('info', `Using existing pairing code: ${this.state.pairingCode}`);
      return this.state.pairingCode;
    }
    
    this.updatePairingState(PairingState.REQUESTING);
    this.log('info', 'Requesting pairing code');
    
    // Abort any existing operations
    this.abortController.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    
    try {
      const socket = this.connectionManager.getSocket();
      const response = await this.generatePairingCode(this.state.deviceId!, socket ?? undefined);
      
      // Check if operation was aborted
      if (signal.aborted) {
        throw new Error('Pairing code request aborted');
      }
      
      const pairingCode = response.pairingCode;
      
      // Update state
      this.state.pairingCode = pairingCode;
      this.state.pairingCodeExpiry = response.expiresAt;
      this.state.pairingUrl = this.getPairingUrl();
      this.updatePairingState(PairingState.ACTIVE);
      this.state.retryCount = 0; // Reset retry count on success
      
      // Set up expiry timer
      this.setupPairingCodeExpiryTimer();
      
      this.log('info', `Pairing code generated: ${pairingCode}`);
      
      this.emit(PairingEvent.PAIRING_CODE_GENERATED, {
        pairingCode,
        expiry: this.state.pairingCodeExpiry
      });
      
      return pairingCode;
    } catch (error: any) {
      // Handle cancellation
      if (signal.aborted) {
        this.log('info', 'Pairing code request aborted');
        throw new Error('Pairing code request aborted');
      }
      
      // Handle rate limiting
      if (error.status === 429 || error.message?.includes('rate limit')) {
        this.updatePairingState(PairingState.ERROR);
        this.setError(
          PairingErrorCode.RATE_LIMITED,
          error.message || 'Rate limited during pairing code request',
          error
        );
        throw error;
      }
      
      // Handle other errors
      this.updatePairingState(PairingState.ERROR);
      this.setError(
        PairingErrorCode.REGISTRATION_FAILED,
        error.message || 'Failed to request pairing code',
        error
      );
      
      // Schedule a retry if appropriate
      this.scheduleRetry(() => this.requestPairingCode());
      
      throw error;
    }
  }
  
  /**
   * Coordinate the entire registration and pairing process
   * @returns Promise resolving to the pairing code or rejecting with an error
   */
  public async coordinateRegistrationAndPairing(): Promise<string> {
    this.log('info', '🚀 coordinateRegistrationAndPairing called');
    this.clearError();
    let step = 0;
    try {
      step = 1; this.log('info', `🚀 Coord Step ${step}: Ensuring socket connection...`);
      await this.connectSocket();
      const socketId = this.connectionManager.getSocketId();
      this.log('info', `🚀 Coord Step ${step}: Socket connected with ID: ${socketId}`);
      
      step = 2; this.log('info', `🚀 Coord Step ${step}: Verifying registration status...`);
      const isRegistered = await this.verifyDeviceRegistration(); 
      this.log('info', `🚀 Coord Step ${step}: Registration status verified: ${isRegistered}`);
      
      step = 3; this.log('info', `🚀 Coord Step ${step}: Requesting pairing code...`);
      const pairingCode = await this.requestPairingCode();
      this.log('info', `🚀 Coord Step ${step}: Pairing code received: ${pairingCode}`);
      
      return pairingCode;
    } catch (error: any) {
      this.log('error', 'Error during coordinateRegistrationAndPairing:', error);
      this.updateRegistrationState(RegistrationState.REGISTRATION_ERROR);
      this.setError(
        PairingErrorCode.COORDINATION_FAILED,
        error.message || 'Failed to coordinate registration and pairing',
        error
      );
      throw error;
    }
  }

  // <<< ADD Definitions for the private handler methods >>>
  /**
   * Private handler for connection state changes.
   * Updates the internal socketId and potentially triggers registration/verification checks.
   */
  private _handleConnectionStateChange(diagnostics: ConnectionDiagnostics): void {
    this.log('info', `[Handler] Connection state changed: ${diagnostics.connectionState}`);
    this.state.socketId = diagnostics.socketId; // Update socketId

    // Example logic: If disconnected, maybe log it or update pairing state?
    if (diagnostics.connectionState === DiagnosticConnectionState.DISCONNECTED) {
      this.log('warn', 'Connection lost (via state change)');
      // Potentially reset pairing state if needed when disconnected
    } else if (diagnostics.connectionState === DiagnosticConnectionState.CONNECTED) {
      // If we connect and were previously trying to verify, retry verification
      if (this.state.registrationState === RegistrationState.VERIFYING) {
        this.log('info', 'Reconnected, retrying verification...');
        this.verifyDeviceRegistration(); // Retry verification on reconnect
      } else if (this.state.pairingState === PairingState.REQUESTING) {
        this.log('info', 'Reconnected, retrying pairing code request...');
        this.requestPairingCode(); // Retry pairing code request
      }
    }
    // Always emit the overall state change
    this.emit(PairingEvent.STATE_CHANGE, this.getState());
  }

  /**
   * Private handler for connection errors.
   */
  private _handleConnectionError(error: Error): void {
    this.log('error', '[Handler] Connection error occurred:', error.message);
    // Potentially set a specific error state if the connection error is critical
    this.setError(PairingErrorCode.SOCKET_NOT_CONNECTED, `Connection error: ${error.message}`, error);
  }

  /**
   * Private handler for successful device registration events from DeviceManager.
   */
  private _handleDeviceRegistered(data: { deviceInfo: DeviceInfo }): void {
    this.log('info', '[Handler] Device registered event received:', data.deviceInfo);
    if (data.deviceInfo.deviceId && this.isValidDeviceId(data.deviceInfo.deviceId)) {
      this.state.deviceId = data.deviceInfo.deviceId;
      this.state.deviceRegistrationVerified = true;
      this.updateRegistrationState(RegistrationState.REGISTERED);
      this.emit(PairingEvent.DEVICE_ID_CHANGED, this.state.deviceId);
    } else {
      this.log('error', '[Handler] Invalid device ID received in registration event', data.deviceInfo);
      this.setError(PairingErrorCode.REGISTRATION_FAILED, 'Invalid device ID received after registration');
    }
  }

  /**
   * Private handler for failed device registration events from DeviceManager.
   */
  private _handleDeviceRegistrationFailed(data: { reason: string }): void {
    this.log('error', '[Handler] Device registration failed event received:', data.reason);
    this.updateRegistrationState(RegistrationState.REGISTRATION_ERROR);
    this.setError(PairingErrorCode.REGISTRATION_FAILED, `Registration failed: ${data.reason}`);
    // Potentially schedule a retry for registration
    // this.scheduleRetry(() => this.registerDevice());
  }

  /**
   * Private handler for the socket 'connect' event.
   */
  private _handleConnect(): void {
    this.log('info', '[Handler] Socket connected event received.');
    this.state.socketId = this.connectionManager.getSocketId(); // Ensure socket ID is updated
    // If we were waiting to verify registration, do it now
    if (this.state.registrationState === RegistrationState.VERIFYING) {
      this.verifyDeviceRegistration();
    }
    this.emit(PairingEvent.STATE_CHANGE, this.getState());
  }

  /**
   * Constructs the pairing URL based on configuration and current state.
   * @returns The full pairing URL or null if not available.
   */
  public getPairingUrl(): string | null {
    // Example implementation: Replace with actual logic
    const baseUrl = (this.options.apiService as any)?.getBaseUrl?.() || 'https://app.vizora.io'; // Or get from config
    if (!this.state.pairingCode) {
      return null;
    }
    // Construct the URL, e.g., https://app.vizora.io/pair?code=ABCDEF
    return `${baseUrl}/pair?code=${this.state.pairingCode}`;
  }

  /**
   * Generates a pairing code, likely by emitting a socket event or calling an API.
   * This is a placeholder and needs the actual implementation.
   * @param deviceId The device ID requesting the code.
   * @param socket The socket instance to use (optional).
   * @returns A promise resolving with the pairing code and its expiry time.
   */
  async generatePairingCode(
    deviceId?: string,
    socket?: Socket
  ): Promise<{ pairingCode: string; expiresAt: number }> {
    this.log('info', 'generatePairingCode called (Placeholder Implementation)');
    const currentDeviceId = deviceId || this.state.deviceId;
    const currentSocket = socket || this.connectionManager.getSocket();

    if (!currentDeviceId) {
      throw new Error('Device ID is required to generate a pairing code.');
    }
    if (!currentSocket) {
      throw new Error('Socket connection is required to generate a pairing code.');
    }

    // <<< UPDATE STATE to REQUESTING before starting >>>
    this.updatePairingState(PairingState.REQUESTING);

    // Simulate async operation (e.g., emitting to server and waiting for response)
    try {
        const { pairingCode, expiresAt } = await new Promise<{ pairingCode: string; expiresAt: number }>((resolve) => {
          setTimeout(() => {
            const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase(); // Example code
            const expiryTimestamp = Date.now() + this.options.pairingCodeExpiryMs;
            this.log('info', `Generated placeholder pairing code: ${generatedCode}`);
            resolve({ pairingCode: generatedCode, expiresAt: expiryTimestamp });
          }, 500); // Simulate network delay
        });

        // <<< UPDATE STATE on success >>>
        this.state.pairingCode = pairingCode;
        this.state.pairingCodeExpiry = expiresAt;
        this.state.pairingUrl = this.getPairingUrl(); // Generate URL after getting code
        this.updatePairingState(PairingState.ACTIVE);
        this.setupPairingCodeExpiryTimer(); // Start expiry timer

        // Emit event with code and expiry
        this.emit(PairingEvent.PAIRING_CODE_GENERATED, { pairingCode, expiry: expiresAt });

        return { pairingCode, expiresAt };

    } catch (error) {
        this.log('error', 'Error during pairing code generation simulation:', error);
        // <<< UPDATE STATE on error >>>
        this.updatePairingState(PairingState.ERROR);
        this.setError(
            PairingErrorCode.PAIRING_CODE_GENERATION_FAILED,
            error instanceof Error ? error.message : 'Failed to generate pairing code'
        );
        throw error; // Re-throw the error
    }
  }

  /**
   * Resets the PairingStateManager to its initial state.
   * Clears pairing code, timers, errors, and resets states.
   */
  public reset(): void {
    this.log('info', 'Resetting PairingStateManager...');

    // Clear timers
    if (this.pairingCodeExpiryTimer !== null) {
      clearTimeout(this.pairingCodeExpiryTimer as any);
      this.pairingCodeExpiryTimer = null;
    }
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer as any);
      this.retryTimer = null;
    }

    // Reset state fields (keep deviceId and potentially socketId)
    this.state.pairingState = PairingState.IDLE;
    this.state.pairingCode = null;
    this.state.pairingCodeExpiry = null;
    this.state.pairingUrl = null;
    this.state.retryCount = 0;
    this.state.throttledUntil = null;
    this.state.error = null;
    this.state.lastError = null;
    // Keep deviceRegistrationVerified as is unless full reset intended
    // this.state.deviceRegistrationVerified = false;
    this.state.qrCodeUrl = null;
    this.state.circuitBreakerTripped = false;
    this.state.lastServerVerification = 0;
    // Reset registration state? Or keep it?
    // Decide based on desired reset behavior.
    // If keeping deviceId, maybe reset to VERIFYING? 
    this.state.registrationState = this.state.deviceId ? RegistrationState.VERIFYING : RegistrationState.UNREGISTERED;

    // Re-initialize listeners if needed (might be redundant if cleanup isn't called)
    // this.initializeListeners();

    // Emit final state
    this.emit(PairingEvent.STATE_CHANGE, this.getState());
    this.log('info', 'PairingStateManager reset complete.');
  }

  /**
   * Cleans up resources used by the PairingStateManager, such as timers and listeners.
   * Should be called when the component using the manager is unmounted.
   */
  public cleanup(): void {
    this.log('info', 'Cleaning up PairingStateManager...');

    // Clear timers
    if (this.pairingCodeExpiryTimer !== null) {
      clearTimeout(this.pairingCodeExpiryTimer as any);
      this.pairingCodeExpiryTimer = null;
    }
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer as any);
      this.retryTimer = null;
    }

    // Abort ongoing operations
    this.abortController.abort();

    // Remove listeners from dependencies
    // Ensure handlers are correctly bound and stored if needed for removal
    this.connectionManager.off('connectionStateChange', this.handleConnectionStateChange);
    this.connectionManager.off('error', this.handleConnectionError);
    this.deviceManager.off('device:registered', this.handleDeviceRegistered);
    this.deviceManager.off('device:registration:failed', this.handleDeviceRegistrationFailed);
    this.connectionManager.off('connect', this.handleConnect);

    // Remove own listeners
    this.removeAllListeners();

    this.log('info', 'PairingStateManager cleanup complete.');
  }
}