import axios, { AxiosInstance } from 'axios';
import { LocalStorage } from '@vizora/common/utils/localStorage';

export interface DeviceAuthToken {
  token: string;
  deviceId: string;
  expiry: Date;
  createdAt: Date;
  deviceName?: string;
}

export class DeviceAuthService {
  private api: AxiosInstance;
  private storage: LocalStorage;

  constructor(baseURL: string, storage: LocalStorage) {
    this.storage = storage;
    this.api = axios.create({
      baseURL,
      timeout: 10000,
    });
  }

  /**
   * Get the authorization token if it exists and is valid
   */
  async getToken(): Promise<DeviceAuthToken | null> {
    try {
      const tokenJson = this.storage.getItem('authToken');
      if (!tokenJson) {
        console.log('[DeviceAuth] No token found in storage');
        return null;
      }

      const token: DeviceAuthToken = JSON.parse(tokenJson);
      const now = new Date();
      
      // Check if token is expired
      if (new Date(token.expiry) < now) {
        console.log('[DeviceAuth] Token has expired');
        return null;
      }

      console.log(`[DeviceAuth] Retrieved valid token for device: ${token.deviceId}`);
      return token;
    } catch (err) {
      console.error('[DeviceAuth] Error getting token:', err);
      return null;
    }
  }

  /**
   * Get token string for socket connections
   */
  async getTokenString(): Promise<string | null> {
    const token = await this.getToken();
    return token ? token.token : null;
  }

  /**
   * Get device ID from stored token
   */
  getDeviceId(): string | null {
    try {
      const tokenJson = this.storage.getItem('authToken');
      if (!tokenJson) return null;
      
      const token: DeviceAuthToken = JSON.parse(tokenJson);
      return token.deviceId;
    } catch (err) {
      console.error('[DeviceAuth] Error getting device ID:', err);
      return null;
    }
  }

  /**
   * Get device name from stored token
   */
  getDeviceName(): string | null {
    try {
      const tokenJson = this.storage.getItem('authToken');
      if (!tokenJson) return null;
      
      const token: DeviceAuthToken = JSON.parse(tokenJson);
      return token.deviceName || null;
    } catch (err) {
      console.error('[DeviceAuth] Error getting device name:', err);
      return null;
    }
  }

  /**
   * Save token to local storage
   */
  private async saveToken(token: string, deviceId: string, expiry: Date, deviceName?: string): Promise<void> {
    console.log(`[DeviceAuth] Saving token for device: ${deviceId}`);
    
    try {
      // Create token object with all metadata
      const tokenObj: DeviceAuthToken = {
        token,
        deviceId,
        expiry,
        createdAt: new Date(),
        deviceName
      };
      
      // Store token as string
      await this.storage.setItem('authToken', JSON.stringify(tokenObj));
      console.log(`[DeviceAuth] Token saved successfully for device: ${deviceId}`);
    } catch (err) {
      console.error('[DeviceAuth] Error saving token:', err);
      throw new Error('Failed to save authentication token');
    }
  }

  /**
   * Register a new device with the API
   */
  async registerDevice(deviceName?: string): Promise<DeviceAuthToken> {
    console.log('[DeviceAuth] Registering new device');
    
    try {
      // Register device with API
      const response = await this.api.post('/api/devices', { deviceName });
      
      // Extract token data
      const { token, deviceId, expiry } = response.data;
      
      // Convert expiry to Date object
      const expiryDate = new Date(expiry);
      
      // Save token to storage
      await this.saveToken(token, deviceId, expiryDate, deviceName);
      
      // Return token information
      const tokenInfo: DeviceAuthToken = {
        token,
        deviceId,
        expiry: expiryDate,
        createdAt: new Date(),
        deviceName
      };
      
      console.log(`[DeviceAuth] Device registered successfully: ${deviceId}`);
      return tokenInfo;
    } catch (err) {
      console.error('[DeviceAuth] Error registering device:', err);
      throw new Error('Failed to register device');
    }
  }

  /**
   * Validate the stored token with the server
   */
  async validateStoredToken(): Promise<boolean> {
    console.log('[DeviceAuth] Validating stored token');
    
    try {
      const token = await this.getTokenString();
      if (!token) {
        console.log('[DeviceAuth] No token to validate');
        return false;
      }
      
      // Validate token with server
      await this.api.get('/api/auth/validate', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('[DeviceAuth] Token validated successfully');
      return true;
    } catch (err) {
      console.error('[DeviceAuth] Token validation failed:', err);
      return false;
    }
  }

  /**
   * Check if the device is registered
   */
  isDeviceRegistered(): boolean {
    const deviceId = this.getDeviceId();
    const token = this.storage.getItem('authToken');
    return !!(deviceId && token);
  }

  /**
   * Clear all authentication data
   */
  async clearAuth(): Promise<void> {
    console.log('[DeviceAuth] Clearing authentication data');
    try {
      await this.storage.removeItem('authToken');
      console.log('[DeviceAuth] Authentication data cleared');
    } catch (err) {
      console.error('[DeviceAuth] Error clearing auth data:', err);
      throw new Error('Failed to clear authentication data');
    }
  }
} 