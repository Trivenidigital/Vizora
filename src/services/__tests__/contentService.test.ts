import { vi, describe, it, expect, beforeEach } from 'vitest';
import axios from 'axios';
import contentService from '../contentService';
import { ContentItem, ContentType } from '../../types/content';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ContentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadContent', () => {
    it('should validate file size correctly', async () => {
      const largeFile = new File(['x'.repeat(101 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      
      await expect(contentService.uploadContent(largeFile, { title: 'Test' }))
        .rejects
        .toThrow('File size exceeds 100MB limit');
    });

    it('should validate file type correctly', async () => {
      const invalidFile = new File(['x'], 'test.exe', { type: 'application/x-msdownload' });
      
      await expect(contentService.uploadContent(invalidFile, { title: 'Test' }))
        .rejects
        .toThrow('Unsupported file type');
    });

    it('should upload valid file successfully', async () => {
      const validFile = new File(['x'], 'test.jpg', { type: 'image/jpeg' });
      const mockResponse: ContentItem = {
        id: '1',
        title: 'Test',
        type: 'image',
        url: 'http://example.com/test.jpg',
        status: 'published',
        tags: [],
        owner: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await contentService.uploadContent(validFile, { title: 'Test' });
      expect(result).toEqual(mockResponse);
    });

    it('should handle upload errors correctly', async () => {
      const validFile = new File(['x'], 'test.jpg', { type: 'image/jpeg' });
      mockedAxios.post.mockRejectedValueOnce({ response: { status: 413 } });

      await expect(contentService.uploadContent(validFile, { title: 'Test' }))
        .rejects
        .toThrow('File size exceeds server limit');
    });
  });

  describe('getContentList', () => {
    it('should fetch content list with parameters', async () => {
      const mockResponse = {
        items: [],
        total: 0
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const params = {
        search: 'test',
        type: 'image' as ContentType,
        status: 'published',
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc' as const
      };

      const result = await contentService.getContentList(params);
      expect(result).toEqual(mockResponse);
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/content', { params });
    });

    it('should handle authentication errors', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } });

      await expect(contentService.getContentList())
        .rejects
        .toThrow('Authentication required');
    });
  });

  describe('getContentById', () => {
    it('should fetch content by id', async () => {
      const mockContent: ContentItem = {
        id: '1',
        title: 'Test',
        type: 'image',
        url: 'http://example.com/test.jpg',
        status: 'published',
        tags: [],
        owner: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockContent });

      const result = await contentService.getContentById('1');
      expect(result).toEqual(mockContent);
    });

    it('should handle not found errors', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 404 } });

      await expect(contentService.getContentById('1'))
        .rejects
        .toThrow('Content not found');
    });
  });

  describe('updateContent', () => {
    it('should update content successfully', async () => {
      const updates = { title: 'Updated Title' };
      const mockResponse: ContentItem = {
        id: '1',
        title: 'Updated Title',
        type: 'image',
        url: 'http://example.com/test.jpg',
        status: 'published',
        tags: [],
        owner: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockedAxios.patch.mockResolvedValueOnce({ data: mockResponse });

      const result = await contentService.updateContent('1', updates);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteContent', () => {
    it('should delete content successfully', async () => {
      mockedAxios.delete.mockResolvedValueOnce({});

      await expect(contentService.deleteContent('1')).resolves.not.toThrow();
    });
  });

  describe('pushContentToDisplay', () => {
    it('should push content to display successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({});

      await expect(contentService.pushContentToDisplay('1', 'display-1')).resolves.not.toThrow();
    });

    it('should handle not found errors', async () => {
      mockedAxios.post.mockRejectedValueOnce({ response: { status: 404 } });

      await expect(contentService.pushContentToDisplay('1', 'display-1'))
        .rejects
        .toThrow('Content or display not found');
    });
  });
}); 