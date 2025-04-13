import { vi } from 'vitest';

// Types
export interface Content {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'video' | 'text' | 'html';
  url?: string;
  content?: string;
  duration?: number;
  startDate?: string;
  endDate?: string;
  displayIds: string[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'published' | 'archived';
  category?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ContentAnalytics {
  views: number;
  interactions: number;
  duration: number;
  lastViewed: string;
}

// Mock data
export const mockContent: Content = {
  id: '1',
  title: 'Test Content',
  description: 'Test video content',
  type: 'video',
  url: 'https://example.com/test.mp4',
  duration: 60,
  displayIds: ['display-1'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  status: 'published',
  category: 'test',
  tags: ['test', 'video'],
  metadata: { resolution: '1920x1080' }
};

export const mockAnalytics: ContentAnalytics = {
  views: 100,
  interactions: 50,
  duration: 300,
  lastViewed: '2024-01-01T00:00:00Z'
};

// Mock service
export const contentService = {
  getContentList: vi.fn().mockResolvedValue([mockContent]),
  getContentById: vi.fn().mockResolvedValue(mockContent),
  createContent: vi.fn().mockResolvedValue(mockContent),
  updateContent: vi.fn().mockResolvedValue(mockContent),
  deleteContent: vi.fn().mockResolvedValue(undefined),
  scheduleContent: vi.fn().mockResolvedValue(undefined),
  getContentAnalytics: vi.fn().mockResolvedValue(mockAnalytics),
  uploadContent: vi.fn().mockResolvedValue(mockContent),
  pushContentToDisplay: vi.fn().mockResolvedValue(undefined),
  validateContent: vi.fn().mockResolvedValue({ isValid: true, errors: [] }),
  cacheContent: vi.fn().mockResolvedValue(undefined),
  getCachedContent: vi.fn().mockResolvedValue(mockContent),
  invalidateContentCache: vi.fn().mockResolvedValue(undefined),
  validateContentType: vi.fn().mockResolvedValue(true),
  validateContentUrl: vi.fn().mockResolvedValue(true),
  downloadContent: vi.fn().mockResolvedValue(mockContent),
  convertContentFormat: vi.fn().mockResolvedValue({ ...mockContent, format: 'mp4' }),
  extractContentMetadata: vi.fn().mockResolvedValue({
    type: 'video',
    size: 1024,
    dimensions: { width: 1920, height: 1080 },
    duration: 60,
    format: 'mp4'
  })
};

// Reset function
export const resetContentServiceMocks = () => {
  contentService.getContentList.mockClear().mockResolvedValue([mockContent]);
  contentService.getContentById.mockClear().mockResolvedValue(mockContent);
  contentService.createContent.mockClear().mockResolvedValue(mockContent);
  contentService.updateContent.mockClear().mockResolvedValue(mockContent);
  contentService.deleteContent.mockClear().mockResolvedValue(undefined);
  contentService.scheduleContent.mockClear().mockResolvedValue(undefined);
  contentService.getContentAnalytics.mockClear().mockResolvedValue(mockAnalytics);
  contentService.uploadContent.mockClear().mockResolvedValue(mockContent);
  contentService.pushContentToDisplay.mockClear().mockResolvedValue(undefined);
  contentService.validateContent.mockClear().mockResolvedValue({ isValid: true, errors: [] });
  contentService.cacheContent.mockClear().mockResolvedValue(undefined);
  contentService.getCachedContent.mockClear().mockResolvedValue(mockContent);
  contentService.invalidateContentCache.mockClear().mockResolvedValue(undefined);
  contentService.validateContentType.mockClear().mockResolvedValue(true);
  contentService.validateContentUrl.mockClear().mockResolvedValue(true);
  contentService.downloadContent.mockClear().mockResolvedValue(mockContent);
  contentService.convertContentFormat.mockClear().mockResolvedValue({ ...mockContent, format: 'mp4' });
  contentService.extractContentMetadata.mockClear().mockResolvedValue({
    type: 'video',
    size: 1024,
    dimensions: { width: 1920, height: 1080 },
    duration: 60,
    format: 'mp4'
  });
};

// Default export should match the actual module's export
export default contentService;