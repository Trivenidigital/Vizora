import { vi } from 'vitest';
import { ContentService } from '../../../services/contentService';
import { Content, ContentAnalytics } from '../../../types/content';

// Mock data
const mockContent: Content = {
  id: '1',
  title: 'Test Content',
  type: 'image',
  url: 'https://example.com/test.jpg',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: {
    duration: 30,
    size: 1024,
    format: 'jpg'
  }
};

const mockAnalytics: ContentAnalytics = {
  views: 100,
  interactions: 50,
  lastViewed: new Date().toISOString(),
  completionRate: 0.8
};

describe('ContentService', () => {
  let contentService: ContentService;
  let mockedApi: any;

  beforeEach(() => {
    mockedApi = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };
    contentService = new ContentService(mockedApi);
  });

  describe('getContentList', () => {
    it('should fetch content list successfully', async () => {
      const mockResponse = { data: [mockContent] };
      mockedApi.get.mockResolvedValueOnce(mockResponse);

      const result = await contentService.getContentList();

      expect(result).toEqual([mockContent]);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/content');
    });

    it('should handle error when fetching content list', async () => {
      const error = new Error('Failed to fetch content');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(contentService.getContentList()).rejects.toThrow('Failed to fetch content');
    });
  });

  describe('getContentById', () => {
    it('should fetch content by id successfully', async () => {
      const mockResponse = { data: mockContent };
      mockedApi.get.mockResolvedValueOnce(mockResponse);

      const result = await contentService.getContentById('1');

      expect(result).toEqual(mockContent);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/content/1');
    });

    it('should handle error when fetching content by id', async () => {
      const error = new Error('Content not found');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(contentService.getContentById('1')).rejects.toThrow('Content not found');
    });
  });

  describe('createContent', () => {
    it('should create content successfully', async () => {
      const mockResponse = { data: mockContent };
      mockedApi.post.mockResolvedValueOnce(mockResponse);

      const result = await contentService.createContent(mockContent);

      expect(result).toEqual(mockContent);
      expect(mockedApi.post).toHaveBeenCalledWith('/api/content', mockContent);
    });

    it('should handle error when creating content', async () => {
      const error = new Error('Failed to create content');
      mockedApi.post.mockRejectedValueOnce(error);

      await expect(contentService.createContent(mockContent)).rejects.toThrow('Failed to create content');
    });
  });

  describe('updateContent', () => {
    it('should update content successfully', async () => {
      const mockResponse = { data: mockContent };
      mockedApi.put.mockResolvedValueOnce(mockResponse);

      const result = await contentService.updateContent('1', mockContent);

      expect(result).toEqual(mockContent);
      expect(mockedApi.put).toHaveBeenCalledWith('/api/content/1', mockContent);
    });

    it('should handle error when updating content', async () => {
      const error = new Error('Failed to update content');
      mockedApi.put.mockRejectedValueOnce(error);

      await expect(contentService.updateContent('1', mockContent)).rejects.toThrow('Failed to update content');
    });
  });

  describe('deleteContent', () => {
    it('should delete content successfully', async () => {
      mockedApi.delete.mockResolvedValueOnce({ data: null });

      await contentService.deleteContent('1');

      expect(mockedApi.delete).toHaveBeenCalledWith('/api/content/1');
    });

    it('should handle error when deleting content', async () => {
      const error = new Error('Failed to delete content');
      mockedApi.delete.mockRejectedValueOnce(error);

      await expect(contentService.deleteContent('1')).rejects.toThrow('Failed to delete content');
    });
  });

  describe('scheduleContent', () => {
    it('should schedule content successfully', async () => {
      const schedule = {
        contentId: '1',
        displayId: 'display1',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString()
      };
      const mockResponse = { data: schedule };
      mockedApi.post.mockResolvedValueOnce(mockResponse);

      const result = await contentService.scheduleContent(schedule);

      expect(result).toEqual(schedule);
      expect(mockedApi.post).toHaveBeenCalledWith('/api/content/schedule', schedule);
    });

    it('should handle error when scheduling content', async () => {
      const error = new Error('Failed to schedule content');
      mockedApi.post.mockRejectedValueOnce(error);

      await expect(contentService.scheduleContent({} as any)).rejects.toThrow('Failed to schedule content');
    });
  });

  describe('getContentAnalytics', () => {
    it('should fetch content analytics successfully', async () => {
      const mockResponse = { data: mockAnalytics };
      mockedApi.get.mockResolvedValueOnce(mockResponse);

      const result = await contentService.getContentAnalytics('1');

      expect(result).toEqual(mockAnalytics);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/content/1/analytics');
    });

    it('should handle error when fetching content analytics', async () => {
      const error = new Error('Failed to fetch analytics');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(contentService.getContentAnalytics('1')).rejects.toThrow('Failed to fetch analytics');
    });
  });

  describe('uploadContent', () => {
    it('should upload content successfully', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const mockResponse = { data: mockContent };
      mockedApi.post.mockResolvedValueOnce(mockResponse);

      const result = await contentService.uploadContent(file);

      expect(result).toEqual(mockContent);
      expect(mockedApi.post).toHaveBeenCalledWith('/api/content/upload', expect.any(FormData));
    });

    it('should handle error when uploading content', async () => {
      const error = new Error('Failed to upload content');
      mockedApi.post.mockRejectedValueOnce(error);

      await expect(contentService.uploadContent(new File([], ''))).rejects.toThrow('Failed to upload content');
    });
  });
}); 