import { MemoryBankManager } from './MemoryBankManager';
// import { EventEmitter } from 'events';
import EventEmitter from 'eventemitter3';

/**
 * Categories for state storage
 */
export enum StateCategory {
  PAIRING = 'pairing',
  SOCKET = 'socket',
  RETRY = 'retry',
  DEVICE = 'device',
  DISPLAY = 'display',
  USER_PREFERENCES = 'user_preferences',
  CRASH_RECOVERY = 'crash_recovery'
}

/**
 * Pairing state interface
 */
export interface PairingState {
  pairingCode: string | null;
  pairingUrl: string | null;
  pairingAttempts: number;
  lastPairingAttempt: number | null;
  throttledUntil: number | null;
  registrationStatus: 'unregistered' | 'registering' | 'registered' | 'failed';
  deviceId: string | null;
  deviceRegistrationVerified: boolean;
  lastVerificationTime: number | null;
}

/**
 * Socket state interface
 */
export interface SocketState {
  connected: boolean;
  socketId: string | null;
  connectionAttempts: number;
  lastConnectionAttempt: number | null;
  transportMode: 'websocket' | 'polling' | null;
  disconnectReason: string | null;
  serverUrl: string | null;
  fatalDisconnect: boolean;
  reconnectDisabled: boolean;
}

/**
 * Retry state interface
 */
export interface RetryState {
  retryCount: number;
  lastRetryTime: number | null;
  circuitBreakerTripped: boolean;
  circuitBreakerReason: string | null;
  circuitBreakerResetTime: number | null;
  backoffFactor: number;
}

/**
 * Device state interface
 */
export interface DeviceState {
  deviceId: string | null;
  deviceName: string | null;
  deviceType: 'tv' | 'web' | 'mobile' | null;
  osInfo: string | null;
  browserInfo: string | null;
  screenResolution: string | null;
  lastBootTime: number | null;
  appVersion: string | null;
}

/**
 * Crash recovery state interface
 */
export interface CrashRecoveryState {
  lastCrashTime: number | null;
  crashCount: number;
  crashReason: string | null;
  stackTrace: string | null;
  lastStableState: {
    pairingOk: boolean;
    socketOk: boolean;
    deviceRegistered: boolean;
    lastContentTimestamp: number | null;
  };
  recoveryAttempts: number;
}

/**
 * Options for LocalStorageStateService
 */
export interface LocalStorageStateOptions {
  /**
   * Initialize with default values for all state categories
   */
  initializeDefaults?: boolean;
  
  /**
   * Key prefix for storage
   */
  storageKeyPrefix?: string;
  
  /**
   * Default TTL for stored items (null = no expiry)
   */
  defaultTtl?: number | null;
  
  /**
   * Storage implementation to use (defaults to localStorage)
   */
  storage?: Storage;
  
  /**
   * Debug mode
   */
  debug?: boolean;
  
  /**
   * State verification interval in ms
   * (checks for state consistency periodically)
   */
  stateVerificationInterval?: number;
}

/**
 * Default state values
 */
const DEFAULT_PAIRING_STATE: PairingState = {
  pairingCode: null,
  pairingUrl: null,
  pairingAttempts: 0,
  lastPairingAttempt: null,
  throttledUntil: null,
  registrationStatus: 'unregistered',
  deviceId: null,
  deviceRegistrationVerified: false,
  lastVerificationTime: null
};

const DEFAULT_SOCKET_STATE: SocketState = {
  connected: false,
  socketId: null,
  connectionAttempts: 0,
  lastConnectionAttempt: null,
  transportMode: null,
  disconnectReason: null,
  serverUrl: null,
  fatalDisconnect: false,
  reconnectDisabled: false
};

const DEFAULT_RETRY_STATE: RetryState = {
  retryCount: 0,
  lastRetryTime: null,
  circuitBreakerTripped: false,
  circuitBreakerReason: null,
  circuitBreakerResetTime: null,
  backoffFactor: 1.5
};

const DEFAULT_DEVICE_STATE: DeviceState = {
  deviceId: null,
  deviceName: null,
  deviceType: null,
  osInfo: null,
  browserInfo: null,
  screenResolution: null,
  lastBootTime: Date.now(),
  appVersion: null
};

const DEFAULT_CRASH_RECOVERY_STATE: CrashRecoveryState = {
  lastCrashTime: null,
  crashCount: 0,
  crashReason: null,
  stackTrace: null,
  lastStableState: {
    pairingOk: false,
    socketOk: false,
    deviceRegistered: false,
    lastContentTimestamp: null
  },
  recoveryAttempts: 0
};

/**
 * Key names for storing state
 */
