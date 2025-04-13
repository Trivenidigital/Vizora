import { vi } from 'vitest';

export type ContentType = 'image' | 'video' | 'webpage' | 'document' | 'app' | 'playlist' | 'stream';

export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  url: string;
  thumbnail?: string;
  description?: string;
  status: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  size?: number;
  duration?: number;
  tags?: string[];
  version?: number;
}

// Sample mock content
export const mockContent: ContentItem[] = [
  {
    id: '1',
    title: 'Test Image',
    type: 'image',
    url: 'https://example.com/image1.jpg',
    thumbnail: 'https://example.com/thumb.jpg',
    description: 'Test description',
    status: 'published',
    owner: 'user1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    size: 1024,
    tags: ['test', 'image'],
    version: 1
  },
  {
    id: '2',
    title: 'Test Video',
    type: 'video',
    url: 'https://example.com/video1.mp4',
    thumbnail: 'https://example.com/thumb-video.jpg',
    description: 'Test video description',
    status: 'draft',
    owner: 'user1',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    size: 2048,
    duration: 60,
    tags: ['test', 'video'],
    version: 1
  },
];

// Create a mock content service
export const contentServiceMock = {
  getContentList: vi.fn().mockResolvedValue({ data: mockContent }),
  getContentById: vi.fn().mockImplementation((id: string) => {
    const content = mockContent.find(item => item.id === id);
    if (content) {
      return Promise.resolve({ data: content });
    }
    return Promise.reject(new Error('Content not found'));
  }),
  createContent: vi.fn().mockImplementation((contentData: Partial<ContentItem>) => {
    const newContent = {
      ...contentData,
      id: String(mockContent.length + 1),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return Promise.resolve({ data: newContent });
  }),
  updateContent: vi.fn().mockImplementation((id: string, data: Partial<ContentItem>) => {
    const index = mockContent.findIndex(item => item.id === id);
    if (index !== -1) {
      const updatedContent = {
        ...mockContent[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return Promise.resolve({ data: updatedContent });
    }
    return Promise.reject(new Error('Content not found'));
  }),
  deleteContent: vi.fn().mockImplementation((id: string) => {
    const index = mockContent.findIndex(item => item.id === id);
    if (index !== -1) {
      return Promise.resolve({ success: true });
    }
    return Promise.reject(new Error('Content not found'));
  }),
  pushContentToDisplay: vi.fn().mockResolvedValue({ success: true, message: 'Content pushed successfully' }),
  pushContentToAllDisplays: vi.fn().mockResolvedValue({ success: true, message: 'Content pushed to all displays successfully' }),
  scheduleContent: vi.fn().mockResolvedValue({ success: true, message: 'Content scheduled successfully' }),
  searchContent: vi.fn().mockImplementation((query: string) => {
    const results = mockContent.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) || 
      item.description?.toLowerCase().includes(query.toLowerCase())
    );
    return Promise.resolve({ data: results });
  }),
  filterContentByType: vi.fn().mockImplementation((type: string) => {
    const results = mockContent.filter(item => item.type === type);
    return Promise.resolve({ data: results });
  }),
  getContentMetrics: vi.fn().mockResolvedValue({
    total: mockContent.length,
    byType: {
      image: mockContent.filter(item => item.type === 'image').length,
      video: mockContent.filter(item => item.type === 'video').length,
    },
    byStatus: {
      published: mockContent.filter(item => item.status === 'published').length,
      draft: mockContent.filter(item => item.status === 'draft').length,
    }
  }),
};

// Function to reset all mocks in the service
export function resetContentServiceMocks() {
  Object.values(contentServiceMock).forEach(mock => {
    if (typeof mock === 'function' && mock.mockReset) {
      mock.mockReset();
    }
  });
  
  // Reset default implementations
  contentServiceMock.getContentList.mockResolvedValue({ data: mockContent });
  contentServiceMock.getContentById.mockImplementation((id: string) => {
    const content = mockContent.find(item => item.id === id);
    if (content) {
      return Promise.resolve({ data: content });
    }
    return Promise.reject(new Error('Content not found'));
  });
  // Reset other implementations as needed
} 