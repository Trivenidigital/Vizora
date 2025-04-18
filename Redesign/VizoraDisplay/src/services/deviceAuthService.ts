import { VizoraSocketClient } from '@vizora/common';
import { DeviceManager, DeviceInfo } from '@vizora/common';
import { TokenManager } from '@vizora/common';

// TODO: Phase 4 - Implement more secure device authentication with hardware fingerprinting
// and device certificate storage. Replace basic localStorage token storage with a more secure approach.
interface DisplayMetadata {
  name: string;
  location: string;
  resolution: {
    width: number;
    height: number;
  };
  model: string;
  os: string;
}

interface DeviceAuthResponse {
  token: string;
  displayId: string;
  expiresAt: string;
}

/**
 * Service for handling device authentication
 * Uses TokenManager and DeviceManager from @vizora/common
 */
export class DeviceAuthService {
  private socket: VizoraSocketClient;
  private deviceManager: DeviceManager;
  private tokenManager: TokenManager;

  constructor(socket: VizoraSocketClient, deviceManager: DeviceManager, tokenManager: TokenManager) {
    this.socket = socket;
    this.deviceManager = deviceManager;
    this.tokenManager = tokenManager;
  }

  /**
   * Register device with pairing code
   */
  async registerWithPairingCode(code: string, metadata: any): Promise<DeviceInfo | null> {
    try {
      console.warn('registerWithPairingCode method missing/incorrect on DeviceManager');
      // const deviceInfo = await this.deviceManager.registerWithPairingCode(code, metadata); 
      const deviceInfo: DeviceInfo | null = null; 
      // console.warn('Connection check skipped');
      // if (!this.socket.isConnected?.()) { 
      //    await this.socket.connect();
      // }
    } catch (error) { /* ... */ }
    return null; 
  }

  /**
   * Register with an existing token
   */
  async registerWithToken(token: string, metadata: any): Promise<DeviceAuthResponse> {
    try {
      const deviceInfo = await this.deviceManager.register({
        deviceName: metadata.name,
        deviceType: 'display',
        platform: metadata.os || navigator.platform,
        resolution: `${metadata.resolution.width}x${metadata.resolution.height}`,
        userAgent: navigator.userAgent
      });
      // ...
      console.warn('Connection check skipped');
      // if (!this.socket.isConnected?.()) { 
      //    await this.socket.connect();
      // }
      // ...
    } catch (error) { throw error; } // Need to return something or fix signature
    return {} as DeviceAuthResponse; // Placeholder return
  }

  /**
   * Validate the current token
   */
  async validateToken(): Promise<boolean> {
    return this.tokenManager.validate();
  }

  /**
   * Get the current token
   */
  getToken(): string | null {
    return this.tokenManager.getToken();
  }

  /**
   * Get device ID
   */
  getDisplayId(): string | null {
    const deviceInfo = this.deviceManager.getDeviceInfo();
    return deviceInfo?.deviceId || null;
  }

  /**
   * Clear all authentication data
   */
  clearAuthData(): void {
    this.tokenManager.removeToken();
    console.warn('clearDeviceInfo method missing/incorrect on DeviceManager');
    // this.deviceManager.clearDeviceInfo(); 
  }

  /**
   * Check if device is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const displayId = this.getDisplayId();
    return !!token && !!displayId;
  }
} 