enum StateKey {
  PAIRING_STATE = 'pairing_state',
  SOCKET_STATE = 'socket_state',
  RETRY_STATE = 'retry_state',
  DEVICE_STATE = 'device_state',
  CRASH_RECOVERY_STATE = 'crash_recovery_state'
}

/**
 * LocalStorageStateService manages persistent state storage across app reloads
 * 
 * It provides structured state management for:
 * - Pairing processes
 * - Socket connection state
 * - Retry/backoff management
 * - Device information
 * - Crash recovery
 * 
 * Uses MemoryBankManager internally for TTL, category management, and memory monitoring.
 */
export class LocalStorageStateService extends EventEmitter {
  private memoryBank: MemoryBankManager;
  private options: Required<LocalStorageStateOptions>;
  private verificationTimer: number | null = null;
  
  constructor(options: LocalStorageStateOptions = {}) {
    super();
    
    // Default options
    this.options = {
      initializeDefaults: true,
      storageKeyPrefix: 'vizora_state_',
      defaultTtl: null, // No expiry by default
      storage: undefined as any,
      debug: false,
      stateVerificationInterval: 60000, // Verify state every minute
      ...options
    };
    
    // Create memory bank
    this.memoryBank = new MemoryBankManager({
      storageKeyPrefix: this.options.storageKeyPrefix,
      defaultTtl: this.options.defaultTtl,
      storage: this.options.storage,
      debug: this.options.debug
    });
    
    // Initialize with defaults if needed
    if (this.options.initializeDefaults) {
      this.initializeDefaultStates();
    }
    
    // Start state verification timer
    this.startStateVerification();
    
    this.log('LocalStorageStateService initialized');
  }
  
  /**
   * Get pairing state
   */
  public getPairingState(): PairingState {
    return this.getState<PairingState>(StateKey.PAIRING_STATE, DEFAULT_PAIRING_STATE);
  }
  
  /**
   * Update pairing state (partial update)
   */
  public updatePairingState(update: Partial<PairingState>): void {
    const current = this.getPairingState();
    const updated = { ...current, ...update };
    this.setState(StateKey.PAIRING_STATE, updated, { category: StateCategory.PAIRING });
    this.emit('pairing:updated', updated);
  }
  
  /**
   * Reset pairing state to defaults
   */
  public resetPairingState(): void {
    this.setState(StateKey.PAIRING_STATE, { ...DEFAULT_PAIRING_STATE }, { category: StateCategory.PAIRING });
    this.emit('pairing:reset');
  }
  
  /**
   * Get socket state
   */
  public getSocketState(): SocketState {
    return this.getState<SocketState>(StateKey.SOCKET_STATE, DEFAULT_SOCKET_STATE);
  }
  
  /**
   * Update socket state (partial update)
   */
  public updateSocketState(update: Partial<SocketState>): void {
    const current = this.getSocketState();
    const updated = { ...current, ...update };
    this.setState(StateKey.SOCKET_STATE, updated, { category: StateCategory.SOCKET });
    this.emit('socket:updated', updated);
    
    // Check for fatal disconnect and emit special event
    if (update.fatalDisconnect === true && !current.fatalDisconnect) {
      this.emit('socket:fatal', updated);
    }
  }
  
  /**
   * Reset socket state to defaults
   */
  public resetSocketState(): void {
    this.setState(StateKey.SOCKET_STATE, { ...DEFAULT_SOCKET_STATE }, { category: StateCategory.SOCKET });
    this.emit('socket:reset');
  }
  
  /**
   * Get retry state
   */
  public getRetryState(): RetryState {
    return this.getState<RetryState>(StateKey.RETRY_STATE, DEFAULT_RETRY_STATE);
  }
  
  /**
   * Update retry state (partial update)
   */
  public updateRetryState(update: Partial<RetryState>): void {
    const current = this.getRetryState();
    const updated = { ...current, ...update };
    this.setState(StateKey.RETRY_STATE, updated, { category: StateCategory.RETRY });
    this.emit('retry:updated', updated);
    
    // Check for circuit breaker trip and emit special event
    if (update.circuitBreakerTripped === true && !current.circuitBreakerTripped) {
      this.emit('retry:circuit-breaker-tripped', updated);
    }
  }
  
  /**
   * Reset retry state to defaults
   */
  public resetRetryState(): void {
    this.setState(StateKey.RETRY_STATE, { ...DEFAULT_RETRY_STATE }, { category: StateCategory.RETRY });
    this.emit('retry:reset');
  }
  
  /**
   * Get device state
   */
  public getDeviceState(): DeviceState {
    return this.getState<DeviceState>(StateKey.DEVICE_STATE, DEFAULT_DEVICE_STATE);
  }
  
