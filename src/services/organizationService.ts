import axios from 'axios';
import { Folder, Tag, ContentOrganization } from '../types/organization';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const organizationService = {
  // Folder operations
  async createFolder(folder: Partial<Folder>) {
    try {
      const response = await axios.post(`${API_URL}/folders`, folder);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to create folder');
    }
  },

  async getFolders() {
    try {
      const response = await axios.get(`${API_URL}/folders`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch folders');
    }
  },

  async getFolderById(id: string) {
    try {
      const response = await axios.get(`${API_URL}/folders/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Folder not found');
      }
      throw new Error('Failed to fetch folder');
    }
  },

  async updateFolder(id: string, updates: Partial<Folder>) {
    try {
      const response = await axios.put(`${API_URL}/folders/${id}`, updates);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Folder not found');
      }
      throw new Error('Failed to update folder');
    }
  },

  async deleteFolder(id: string) {
    try {
      await axios.delete(`${API_URL}/folders/${id}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Folder not found');
      }
      throw new Error('Failed to delete folder');
    }
  },

  // Tag operations
  async createTag(tag: Partial<Tag>) {
    try {
      const response = await axios.post(`${API_URL}/tags`, tag);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to create tag');
    }
  },

  async getTags() {
    try {
      const response = await axios.get(`${API_URL}/tags`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch tags');
    }
  },

  async getTagById(id: string) {
    try {
      const response = await axios.get(`${API_URL}/tags/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Tag not found');
      }
      throw new Error('Failed to fetch tag');
    }
  },

  async updateTag(id: string, updates: Partial<Tag>) {
    try {
      const response = await axios.put(`${API_URL}/tags/${id}`, updates);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Tag not found');
      }
      throw new Error('Failed to update tag');
    }
  },

  async deleteTag(id: string) {
    try {
      await axios.delete(`${API_URL}/tags/${id}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Tag not found');
      }
      throw new Error('Failed to delete tag');
    }
  },

  // Content organization operations
  async updateContentOrganization(contentId: string, organization: ContentOrganization) {
    try {
      await axios.put(`${API_URL}/content/${contentId}/organization`, organization);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Content not found');
      }
      throw new Error('Failed to update content organization');
    }
  },

  async getContentByOrganization(filters: Partial<ContentOrganization>) {
    try {
      const response = await axios.get(`${API_URL}/content/organization`, { params: filters });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch content by organization');
    }
  }
}; 