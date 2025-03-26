// Content Service for Vizora
import { authFetch, API_URL } from '../utils/auth';

// Types
export interface ContentItem {
  _id: string;
  name: string;
  type: string;
  url: string;
  thumbnail?: string;
  duration?: number;
  size?: number;
  width?: number;
  height?: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentStats {
  total: number;
  images: number;
  videos: number;
  documents: number;
  other: number;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'error' | 'completed';
  error?: string;
}

export interface DisplayContent {
  _id: string;
  displayId: string;
  contentId: string;
  content: ContentItem;
  order: number;
  duration?: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// Content update interface
export interface ContentUpdate {
  type: 'text' | 'image' | 'video' | 'html';
  content: {
    text?: string;
    fontSize?: string;
    bgColor?: string;
    textColor?: string;
    url?: string;
    html?: string;
    [key: string]: any;
  };
}

// Mock content data for development
const mockContentItems: ContentItem[] = [
  {
    id: '1',
    title: 'Product Overview',
    description: 'A comprehensive overview of our flagship product',
    thumbnailUrl: 'https://via.placeholder.com/300x200?text=Product+Overview',
    mediaUrl: 'https://example.com/product-overview.mp4',
    mediaType: 'video',
    tags: ['product', 'overview', 'marketing'],
    createdAt: '2023-01-15T12:00:00Z',
    updatedAt: '2023-01-15T12:00:00Z',
    createdBy: 'john.doe@example.com'
  },
  {
    id: '2',
    title: 'Q1 Sales Presentation',
    description: 'Quarterly sales results and projections',
    thumbnailUrl: 'https://via.placeholder.com/300x200?text=Q1+Sales',
    mediaUrl: 'https://example.com/q1-sales.pptx',
    mediaType: 'presentation',
    tags: ['sales', 'quarterly', 'presentation'],
    createdAt: '2023-04-05T09:30:00Z',
    updatedAt: '2023-04-05T09:30:00Z',
    createdBy: 'jane.smith@example.com'
  },
  {
    id: '3',
    title: 'Company Logo',
    description: 'Official company logo in various formats',
    thumbnailUrl: 'https://via.placeholder.com/300x200?text=Company+Logo',
    mediaUrl: 'https://example.com/logo.png',
    mediaType: 'image',
    tags: ['branding', 'design', 'logo'],
    createdAt: '2022-11-20T15:45:00Z',
    updatedAt: '2023-02-10T11:20:00Z',
    createdBy: 'design@example.com'
  }
];

/**
 * Service for managing content items (images, videos, etc.)
 */
class ContentService {
  private contentApi: string;
  
  constructor() {
    this.contentApi = `${API_URL}/content`;
  }

  /**
   * Get all content items for the current user
   * @returns Promise with content items
   */
  async getAllContent(): Promise<ContentItem[]> {
    try {
      const response = await authFetch(this.contentApi);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch content');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching content:', error);
      throw error;
    }
  }

  /**
   * Get statistics about content (counts by type)
   * @returns Promise with content statistics
   */
  async getContentStats(): Promise<ContentStats> {
    try {
      const response = await authFetch(`${this.contentApi}/stats`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch content stats');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching content stats:', error);
      throw error;
    }
  }

  /**
   * Get a single content item by ID
   * @param id Content ID
   * @returns Promise with content item
   */
  async getContentById(id: string): Promise<ContentItem> {
    try {
      const response = await authFetch(`${this.contentApi}/${id}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch content item');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching content item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Upload a new content item
   * @param file File to upload
   * @param onProgress Progress callback
   * @returns Promise with the created content item
   */
  async uploadContent(
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<ContentItem> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Get auth token manually since we can't use authFetch with XMLHttpRequest
      const token = localStorage.getItem('vizora-auth-token');
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.open('POST', this.contentApi, true);
        
        // Set auth header if token exists
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        
        // Track upload progress
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        };
        
        // Handle response
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } else {
            let errorMessage = 'Upload failed';
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = errorData.message || errorMessage;
            } catch (e) {
              // If response is not valid JSON, use default error message
            }
            reject(new Error(errorMessage));
          }
        };
        
        // Handle errors
        xhr.onerror = () => {
          reject(new Error('Network error during upload'));
        };
        
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Error uploading content:', error);
      throw error;
    }
  }

  /**
   * Delete a content item
   * @param id Content ID to delete
   * @returns Promise with the deletion result
   */
  async deleteContent(id: string): Promise<void> {
    try {
      const response = await authFetch(`${this.contentApi}/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete content');
      }
    } catch (error) {
      console.error(`Error deleting content ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Update a content item
   * @param id Content ID
   * @param data Data to update
   * @returns Promise with the updated content
   */
  async updateContent(id: string, data: Partial<ContentItem>): Promise<ContentItem> {
    try {
      const response = await authFetch(`${this.contentApi}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update content');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error updating content ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Assign content to a display
   * @param displayId Display ID
   * @param contentIds Array of content IDs to assign
   * @returns Promise with the assignment result
   */
  async assignContentToDisplay(displayId: string, contentIds: string[]): Promise<DisplayContent[]> {
    try {
      const response = await authFetch(`${API_URL}/displays/${displayId}/content`, {
        method: 'POST',
        body: JSON.stringify({ contentIds })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to assign content to display');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error assigning content to display ${displayId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get content assigned to a display
   * @param displayId Display ID
   * @returns Promise with display content
   */
  async getDisplayContent(displayId: string): Promise<DisplayContent[]> {
    try {
      const response = await authFetch(`${API_URL}/displays/${displayId}/content`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch display content');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching content for display ${displayId}:`, error);
      throw error;
    }
  }
  
  /**
   * Remove content from a display
   * @param displayId Display ID
   * @param contentId Content ID to remove
   * @returns Promise with the removal result
   */
  async removeContentFromDisplay(displayId: string, contentId: string): Promise<void> {
    try {
      const response = await authFetch(`${API_URL}/displays/${displayId}/content/${contentId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove content from display');
      }
    } catch (error) {
      console.error(`Error removing content ${contentId} from display ${displayId}:`, error);
      throw error;
    }
  }
  
  /**
   * Update the order of content on a display
   * @param displayId Display ID
   * @param orderedContentIds Array of content IDs in desired order
   * @returns Promise with the updated display content
   */
  async updateContentOrder(displayId: string, orderedContentIds: string[]): Promise<DisplayContent[]> {
    try {
      const response = await authFetch(`${API_URL}/displays/${displayId}/content/order`, {
        method: 'PUT',
        body: JSON.stringify({ contentIds: orderedContentIds })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update content order');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error updating content order for display ${displayId}:`, error);
      throw error;
    }
  }

  /**
   * Push content to a display
   * @param displayId Display ID
   * @param content Content update data
   * @returns Promise with success status
   */
  async pushContent(displayId: string, content: ContentUpdate): Promise<boolean> {
    try {
      const response = await authFetch(`${API_URL}/displays/${displayId}/content`, {
        method: 'POST',
        body: JSON.stringify(content)
      });
      
      return response.ok;
    } catch (error) {
      console.error(`Error pushing content to display ${displayId}:`, error);
      return false;
    }
  }
}

// Export a singleton instance
export const contentService = new ContentService(); 