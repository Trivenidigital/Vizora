import axios from 'axios';
import { ContentItem, ContentType } from '../types/content';

// Add Vite env type declaration
declare global {
  interface ImportMetaEnv {
    VITE_API_BASE_URL: string;
  }
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_FILE_TYPES: Record<ContentType, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  webpage: ['text/html', 'text/plain'],
  app: [],
  playlist: [],
  stream: []
};

class ContentService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  }

  private validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
      };
    }

    // Check file type
    const fileType = this.getFileType(file.type);
    if (!fileType) {
      return {
        isValid: false,
        error: 'Unsupported file type'
      };
    }

    const allowedTypes = ALLOWED_FILE_TYPES[fileType];
    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `Invalid file type for ${fileType} content`
      };
    }

    return { isValid: true };
  }

  private getFileType(mimeType: string): ContentType | null {
    if (ALLOWED_FILE_TYPES.image.includes(mimeType)) return 'image';
    if (ALLOWED_FILE_TYPES.video.includes(mimeType)) return 'video';
    if (ALLOWED_FILE_TYPES.document.includes(mimeType)) return 'document';
    if (ALLOWED_FILE_TYPES.webpage.includes(mimeType)) return 'webpage';
    return null;
  }

  async uploadContent(file: File, metadata: Partial<ContentItem>): Promise<ContentItem> {
    // Validate file
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    try {
      // Upload with progress tracking
      const response = await axios.post(`${this.baseUrl}/content/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total!);
          // Emit progress event
          window.dispatchEvent(new CustomEvent('uploadProgress', { detail: { progress } }));
        }
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 413) {
        throw new Error('File size exceeds server limit');
      }
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to upload content');
    }
  }

  async getContentList(params?: {
    search?: string;
    type?: ContentType;
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: ContentItem[]; total: number }> {
    try {
      const response = await axios.get(`${this.baseUrl}/content`, { params });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to fetch content list');
    }
  }

  async getContentById(id: string): Promise<ContentItem> {
    try {
      const response = await axios.get(`${this.baseUrl}/content/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Content not found');
      }
      throw new Error('Failed to fetch content');
    }
  }

  async updateContent(id: string, updates: Partial<ContentItem>): Promise<ContentItem> {
    try {
      const response = await axios.patch(`${this.baseUrl}/content/${id}`, updates);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Content not found');
      }
      throw new Error('Failed to update content');
    }
  }

  async deleteContent(id: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/content/${id}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Content not found');
      }
      throw new Error('Failed to delete content');
    }
  }

  async pushContentToDisplay(contentId: string, displayId: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/content/${contentId}/display/${displayId}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Content or display not found');
      }
      throw new Error('Failed to push content to display');
    }
  }
}

export default new ContentService(); 