  /**
   * Update device state (partial update)
   */
  public updateDeviceState(update: Partial<DeviceState>): void {
    const current = this.getDeviceState();
    const updated = { ...current, ...update };
    this.setState(StateKey.DEVICE_STATE, updated, { category: StateCategory.DEVICE });
    this.emit('device:updated', updated);
  }
  
  /**
   * Reset device state to defaults
   */
  public resetDeviceState(): void {
    this.setState(StateKey.DEVICE_STATE, { ...DEFAULT_DEVICE_STATE }, { category: StateCategory.DEVICE });
    this.emit('device:reset');
  }
  
  /**
   * Get crash recovery state
   */
  public getCrashRecoveryState(): CrashRecoveryState {
    return this.getState<CrashRecoveryState>(StateKey.CRASH_RECOVERY_STATE, DEFAULT_CRASH_RECOVERY_STATE);
  }
  
  /**
   * Update crash recovery state (partial update)
   */
  public updateCrashRecoveryState(update: Partial<CrashRecoveryState>): void {
    const current = this.getCrashRecoveryState();
    const updated = { ...current, ...update };
    this.setState(StateKey.CRASH_RECOVERY_STATE, updated, { category: StateCategory.CRASH_RECOVERY });
    this.emit('crash-recovery:updated', updated);
  }
  
  /**
   * Reset crash recovery state to defaults
   */
  public resetCrashRecoveryState(): void {
    this.setState(
      StateKey.CRASH_RECOVERY_STATE, 
      { ...DEFAULT_CRASH_RECOVERY_STATE }, 
      { category: StateCategory.CRASH_RECOVERY }
    );
    this.emit('crash-recovery:reset');
  }
  
  /**
   * Record crash event
   */
  public recordCrash(reason: string, stackTrace?: string): void {
    // Update crash recovery state
    const current = this.getCrashRecoveryState();
    
    this.updateCrashRecoveryState({
      lastCrashTime: Date.now(),
      crashCount: current.crashCount + 1,
      crashReason: reason,
      stackTrace: stackTrace || null,
      recoveryAttempts: 0 // Reset recovery attempts
    });
    
    // Store current state snapshot in lastStableState
    const pairingState = this.getPairingState();
    const socketState = this.getSocketState();
    
    this.updateCrashRecoveryState({
      lastStableState: {
        pairingOk: !!pairingState.pairingCode,
        socketOk: socketState.connected,
        deviceRegistered: pairingState.registrationStatus === 'registered',
        lastContentTimestamp: Date.now()
      }
    });
    
    this.emit('crash:recorded', {
      reason,
      stackTrace,
      crashCount: current.crashCount + 1
    });
  }
  
  /**
   * Check if recovery is needed
   */
  public needsRecovery(): boolean {
    const crash = this.getCrashRecoveryState();
    return !!crash.lastCrashTime && crash.recoveryAttempts < 3;
  }
  
  /**
   * Record recovery attempt
   */
  public recordRecoveryAttempt(success: boolean): void {
    const current = this.getCrashRecoveryState();
    
    this.updateCrashRecoveryState({
      recoveryAttempts: current.recoveryAttempts + 1,
      // If recovery succeeded, clear crash info
      lastCrashTime: success ? null : current.lastCrashTime,
      crashReason: success ? null : current.crashReason,
      stackTrace: success ? null : current.stackTrace
    });
    
    this.emit('recovery:attempt', {
      success,
      attemptNumber: current.recoveryAttempts + 1
    });
  }
  
  /**
   * Get all state
   */
  public getAllState(): {
    pairing: PairingState;
    socket: SocketState;
    retry: RetryState;
    device: DeviceState;
    crashRecovery: CrashRecoveryState;
  } {
    return {
      pairing: this.getPairingState(),
      socket: this.getSocketState(),
      retry: this.getRetryState(),
      device: this.getDeviceState(),
      crashRecovery: this.getCrashRecoveryState()
    };
  }
  
  /**
   * Reset all state to defaults
   */
  public resetAllState(): void {
    this.resetPairingState();
    this.resetSocketState();
    this.resetRetryState();
    this.resetDeviceState();
    this.resetCrashRecoveryState();
    this.emit('state:reset-all');
  }
  
