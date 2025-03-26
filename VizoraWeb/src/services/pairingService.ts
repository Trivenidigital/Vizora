// Pairing Service for Vizora
import { authFetch, API_URL } from '../utils/auth';
import { websocketService } from './websocketService';

// Types
export interface DisplayDevice {
  _id: string;
  name: string;
  deviceId: string;
  status: 'online' | 'offline' | 'pending';
  lastSeen?: string;
  ipAddress?: string;
  osInfo?: string;
  screenResolution?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PairingCode {
  code: string;
  expiresAt: string;
  qrCode: string;
}

// Mock displays for development
const mockDisplays: DisplayDevice[] = [
  {
    _id: 'display-1',
    name: 'Conference Room Display',
    deviceId: 'device-1',
    status: 'online',
    lastSeen: new Date().toISOString(),
    ipAddress: '192.168.1.1',
    osInfo: 'Windows 10',
    screenResolution: '1920x1080',
    userId: 'user-1',
    createdAt: '2023-03-10T14:30:00Z',
    updatedAt: '2023-03-10T14:30:00Z'
  },
  {
    _id: 'display-2',
    name: 'Lobby Display',
    deviceId: 'device-2',
    status: 'offline',
    lastSeen: '2023-03-05T09:15:00Z',
    ipAddress: '192.168.1.2',
    osInfo: 'Windows 10',
    screenResolution: '1920x1080',
    userId: 'user-1',
    createdAt: '2023-02-20T11:45:00Z',
    updatedAt: '2023-02-20T11:45:00Z'
  }
];

// PairingService Class
class PairingService {
  private pairingApi: string;
  
  constructor() {
    this.pairingApi = `${API_URL}/displays`;
  }
  
  /**
   * Get all displays for the current user
   * @returns Promise with display devices
   */
  async getUserDisplays(): Promise<DisplayDevice[]> {
    try {
      // For development, return mock data first
      if (import.meta.env.DEV && !import.meta.env.VITE_USE_API_IN_DEV) {
        console.log('Using mock display data');
        return Promise.resolve([...mockDisplays]);
      }
      
      const response = await authFetch(`${this.pairingApi}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch displays');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching displays:', error);
      
      // Fallback to mock data in case of error
      console.log('Falling back to mock display data');
      return [...mockDisplays];
    }
  }
  
  /**
   * Get a specific display by ID
   * @param id Display ID
   * @returns Promise with display device
   */
  async getDisplayById(id: string): Promise<DisplayDevice> {
    try {
      const response = await authFetch(`${this.pairingApi}/${id}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch display');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching display ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Generate a new pairing code
   * @returns Promise with pairing code information
   */
  async generatePairingCode(): Promise<PairingCode> {
    try {
      const response = await authFetch(`${this.pairingApi}/pair`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate pairing code');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error generating pairing code:', error);
      throw error;
    }
  }
  
  /**
   * Claim a display using a pairing code
   * @param pairingCode The pairing code
   * @param displayName Optional display name
   * @returns Promise with the claimed display information
   */
  async claimDisplay(pairingCode: string, displayName?: string): Promise<DisplayDevice> {
    try {
      const response = await authFetch(`${this.pairingApi}/claim`, {
        method: 'POST',
        body: JSON.stringify({
          pairingCode,
          name: displayName
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to claim display');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error claiming display:', error);
      throw error;
    }
  }
  
  /**
   * Update a display
   * @param id Display ID
   * @param data Updated display data
   * @returns Promise with updated display
   */
  async updateDisplay(id: string, data: Partial<DisplayDevice>): Promise<DisplayDevice> {
    try {
      const response = await authFetch(`${this.pairingApi}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update display');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error updating display ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Rename a display
   * @param id Display ID
   * @param newName New display name
   * @returns Promise with updated display
   */
  async renameDisplay(id: string, newName: string): Promise<DisplayDevice> {
    return this.updateDisplay(id, { name: newName });
  }
  
  /**
   * Release a display (unclaim it)
   * @param id Display ID to release
   * @returns Promise indicating success
   */
  async releaseDisplay(id: string): Promise<void> {
    try {
      const response = await authFetch(`${this.pairingApi}/${id}/release`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to release display');
      }
    } catch (error) {
      console.error(`Error releasing display ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Reboot a display
   * @param id Display ID to reboot
   * @returns Promise indicating success
   */
  async rebootDisplay(id: string): Promise<void> {
    try {
      const response = await authFetch(`${this.pairingApi}/${id}/reboot`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reboot display');
      }
    } catch (error) {
      console.error(`Error rebooting display ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Shutdown a display
   * @param id Display ID to shutdown
   * @returns Promise indicating success
   */
  async shutdownDisplay(id: string): Promise<void> {
    try {
      const response = await authFetch(`${this.pairingApi}/${id}/shutdown`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to shutdown display');
      }
    } catch (error) {
      console.error(`Error shutting down display ${id}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const pairingService = new PairingService(); 