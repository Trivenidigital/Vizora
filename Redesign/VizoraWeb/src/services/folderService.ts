import { apiClient } from '@/lib/apiClient';

export interface Folder {
  id: string;
  name: string;
  description?: string;
  path: string;
  isRoot: boolean;
  createdAt: string;
  updatedAt: string;
  parentFolder?: string;
}

class FolderService {
  /**
   * Get all folders
   */
  async getAllFolders(): Promise<Folder[]> {
    try {
      // Adding debug output to check the API call
      console.log('FolderService: Fetching all folders');
      
      // The API client already includes /api in the baseURL, so we should use /folders not /api/folders
      const response = await apiClient.get<{ success: boolean; data: Folder[] }>('/folders');
      
      console.log('FolderService: Received response', response.status);
      
      // Check if response.data has the expected structure
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        console.log(`FolderService: Successfully retrieved ${response.data.data.length} folders`);
        return response.data.data;
      } else if (response.data && response.data.folders && Array.isArray(response.data.folders)) {
        // Handle potential alternative response structure
        console.log(`FolderService: Successfully retrieved ${response.data.folders.length} folders (alternate format)`);
        return response.data.folders;
      } else {
        console.error('Invalid response format from /folders endpoint:', response.data);
        return []; // Return empty array rather than undefined
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      // Log more details if it's an Axios error
      if (error.response) {
        console.error('Response error data:', error.response.data);
        console.error('Response error status:', error.response.status);
        console.error('Response error headers:', error.response.headers);
      } else if (error.request) {
        console.error('No response received for request:', error.request);
      }
      return []; // Return empty array on error instead of throwing
    }
  }

  /**
   * Get folder by ID
   */
  async getFolderById(folderId: string): Promise<Folder> {
    const response = await apiClient.get<{ success: boolean; folder: Folder }>(`/folders/${folderId}`);
    return response.data.folder;
  }

  /**
   * Create a new folder
   */
  async createFolder(folderData: { name: string; description?: string; parentFolder?: string }): Promise<Folder> {
    const response = await apiClient.post<{ success: boolean; folder: Folder }>('/folders', folderData);
    return response.data.folder;
  }

  /**
   * Update a folder
   */
  async updateFolder(folderId: string, folderData: { name?: string; description?: string }): Promise<Folder> {
    const response = await apiClient.patch<{ success: boolean; folder: Folder }>(`/folders/${folderId}`, folderData);
    return response.data.folder;
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderId: string): Promise<void> {
    await apiClient.delete(`/folders/${folderId}`);
  }

  /**
   * Get content in a folder
   */
  async getFolderContent(folderId: string, page = 1, limit = 20): Promise<any> {
    const response = await apiClient.get<any>(`/folders/${folderId}/content`, {
      params: { page, limit }
    });
    return response.data;
  }
}

export const folderService = new FolderService(); 