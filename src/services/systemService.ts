import axios from 'axios';
import { SystemStatus, SystemConfig } from '../types/system';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const systemService = {
  async getSystemStatus() {
    try {
      const response = await axios.get(`${API_URL}/system/status`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch system status');
    }
  },

  async getSystemConfig() {
    try {
      const response = await axios.get(`${API_URL}/system/config`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch system configuration');
    }
  },

  async updateSystemConfig(config: SystemConfig) {
    try {
      const response = await axios.put(`${API_URL}/system/config`, config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to update system configuration');
    }
  },

  async restartSystem() {
    try {
      const response = await axios.post(`${API_URL}/system/restart`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to restart system');
    }
  },

  async getSystemLogs() {
    try {
      const response = await axios.get(`${API_URL}/system/logs`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch system logs');
    }
  },
};

export default systemService; 