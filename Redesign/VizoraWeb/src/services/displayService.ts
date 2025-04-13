import axios from 'axios';
import { Schedule } from '@/hooks/useDisplays';
import { Content } from './contentService';
import { hasFailedWith404, markAsFailed } from './displayState';

// Display interface based on types in the codebase
export interface Display {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'warning';
  model?: string;
  ipAddress?: string;
  currentContent?: string;
  lastPing?: string;
  deviceId?: string;
  qrCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DisplayScheduleResponse {
  success: boolean;
  displayId: string;
  deviceId: string;
  name: string;
  scheduledContent: Schedule[];
}

// Get API base URL from environment or use default
const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || '/api';
};

// Display Service Implementation
class DisplayService {
  private apiUrl: string;
  
  constructor() {
    this.apiUrl = `${getApiBaseUrl()}/displays`;
    console.log(`DisplayService initialized with API URL: ${this.apiUrl}`);
  }

  /**
   * Get all displays
   */
  async getDisplays(): Promise<{ displays: Display[] }> {
    try {
      const response = await axios.get(this.apiUrl, { withCredentials: true });
      
      // Handle different response formats
      if (response.data && typeof response.data === 'object') {
        // If response matches the expected format, return it directly
        if ('displays' in response.data && Array.isArray(response.data.displays)) {
          return response.data;
        }
        
        // Handle case where API returns { success: true, data: Display[] }
        if ('success' in response.data && response.data.success && 
            'data' in response.data && Array.isArray(response.data.data)) {
          return { displays: response.data.data };
        }
        
        // Handle case where API directly returns array of displays
        if (Array.isArray(response.data)) {
          return { displays: response.data };
        }
      }
      
      // If response format is unexpected, return empty array with warning
      console.warn('Unexpected response format from displays API:', response.data);
      return { displays: [] };
      
    } catch (error) {
      console.error('Error fetching displays:', error);
      // Return empty array to indicate failure without mock data
      return { displays: [] };
    }
  }

  /**
   * Get a display by ID
   * @throws Error with status property set to 404 if display is not found
   */
  async getDisplayById(id: string): Promise<Display> {
    if (!id) {
      throw new Error('Display ID is required');
    }
    
    // Check if this display has previously failed with 404
    if (hasFailedWith404(id)) {
      console.log(`SKIP DISPLAY FETCH: Display ${id} is marked as permanently failed`);
      
      // Throw a consistent error that can be caught by callers
      const notFoundError = new Error(`Display ${id} not found (previously failed)`);
      (notFoundError as any).status = 404;
      (notFoundError as any).displayId = id;
      (notFoundError as any).permanent = true;
      throw notFoundError;
    }
    
    try {
      const response = await axios.get(`${this.apiUrl}/${id}`, { withCredentials: true });
      
      // If we get data but it doesn't match our expected format, enhance it
      if (response.data) {
        // Ensure the display has an id
        if (!response.data.id && response.data._id) {
          response.data.id = response.data._id;
        }
        
        // Ensure the display has a status
        if (!response.data.status) {
          response.data.status = 'offline';
        }
        
        return response.data;
      } else {
        throw new Error(`Invalid response for display ${id}`);
      }
    } catch (error) {
      console.error(`Error fetching display ${id}:`, error);
      
      // Handle Axios errors with specific information
      if (error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError) {
        const axiosError = error as any;
        
        if (axiosError.response) {
          if (axiosError.response.status === 404) {
            // Mark this display as permanently failed
            markAsFailed(id);
            console.log(`Marked display ${id} as permanently failed due to 404 in display fetch`);
            
            const notFoundError = new Error(`Display ${id} not found`);
            (notFoundError as any).status = 404;
            (notFoundError as any).displayId = id;
            throw notFoundError;
          } else {
            const apiError = new Error(`API error (${axiosError.response.status}): ${axiosError.response.data?.message || axiosError.response.statusText}`);
            (apiError as any).status = axiosError.response.status;
            (apiError as any).displayId = id;
            throw apiError;
          }
        } else if (axiosError.request) {
          // Network errors
          const networkError = new Error(`Network error: Unable to connect to display service`);
          (networkError as any).status = 0;
          (networkError as any).displayId = id;
          (networkError as any).type = 'network';
          throw networkError;
        }
      }
      
      // Re-throw the original error for other cases
      throw error;
    }
  }

