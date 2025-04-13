import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as contentService from '../../src/services/contentService';

const mockContent = [
  {
    id: 'content-001',
    title: 'Test Image',
    type: 'image',
    url: 'https://example.com/image.jpg',
    thumbnail: 'https://example.com/thumb.jpg',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user1',
  },
  {
    id: 'content-002',
    title: 'Test Video',
    type: 'video',
    url: 'https://example.com/video.mp4',
    thumbnail: 'https://example.com/thumb-video.jpg',
    status: 'published',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    userId: 'user1',
  },
];

describe('Content Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets content list', async () => {
    const content = await contentService.getContentList();
    expect(content).toEqual(mockContent);
  });

  it('gets content by ID', async () => {
    const content = await contentService.getContentById('content-001');
    expect(content).toEqual(mockContent[0]);
  });

  it('handles content not found', async () => {
    await expect(contentService.getContentById('non-existent')).rejects.toThrow('Content not found');
  });

  it('handles content caching', async () => {
    const content = mockContent[0];
    await contentService.cacheContent(content);
    
    const cachedContent = await contentService.getCachedContent(content.id);
    expect(cachedContent).toEqual(content);
  });

  it('handles content cache invalidation', async () => {
    const content = mockContent[0];
    await contentService.cacheContent(content);
    
    await contentService.invalidateContentCache(content.id);
    await expect(contentService.getCachedContent(content.id)).rejects.toThrow('Content not found in cache');
  });

  it('handles content type validation', async () => {
    const validContent = {
      ...mockContent[0],
      type: 'image',
    };
    expect(await contentService.validateContentType(validContent)).toBe(true);

    const invalidContent = {
      ...mockContent[0],
      type: 'invalid-type',
    };
    await expect(contentService.validateContentType(invalidContent)).rejects.toThrow('Invalid content type');
  });

  it('handles content URL validation', async () => {
    const validContent = {
      ...mockContent[0],
      url: 'https://example.com/image.jpg',
    };
    expect(await contentService.validateContentUrl(validContent)).toBe(true);

    const invalidContent = {
      ...mockContent[0],
      url: 'invalid-url',
    };
    await expect(contentService.validateContentUrl(invalidContent)).rejects.toThrow('Invalid content URL');
  });

  it('handles content download', async () => {
    const content = mockContent[0];
    const downloadedContent = await contentService.downloadContent(content);
    expect(downloadedContent).toBeDefined();
    expect(downloadedContent.url).toBe(content.url);
  });

  it('handles download errors', async () => {
    const content = {
      ...mockContent[0],
      url: 'https://example.com/non-existent.jpg',
    };
    await expect(contentService.downloadContent(content)).rejects.toThrow('Failed to download content');
  });

  it('handles content format conversion', async () => {
    const content = mockContent[1]; // Video content
    const convertedContent = await contentService.convertContentFormat(content, 'mp4');
    expect(convertedContent.format).toBe('mp4');
    expect(convertedContent.url).toBeDefined();
  });

  it('handles conversion errors', async () => {
    const content = mockContent[1];
    await expect(contentService.convertContentFormat(content, 'invalid-format')).rejects.toThrow('Unsupported format');
  });

  it('handles content metadata extraction', async () => {
    const content = mockContent[0];
    const metadata = await contentService.extractContentMetadata(content);
    expect(metadata).toBeDefined();
    expect(metadata.type).toBe(content.type);
    expect(metadata.size).toBeDefined();
    expect(metadata.dimensions).toBeDefined();
  });

  it('handles metadata extraction errors', async () => {
    const invalidContent = {
      ...mockContent[0],
      url: 'https://example.com/corrupted.jpg',
    };
    await expect(contentService.extractContentMetadata(invalidContent)).rejects.toThrow('Failed to extract metadata');
  });
}); 