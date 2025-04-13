import { vi } from 'vitest';
import type { Content, ContentFilters, ContentStats, NewContent } from '../../types/content';

const mockContent = {
  id: '1',
  name: 'Test Content',
  type: 'image',
  status: 'active',
  duration: 10,
  createdAt: new Date().toISOString(),
};

const getContentList = vi.fn().mockResolvedValue([mockContent]);
const getContent = vi.fn().mockResolvedValue(mockContent);
const createContent = vi.fn().mockResolvedValue(mockContent);
const updateContent = vi.fn().mockResolvedValue(mockContent);
const deleteContent = vi.fn().mockResolvedValue(undefined);
const getContentStats = vi.fn().mockResolvedValue({ total: 1, active: 1 });
const uploadContent = vi.fn().mockResolvedValue({ url: 'test-url' });
const publishContent = vi.fn().mockResolvedValue(undefined);
const archiveContent = vi.fn().mockResolvedValue(undefined);
const duplicateContent = vi.fn().mockResolvedValue(mockContent);
const getContentVersions = vi.fn().mockResolvedValue([mockContent]);
const restoreContentVersion = vi.fn().mockResolvedValue(mockContent);
const pushContentToDisplay = vi.fn().mockResolvedValue(undefined);

// Reset all mocks
export const resetContentServiceMocks = () => {
  getContentList.mockClear();
  getContent.mockClear();
  createContent.mockClear();
  updateContent.mockClear();
  deleteContent.mockClear();
  getContentStats.mockClear();
  uploadContent.mockClear();
  publishContent.mockClear();
  archiveContent.mockClear();
  duplicateContent.mockClear();
  getContentVersions.mockClear();
  restoreContentVersion.mockClear();
  pushContentToDisplay.mockClear();
};

// Default export
const contentService = {
  getContentList,
  getContent,
  createContent,
  updateContent,
  deleteContent,
  getContentStats,
  uploadContent,
  publishContent,
  archiveContent,
  duplicateContent,
  getContentVersions,
  restoreContentVersion,
  pushContentToDisplay,
};

export default contentService; 