  /**
   * Verify registration state against device ID presence
   * This ensures we don't have inconsistent state between deviceId and registrationStatus
   */
  public verifyRegistrationState(): void {
    const pairingState = this.getPairingState();
    
    // If state says registered but we have no device ID, fix the state
    if (pairingState.registrationStatus === 'registered' && !pairingState.deviceId) {
      this.log('⚠️ Inconsistent state: Registered but no device ID. Fixing...');
      this.updatePairingState({
        registrationStatus: 'unregistered',
        deviceRegistrationVerified: false
      });
    }
    
    // If state says unregistered but we have a device ID, fix the state by rechecking
    if (pairingState.registrationStatus === 'unregistered' && pairingState.deviceId) {
      const verificationAge = pairingState.lastVerificationTime 
        ? Date.now() - pairingState.lastVerificationTime 
        : Infinity;
        
      // Only do this if last verification was more than 5 minutes ago
      if (verificationAge > 5 * 60 * 1000) {
        this.log('ℹ️ Potential state inconsistency: Unregistered but has device ID. Will need verification');
        this.updatePairingState({
          deviceRegistrationVerified: false,
          lastVerificationTime: null
        });
      }
    }
  }
  
  /**
   * Verify socket state against connection info
   */
  public verifySocketState(): void {
    const socketState = this.getSocketState();
    
    // If state says connected but we have no socket ID, fix the state
    if (socketState.connected && !socketState.socketId) {
      this.log('⚠️ Inconsistent state: Connected but no socket ID. Fixing...');
      this.updateSocketState({
        connected: false,
        disconnectReason: 'state_verification_invalid_id'
      });
    }
    
    // Verify connection attempt count against circuit breaker
    const retryState = this.getRetryState();
    if (socketState.connectionAttempts > 0 && retryState.circuitBreakerTripped && !socketState.reconnectDisabled) {
      this.log('⚠️ Inconsistent state: Circuit breaker tripped but reconnect not disabled. Fixing...');
      this.updateSocketState({
        reconnectDisabled: true
      });
    }
  }
  
  /**
   * Dispose of service and clean up
   */
  public dispose(): void {
    // Stop verification timer
    if (this.verificationTimer !== null) {
      window.clearInterval(this.verificationTimer);
      this.verificationTimer = null;
    }
    
    // Clean up memory bank
    this.memoryBank.dispose();
    
    this.log('LocalStorageStateService disposed');
    this.emit('disposed');
  }
  
  /**
   * Initialize default states if not already present
   */
  private initializeDefaultStates(): void {
    const keys = this.memoryBank.keys();
    
    // Only initialize states that don't exist yet
    if (!keys.includes(StateKey.PAIRING_STATE)) {
      this.setState(StateKey.PAIRING_STATE, { ...DEFAULT_PAIRING_STATE }, { category: StateCategory.PAIRING });
    }
    
    if (!keys.includes(StateKey.SOCKET_STATE)) {
      this.setState(StateKey.SOCKET_STATE, { ...DEFAULT_SOCKET_STATE }, { category: StateCategory.SOCKET });
    }
    
    if (!keys.includes(StateKey.RETRY_STATE)) {
      this.setState(StateKey.RETRY_STATE, { ...DEFAULT_RETRY_STATE }, { category: StateCategory.RETRY });
    }
    
    if (!keys.includes(StateKey.DEVICE_STATE)) {
      this.setState(StateKey.DEVICE_STATE, { ...DEFAULT_DEVICE_STATE }, { category: StateCategory.DEVICE });
    }
    
    if (!keys.includes(StateKey.CRASH_RECOVERY_STATE)) {
      this.setState(
        StateKey.CRASH_RECOVERY_STATE,
        { ...DEFAULT_CRASH_RECOVERY_STATE },
        { category: StateCategory.CRASH_RECOVERY }
      );
    }
    
    this.log('Default states initialized');
  }
  
  /**
   * Start state verification timer
   */
  private startStateVerification(): void {
    // Clear any existing timer
    if (this.verificationTimer !== null) {
      window.clearInterval(this.verificationTimer);
    }
    
    // Start new timer
    this.verificationTimer = window.setInterval(() => {
      this.verifyRegistrationState();
      this.verifySocketState();
    }, this.options.stateVerificationInterval);
    
    this.log(`Started state verification (interval: ${this.options.stateVerificationInterval}ms)`);
  }
  
  /**
   * Get state with default fallback
   */
  private getState<T>(key: string, defaultValue: T): T {
    const value = this.memoryBank.retrieve<T>(key);
    
    if (value === null) {
      this.setState(key, defaultValue);
      return defaultValue;
    }
    
    return value;
  }
  
  /**
   * Set state
   */
  private setState<T>(key: string, value: T, options: { 
    category?: string; 
    ttl?: number | null; 
    tags?: string[] 
  } = {}): void {
    this.memoryBank.store(key, value, {
      persistent: true,
      ...options
    });
  }
  
  /**
   * Log message if debug is enabled
   */
  private log(message: string, data?: any): void {
    if (this.options.debug) {
      console.log(`[StateService] ${message}`, data);
    }
  }
} 