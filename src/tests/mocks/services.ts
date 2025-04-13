import { vi } from 'vitest';

// Content Service Mock
export const contentService = {
  getContentList: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getContentById: vi.fn().mockResolvedValue({
    id: '1',
    title: 'Test',
    type: 'image',
    url: 'http://example.com/test.jpg',
    status: 'published',
    owner: 'user',
    tags: [],
    createdAt: '2025-04-02T14:47:29.387Z',
    updatedAt: '2025-04-02T14:47:29.387Z'
  }),
  createContent: vi.fn().mockResolvedValue({
    id: '1',
    title: 'Test',
    type: 'image',
    url: 'http://example.com/test.jpg',
    status: 'published',
    owner: 'user',
    tags: [],
    createdAt: '2025-04-02T14:47:29.387Z',
    updatedAt: '2025-04-02T14:47:29.387Z'
  }),
  updateContent: vi.fn().mockResolvedValue({
    id: '1',
    title: 'Updated Title',
    type: 'image',
    url: 'http://example.com/test.jpg',
    status: 'published',
    owner: 'user',
    tags: [],
    createdAt: '2025-04-02T14:47:29.392Z',
    updatedAt: '2025-04-02T14:47:29.392Z'
  }),
  deleteContent: vi.fn().mockResolvedValue({}),
  pushContentToDisplay: vi.fn().mockResolvedValue({}),
  uploadContent: vi.fn().mockImplementation(async (file: File, metadata: any) => {
    if (file.size > 100 * 1024 * 1024) {
      throw new Error('File size exceeds 100MB limit');
    }
    if (!['image/jpeg', 'image/png', 'video/mp4'].includes(file.type)) {
      throw new Error('Unsupported file type');
    }
    return {
      id: '1',
      title: metadata.title,
      type: file.type.split('/')[0],
      url: 'http://example.com/test.jpg',
      status: 'published',
      owner: 'user',
      tags: [],
      createdAt: '2025-04-02T14:47:29.387Z',
      updatedAt: '2025-04-02T14:47:29.387Z'
    };
  })
};

// Display Service Mock
export const displayService = {
  getDisplays: vi.fn().mockResolvedValue([
    {
      id: 'display-1',
      name: 'Main Lobby Display',
      status: 'online',
      lastSeen: '2025-04-02T14:47:29.387Z',
      currentContent: null
    }
  ]),
  getDisplayById: vi.fn().mockResolvedValue({
    id: 'display-1',
    name: 'Main Lobby Display',
    status: 'online',
    lastSeen: '2025-04-02T14:47:29.387Z',
    currentContent: null
  }),
  createDisplay: vi.fn().mockResolvedValue({
    id: 'display-1',
    name: 'New Display',
    status: 'offline',
    lastSeen: null,
    currentContent: null
  }),
  updateDisplay: vi.fn().mockResolvedValue({
    id: 'display-1',
    name: 'Updated Display',
    status: 'online',
    lastSeen: '2025-04-02T14:47:29.387Z',
    currentContent: null
  }),
  deleteDisplay: vi.fn().mockResolvedValue({}),
  unpairDisplay: vi.fn().mockResolvedValue({})
};

// Auth Service Mock
export const authService = {
  login: vi.fn().mockResolvedValue({ token: 'mock-token' }),
  logout: vi.fn().mockResolvedValue({}),
  register: vi.fn().mockResolvedValue({ token: 'mock-token' }),
  getCurrentUser: vi.fn().mockResolvedValue({
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User'
  })
};

export default {
  contentService,
  displayService,
  authService,
};

module.exports = exports; 