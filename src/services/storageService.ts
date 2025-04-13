import axios from 'axios';
import { StorageInfo, StorageConfig } from '../types/storage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const storageService = {
  async getStorageInfo() {
    try {
      const response = await axios.get(`${API_URL}/storage/info`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch storage information');
    }
  },

  async getStorageConfig() {
    try {
      const response = await axios.get(`${API_URL}/storage/config`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch storage configuration');
    }
  },

  async updateStorageConfig(config: StorageConfig) {
    try {
      const response = await axios.put(`${API_URL}/storage/config`, config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to update storage configuration');
    }
  },

  async clearStorage() {
    try {
      const response = await axios.post(`${API_URL}/storage/clear`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to clear storage');
    }
  },

  async getStorageUsage() {
    try {
      const response = await axios.get(`${API_URL}/storage/usage`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch storage usage');
    }
  },

  getItem: (key: string): string | null => {
    // Implementation will be mocked in tests
    throw new Error('Not implemented');
  },

  setItem: (key: string, value: string): void => {
    // Implementation will be mocked in tests
    throw new Error('Not implemented');
  },

  removeItem: (key: string): void => {
    // Implementation will be mocked in tests
    throw new Error('Not implemented');
  }
};

export default storageService; 