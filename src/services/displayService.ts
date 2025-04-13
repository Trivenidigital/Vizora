import axios from 'axios';
import { Display, ContentSchedule, ContentPush, DisplayContent, DisplayConfig } from '../types/display';
import { Content } from '../types/content';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class DisplayService {
  // Display operations
  async getDisplayList() {
    try {
      const response = await axios.get(`${API_URL}/displays`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch display list');
    }
  }

  async getDisplayById(id: string) {
    try {
      const response = await axios.get(`${API_URL}/displays/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Display not found');
      }
      throw new Error('Failed to fetch display details');
    }
  }

  async updateDisplay(id: string, updates: Partial<Display>) {
    try {
      const response = await axios.put(`${API_URL}/displays/${id}`, updates);
      return response.data;
    } catch (error) {
      throw new Error('Failed to update display');
    }
  }

  async updateDisplayConfig(id: string, config: DisplayConfig) {
    try {
      const response = await axios.put(`${API_URL}/displays/${id}/config`, config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Display not found');
      }
      throw new Error('Failed to update display configuration');
    }
  }

  async getDisplayStatus(id: string) {
    try {
      const response = await axios.get(`${API_URL}/displays/${id}/status`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Display not found');
      }
      throw new Error('Failed to fetch display status');
    }
  }

  async restartDisplay(id: string) {
    try {
      const response = await axios.post(`${API_URL}/displays/${id}/restart`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Display not found');
      }
      throw new Error('Failed to restart display');
    }
  }

  // Content scheduling operations
  async scheduleContent(
    contentId: string,
    displayId: string,
    schedule: Omit<ContentSchedule, 'id' | 'createdAt' | 'updatedAt' | 'owner'>
  ): Promise<ContentSchedule> {
    const response = await axios.post(`${API_URL}/schedules`, {
      contentId,
      displayId,
      ...schedule
    });
    return response.data;
  }

  async getSchedules(displayId: string): Promise<ContentSchedule[]> {
    const response = await axios.get(`${API_URL}/schedules`, {
      params: { displayId }
    });
    return response.data;
  }

  async updateSchedule(id: string, schedule: Partial<ContentSchedule>): Promise<ContentSchedule> {
    const response = await axios.patch(`${API_URL}/schedules/${id}`, schedule);
    return response.data;
  }

  async deleteSchedule(id: string): Promise<void> {
    await axios.delete(`${API_URL}/schedules/${id}`);
  }

  // Content push operations
  async pushContent(contentId: string, displayId: string): Promise<ContentPush> {
    const response = await axios.post(`${API_URL}/pushes`, {
      contentId,
      displayId
    });
    return response.data;
  }

  async getPushes(displayId: string): Promise<ContentPush[]> {
    const response = await axios.get(`${API_URL}/pushes`, {
      params: { displayId }
    });
    return response.data;
  }

  // Display content operations
  async getDisplayContent(displayId: string): Promise<DisplayContent[]> {
    const response = await axios.get(`${API_URL}/displays/${displayId}/content`);
    return response.data;
  }

  // Schedule conflict detection
  async checkScheduleConflicts(
    displayId: string,
    startTime: string,
    endTime: string,
    excludeScheduleId?: string
  ): Promise<ContentSchedule[]> {
    const response = await axios.get(`${API_URL}/schedules/conflicts`, {
      params: {
        displayId,
        startTime,
        endTime,
        excludeScheduleId
      }
    });
    return response.data;
  }

  // Bulk operations
  async pushContentToDisplays(contentId: string, displayIds: string[]): Promise<ContentPush[]> {
    const response = await axios.post(`${API_URL}/pushes/bulk`, {
      contentId,
      displayIds
    });
    return response.data;
  }

  async scheduleContentForDisplays(
    contentId: string,
    displayIds: string[],
    schedule: Omit<ContentSchedule, 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'displayId'>
  ): Promise<ContentSchedule[]> {
    const response = await axios.post(`${API_URL}/schedules/bulk`, {
      contentId,
      displayIds,
      ...schedule
    });
    return response.data;
  }
}

export default new DisplayService(); 