import { TokenManager, DeviceManager } from '@vizora/common';
import { VizoraSocketClient } from './socketClient';

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
  private socketClient: VizoraSocketClient;
  private deviceManager: DeviceManager;

  constructor(socketClient: VizoraSocketClient) {
    this.socketClient = socketClient;
    
    // Get the connection manager from socket client
    const connectionManager = socketClient.getConnectionManager();
    // Get the token manager from socket client
    const tokenManager = socketClient.getTokenManager();
    
    // Create device manager
    this.deviceManager = new DeviceManager(
      connectionManager,
      tokenManager,
      {
        autoRegister: false, // We'll handle registration manually
        cacheDeviceInfo: true,
        deviceStorageKey: 'vizora_display_info',
        deviceIdPrefix: 'vdisplay-'
      },
      'VizoraDisplay'
    );
  }

  /**
   * Register device with pairing code
   */
  async registerWithPairingCode(code: string, metadata: DisplayMetadata): Promise<DeviceAuthResponse> {
    try {
      const deviceInfo = await this.deviceManager.registerWithPairingCode(code, {
        deviceName: metadata.name,
        deviceType: 'display',
        platform: metadata.os || navigator.platform,
        resolution: `${metadata.resolution.width}x${metadata.resolution.height}`,
        deviceInfo: {
          ...metadata,
          userAgent: navigator.userAgent
        }
      });
      
      if (!deviceInfo) {
        throw new Error('Device registration failed');
      }
      
      const token = this.socketClient.getTokenManager().getToken();
      if (!token) {
        throw new Error('No token received after registration');
      }
      
      // Connect socket after registration if not already connected
      if (!this.socketClient.connected) {
        await this.socketClient.connect();
      }
      
      // Create response in the expected format
      const response: DeviceAuthResponse = {
        token,
        displayId: deviceInfo.deviceId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      };
      
      return response;
    } catch (error) {
      console.error('Display registration failed:', error);
      throw error;
    }
  }

  /**
   * Register with an existing token
   */
  async registerWithToken(token: string, metadata: DisplayMetadata): Promise<DeviceAuthResponse> {
    try {
      // Set the token in the token manager
      this.socketClient.getTokenManager().setToken(token);
      
      // Register the device
      const deviceInfo = await this.deviceManager.register({
        deviceName: metadata.name,
        deviceType: 'display',
        platform: metadata.os || navigator.platform,
        resolution: `${metadata.resolution.width}x${metadata.resolution.height}`,
        deviceInfo: {
          ...metadata,
          userAgent: navigator.userAgent
        }
      });
      
      if (!deviceInfo) {
        throw new Error('Device registration failed');
      }
      
      // Connect socket after registration if not already connected
      if (!this.socketClient.connected) {
        await this.socketClient.connect();
      }
      
      // Create response in the expected format
      const response: DeviceAuthResponse = {
        token,
        displayId: deviceInfo.deviceId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      };
      
      return response;
    } catch (error) {
      console.error('Display registration failed:', error);
      throw error;
    }
  }

  /**
   * Validate the current token
   */
  async validateToken(): Promise<boolean> {
    return this.socketClient.getTokenManager().validate();
  }

  /**
   * Get the current token
   */
  getToken(): string | null {
    return this.socketClient.getTokenManager().getToken();
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
    this.socketClient.getTokenManager().removeToken();
    this.deviceManager.clearDeviceInfo();
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