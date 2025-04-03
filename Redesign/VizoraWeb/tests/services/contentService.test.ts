import { describe, expect, it, vi, beforeEach } from 'vitest';
import { contentService } from '../../src/services/contentService';
import api from '../../src/services/api';
import type { Content } from '../../src/services/contentService';
import * as env from '../../src/utils/env';

// Mock the api module
vi.mock('../../src/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the env module
vi.mock('../../src/utils/env', () => ({
  USE_MOCK_DATA: false,
}));

// Cast the mocked api to the correct type
const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('contentService', () => {
  const mockContent: Content[] = [
    {
      id: '1',
      title: 'Test Content 1',
      description: 'Test Description 1',
      type: 'image',
      url: 'https://example.com/image1.jpg',
      displayIds: ['display-1'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      status: 'published',
      category: 'test',
      tags: ['test', 'image'],
      metadata: { resolution: '1920x1080' }
    },
    {
      id: '2',
      title: 'Test Content 2',
      description: 'Test Description 2',
      type: 'video',
      url: 'https://example.com/video1.mp4',
      duration: 60,
      displayIds: ['display-2'],
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      status: 'published',
      category: 'test',
      tags: ['test', 'video'],
      metadata: { resolution: '1920x1080' }
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getContentList', () => {
    it('fetches content from the API', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { data: mockContent } });

      const result = await contentService.getContentList();

      expect(mockedApi.get).toHaveBeenCalledWith('/content');
      expect(result).toEqual(mockContent);
    });

    it('handles API errors', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(contentService.getContentList()).rejects.toThrow('API Error');
    });
  });

  describe('getContentById', () => {
    it('fetches a single content item', async () => {
      const contentId = '1';
      const mockResponse = { data: { data: mockContent[0] } };
      mockedApi.get.mockResolvedValueOnce(mockResponse);

      const result = await contentService.getContentById(contentId);

      expect(mockedApi.get).toHaveBeenCalledWith(`/content/${contentId}`);
      expect(result).toEqual(mockContent[0]);
    });

    it('handles not found error', async () => {
      const contentId = '999';
      mockedApi.get.mockRejectedValueOnce(new Error('Content not found'));

      await expect(contentService.getContentById(contentId)).rejects.toThrow('Content not found');
    });
  });

  describe('createContent', () => {
    it('sends the correct data to the API', async () => {
      const newContent = {
        title: 'New Content',
        description: 'New Description',
        type: 'image' as const,
        url: 'https://example.com/new.jpg',
        displayIds: ['display-1'],
        status: 'published' as const,
        category: 'test',
        tags: ['test', 'image'],
        metadata: { resolution: '1920x1080' }
      };
      const mockResponse = { data: { data: { ...newContent, id: '3', createdAt: '2024-01-03T00:00:00Z', updatedAt: '2024-01-03T00:00:00Z' } } };
      mockedApi.post.mockResolvedValueOnce(mockResponse);

      const result = await contentService.createContent(newContent);

      expect(mockedApi.post).toHaveBeenCalledWith('/content', newContent);
      expect(result).toEqual(mockResponse.data.data);
    });

    it('handles API errors', async () => {
      const newContent = {
        title: 'New Content',
        description: 'New Description',
        type: 'image' as const,
        url: 'https://example.com/new.jpg',
        displayIds: ['display-1'],
        status: 'published' as const,
        category: 'test',
        tags: ['test', 'image'],
        metadata: { resolution: '1920x1080' }
      };
      mockedApi.post.mockRejectedValueOnce(new Error('API Error'));

      await expect(contentService.createContent(newContent)).rejects.toThrow('API Error');
    });
  });

  describe('pushContentToDisplay', () => {
    it('sends the correct request', async () => {
      const contentId = '1';
      const displayId = 'display1';
      const mockResponse = { data: { success: true, message: 'Content pushed successfully' } };
      mockedApi.post.mockResolvedValueOnce(mockResponse);

      await contentService.pushContentToDisplay(contentId, displayId);

      expect(mockedApi.post).toHaveBeenCalledWith(`/displays/${displayId}/content`, { contentId });
    });

    it('handles error when content not found', async () => {
      const contentId = '999';
      const displayId = 'display1';
      mockedApi.post.mockRejectedValueOnce(new Error('Content not found'));

      await expect(contentService.pushContentToDisplay(contentId, displayId)).rejects.toThrow('Content not found');
    });
  });
}); 