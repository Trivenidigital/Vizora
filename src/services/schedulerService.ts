import axios from 'axios';
import { Schedule, ScheduleConfig } from '../types/schedule';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const schedulerService = {
  async createSchedule(schedule: Partial<Schedule>) {
    try {
      const response = await axios.post(`${API_URL}/schedules`, schedule);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to create schedule');
    }
  },

  async getSchedules() {
    try {
      const response = await axios.get(`${API_URL}/schedules`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch schedules');
    }
  },

  async getScheduleById(id: string) {
    try {
      const response = await axios.get(`${API_URL}/schedules/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Schedule not found');
      }
      throw new Error('Failed to fetch schedule');
    }
  },

  async updateSchedule(id: string, updates: Partial<Schedule>) {
    try {
      const response = await axios.put(`${API_URL}/schedules/${id}`, updates);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Schedule not found');
      }
      throw new Error('Failed to update schedule');
    }
  },

  async deleteSchedule(id: string) {
    try {
      await axios.delete(`${API_URL}/schedules/${id}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Schedule not found');
      }
      throw new Error('Failed to delete schedule');
    }
  },

  async getScheduleConfig() {
    try {
      const response = await axios.get(`${API_URL}/schedules/config`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch schedule config');
    }
  },

  async updateScheduleConfig(config: ScheduleConfig) {
    try {
      const response = await axios.put(`${API_URL}/schedules/config`, config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to update schedule config');
    }
  },

  async getScheduleStatus(id: string) {
    try {
      const response = await axios.get(`${API_URL}/schedules/${id}/status`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Schedule not found');
      }
      throw new Error('Failed to fetch schedule status');
    }
  },

  async pauseSchedule(id: string) {
    try {
      await axios.post(`${API_URL}/schedules/${id}/pause`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Schedule not found');
      }
      throw new Error('Failed to pause schedule');
    }
  },

  async resumeSchedule(id: string) {
    try {
      await axios.post(`${API_URL}/schedules/${id}/resume`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Schedule not found');
      }
      throw new Error('Failed to resume schedule');
    }
  }
}; 