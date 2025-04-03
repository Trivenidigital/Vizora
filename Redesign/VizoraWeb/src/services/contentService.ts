import { apiService } from './apiService';

interface Content {
  id: string;
  name: string;
  type: 'image' | 'video' | 'html' | 'text' | 'playlist';
  description?: string;
  duration: number;
  url: string;
  thumbnail?: string;
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
    duration?: number;
    fps?: number;
    bitrate?: number;
    codec?: string;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  status: 'draft' | 'published' | 'archived';
  version: number;
  schedule?: {
    startTime: string;
    endTime: string;
    timezone: string;
    repeat: 'none' | 'daily' | 'weekly' | 'monthly';
    daysOfWeek?: number[];
  };
}

interface ContentFilters {
  type?: Content['type'];
  status?: Content['status'];
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

interface ContentStats {
  total: number;
  byType: {
    type: Content['type'];
    count: number;
  }[];
  byStatus: {
    status: Content['status'];
    count: number;
  }[];
  recent: Content[];
}

class ContentService {
  async getContents(filters?: ContentFilters): Promise<{ contents: Content[]; total: number }> {
    try {
      const response = await apiService.get<{ contents: Content[]; total: number }>('/contents', {
        params: filters,
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getContent(id: string): Promise<Content> {
    try {
      const response = await apiService.get<{ content: Content }>(`/contents/${id}`);
      return response.content;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createContent(data: Omit<Content, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'version'>): Promise<Content> {
    try {
      const response = await apiService.post<{ content: Content }>('/contents', data);
      return response.content;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateContent(id: string, data: Partial<Content>): Promise<Content> {
    try {
      const response = await apiService.put<{ content: Content }>(`/contents/${id}`, data);
      return response.content;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteContent(id: string): Promise<void> {
    try {
      await apiService.delete(`/contents/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getContentStats(): Promise<ContentStats> {
    try {
      const response = await apiService.get<{ stats: ContentStats }>('/contents/stats');
      return response.stats;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async uploadContent(file: File, onProgress?: (progress: number) => void): Promise<Content> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiService.post<{ content: Content }>('/contents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            onProgress(progress);
          }
        },
      });
      return response.content;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async publishContent(id: string): Promise<Content> {
    try {
      const response = await apiService.post<{ content: Content }>(`/contents/${id}/publish`);
      return response.content;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async archiveContent(id: string): Promise<Content> {
    try {
      const response = await apiService.post<{ content: Content }>(`/contents/${id}/archive`);
      return response.content;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async duplicateContent(id: string): Promise<Content> {
    try {
      const response = await apiService.post<{ content: Content }>(`/contents/${id}/duplicate`);
      return response.content;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getContentVersions(id: string): Promise<Content[]> {
    try {
      const response = await apiService.get<{ versions: Content[] }>(`/contents/${id}/versions`);
      return response.versions;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async restoreContentVersion(id: string, version: number): Promise<Content> {
    try {
      const response = await apiService.post<{ content: Content }>(`/contents/${id}/versions/${version}/restore`);
      return response.content;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error('An unexpected error occurred');
  }
}

export default new ContentService(); 