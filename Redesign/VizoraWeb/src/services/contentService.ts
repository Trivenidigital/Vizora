/**
 * Content Service
 * Extends the common content service with VizoraWeb-specific functionality
 */

import { apiService } from './apiService';
import { 
  contentService as commonContentService, 
  Content,
  ContentMetadata, 
  UploadProgress 
} from '@vizora/common/services/contentService';

// Re-export types from the common content service
export type { Content, ContentMetadata, UploadProgress } from '@vizora/common/services/contentService';

/**
 * Get content with pagination and filtering
 */
const getContent = async ({ page = 1, limit = 20, folder = null, search = '', sort = 'createdAt', order = 'desc' }): Promise<{
  content: Content[];
  total: number;
  page: number;
  limit: number;
}> => {
  try {
    console.log('[VizoraWeb] Getting content with pagination', { page, limit, folder, search, sort, order });
    
    // Build query string
    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    if (search) queryParams.append('search', search);
    if (folder) queryParams.append('folder', folder);
    queryParams.append('sort', sort);
    queryParams.append('order', order);
    
    const response = await apiService.get(`/content?${queryParams.toString()}`);
    
    if (!response || !response.content) {
      throw new Error('Invalid response from content API');
    }
    
    return {
      content: response.content,
      total: response.total || response.content.length,
      page: response.page || page,
      limit: response.limit || limit
    };
  } catch (error) {
    console.error('[VizoraWeb] ❌ Error getting content:', error);
    // Return empty array to avoid breaking the UI
    return {
      content: [],
      total: 0,
      page,
      limit
    };
  }
};

/**
 * Get a single content item by ID
 */
const getContentById = async (id: string): Promise<Content> => {
  try {
    console.log('[VizoraWeb] Getting content by ID', id);
    
    const response = await apiService.get(`/content/${id}`);
    
    if (!response) {
      throw new Error('Invalid response from content API');
    }
    
    return response;
  } catch (error) {
    console.error('[VizoraWeb] ❌ Error getting content by ID:', error);
    throw error;
  }
};

/**
 * Get all content (simplified version without pagination)
 */
const getContentList = async (): Promise<Content[]> => {
  try {
    console.log('[VizoraWeb] Getting content list');
    
    const response = await getContent({ limit: 100 });
    return response.content;
  } catch (error) {
    console.error('[VizoraWeb] ❌ Error getting content list:', error);
    return [];
  }
};

/**
 * Create new content 
 */
const createContent = async (contentData: Partial<Content>): Promise<Content> => {
  try {
    console.log('[VizoraWeb] Creating content', contentData);
    
    const response = await apiService.post('/content', contentData);
    
    if (!response) {
      throw new Error('Invalid response from content API');
    }
    
    return response;
  } catch (error) {
    console.error('[VizoraWeb] ❌ Error creating content:', error);
    throw error;
  }
};

/**
 * Update content
 */
const updateContent = async (id: string, contentData: Partial<Content>): Promise<Content> => {
  try {
    console.log('[VizoraWeb] Updating content', { id, contentData });
    
    const response = await apiService.put(`/content/${id}`, contentData);
    
    if (!response) {
      throw new Error('Invalid response from content API');
    }
    
    return response;
  } catch (error) {
    console.error('[VizoraWeb] ❌ Error updating content:', error);
    throw error;
  }
};

/**
 * Delete content
 */
const deleteContent = async (id: string): Promise<{ success: boolean }> => {
  try {
    console.log('[VizoraWeb] Deleting content', id);
    
    const response = await apiService.delete(`/content/${id}`);
    
    return { success: true };
  } catch (error) {
    console.error('[VizoraWeb] ❌ Error deleting content:', error);
    throw error;
  }
};

/**
 * Push content to a display
 */
const pushContentToDisplay = async (contentId: string, displayId: string, schedulePayload?: any): Promise<any> => {
  try {
    console.log('[VizoraWeb] Pushing content to display', { contentId, displayId, schedulePayload });
    
    // Use the proper API endpoint for pushing content
    const response = await apiService.post(`/displays/${displayId}/content`, { 
      contentId, 
      schedule: schedulePayload 
    });
    
    if (!response) {
      throw new Error('Invalid response from display API');
    }
    
    console.log('[VizoraWeb] ✅ Content pushed successfully');
    return response;
  } catch (error) {
    console.error('[VizoraWeb] ❌ Error pushing content to display:', error);
    throw error;
  }
};

// Combine the common content service with our web-specific functions
export const contentService = {
  ...commonContentService,
  getContent,
  getContentById,
  getContentList,
  createContent,
  updateContent,
  deleteContent,
  pushContentToDisplay
};

// Log success
console.log('[VizoraWeb] ✅ Initialized contentService correctly'); 