  /**
   * Pair a display using pairing code
   */
  async pairDisplay(pairingCode: string, name: string, location: string): Promise<Display> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/pair`, 
        { pairingCode, name, location },
        { withCredentials: true }
      );
      
      if (response.data && response.status >= 200 && response.status < 300) {
        // Ensure the response has the required fields
        if (!response.data.id) {
          throw new Error('API response missing required field: id');
        }
        return response.data;
      } else {
        throw new Error('Pairing failed: Invalid response from server');
      }
    } catch (error) {
      console.error('Error pairing display:', error);
      
      // Extract detailed error message if available
      if (error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError) {
        const axiosError = error as any;
        
        if (axiosError.response && axiosError.response.data && axiosError.response.data.message) {
          throw new Error(`Pairing failed: ${axiosError.response.data.message}`);
        }
      }
      
      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Unpair a display
   */
  async unpairDisplay(id: string): Promise<void> {
    try {
      const response = await axios.delete(`${this.apiUrl}/${id}`, { withCredentials: true });
      
      if (response.status >= 200 && response.status < 300) {
        // If the display was unpaired successfully, mark it as failed to prevent future fetches
        markAsFailed(id);
        return;
      } else {
        throw new Error(`Unpair failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error unpairing display ${id}:`, error);
      
      // Extract detailed error message if available
      if (error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError) {
        const axiosError = error as any;
        
        if (axiosError.response && axiosError.response.data && axiosError.response.data.message) {
          throw new Error(`Unpair failed: ${axiosError.response.data.message}`);
        }
      }
      
      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Get the schedule for a display
   */
  async getDisplaySchedule(id: string): Promise<DisplayScheduleResponse> {
    try {
      const response = await axios.get(`${this.apiUrl}/${id}/schedule`, { withCredentials: true });
      
      if (response.data) {
        return response.data;
      }
      
      // If we get a successful response but no data, return a default structure
      return {
        success: true,
        displayId: id,
        deviceId: '',
        name: '',
        scheduledContent: []
      };
      
    } catch (error) {
      console.error(`Error fetching schedule for display ${id}:`, error);
      
      // Default empty response on error
      return {
        success: false,
        displayId: id,
        deviceId: '',
        name: '',
        scheduledContent: []
      };
    }
  }

  /**
   * Get content by ID
   */
  async getContentById(contentId: string): Promise<Content | null> {
    try {
      const response = await axios.get(`${getApiBaseUrl()}/content/${contentId}`, { withCredentials: true });
      return response.data;
    } catch (error) {
      console.error(`Error fetching content ${contentId}:`, error);
      return null;
    }
  }

  /**
   * Push content to a display
   */
  async pushContentToDisplay(displayId: string, contentId: string): Promise<void> {
    try {
      await axios.post(
        `${this.apiUrl}/${displayId}/content`,
        { contentId },
        { withCredentials: true }
      );
    } catch (error) {
      console.error(`Error pushing content to display ${displayId}:`, error);
      throw error;
    }
  }

  /**
   * Restart a display
   */
  async restartDisplay(id: string): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/${id}/restart`, {}, { withCredentials: true });
    } catch (error) {
      console.error(`Error restarting display ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update display software
   */
  async updateDisplaySoftware(id: string): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/${id}/update`, {}, { withCredentials: true });
    } catch (error) {
      console.error(`Error updating software for display ${id}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const displayService = new DisplayService();

// Also export the class for testing and DI
export default displayService; 