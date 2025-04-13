import { apiClient } from '../services/apiClient';

export interface PairingCodeResponse {
  code: string;
  expiresAt: string;
  deviceId: string;
}

export interface DeviceRegistrationResponse {
  deviceId: string;
  displayName?: string;
  registeredAt: string;
}

/**
 * Generates a pairing code for the device
 * @param deviceId The ID of the device requesting the pairing code
 * @returns Promise resolving to the pairing code response
 */
export async function generatePairingCode(deviceId: string): Promise<PairingCodeResponse> {
  console.log('[deviceApi] Generating pairing code for device:', deviceId);
  
  try {
    const response = await apiClient.post<PairingCodeResponse>('/api/devices/pair/code', {
      deviceId,
      timestamp: new Date().toISOString()
    });
    
    console.log('[deviceApi] Successfully generated pairing code:', {
      deviceId,
      expiresAt: response.expiresAt
    });
    
    return response;
  } catch (error) {
    console.error('[deviceApi] Failed to generate pairing code:', {
      deviceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Registers a new device
 * @param deviceName Optional name for the device
 * @returns Promise resolving to the device registration response
 */
export async function registerDevice(deviceName?: string): Promise<DeviceRegistrationResponse> {
  console.log('[deviceApi] Registering new device:', { deviceName });
  
  try {
    const response = await apiClient.post<DeviceRegistrationResponse>('/api/devices/register', {
      deviceName,
      timestamp: new Date().toISOString()
    });
    
    console.log('[deviceApi] Successfully registered device:', {
      deviceId: response.deviceId,
      displayName: response.displayName
    });
    
    return response;
  } catch (error) {
    console.error('[deviceApi] Failed to register device:', {
      deviceName,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
} 