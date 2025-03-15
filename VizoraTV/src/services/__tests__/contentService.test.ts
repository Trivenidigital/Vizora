import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contentService } from '../contentService';
import { websocketService } from '../websocketService';

// Mock the websocket service
vi.mock('../websocketService', () => ({
  websocketService: {
    onContentUpdate: vi.fn(),
  },
}));

describe('ContentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentService.clearQueue();
  });

  it('initializes with empty queue and no current content', () => {
    expect(contentService.getCurrentContent()).toBeNull();
    expect(contentService.getContentQueue()).toHaveLength(0);
  });

  it('adds content to queue when received from websocket', () => {
    const mockContent = {
      id: '1',
      type: 'image',
      content: {
        url: 'https://example.com/image.jpg',
      },
    };

    // Simulate websocket content update
    const contentUpdateCallback = vi.mocked(websocketService.onContentUpdate).mock.calls[0][0];
    contentUpdateCallback(mockContent);

    expect(contentService.getContentQueue()).toHaveLength(1);
    expect(contentService.getContentQueue()[0]).toEqual(mockContent);
  });

  it('plays next content from queue', async () => {
    const mockContent = {
      id: '1',
      type: 'image',
      content: {
        url: 'https://example.com/image.jpg',
      },
      duration: 5,
    };

    // Add content to queue
    const contentUpdateCallback = vi.mocked(websocketService.onContentUpdate).mock.calls[0][0];
    contentUpdateCallback(mockContent);

    // Start playing
    await contentService.playNextContent();

    expect(contentService.getCurrentContent()).toEqual(mockContent);
    expect(contentService.getContentQueue()).toHaveLength(0);
  });

  it('clears queue and current content', () => {
    const mockContent = {
      id: '1',
      type: 'image',
      content: {
        url: 'https://example.com/image.jpg',
      },
    };

    // Add content to queue
    const contentUpdateCallback = vi.mocked(websocketService.onContentUpdate).mock.calls[0][0];
    contentUpdateCallback(mockContent);

    contentService.clearQueue();

    expect(contentService.getCurrentContent()).toBeNull();
    expect(contentService.getContentQueue()).toHaveLength(0);
  });

  it('pauses and resumes content playback', () => {
    const mockContent = {
      id: '1',
      type: 'image',
      content: {
        url: 'https://example.com/image.jpg',
      },
      duration: 5,
    };

    // Add content to queue
    const contentUpdateCallback = vi.mocked(websocketService.onContentUpdate).mock.calls[0][0];
    contentUpdateCallback(mockContent);

    // Start playing
    contentService.playNextContent();

    // Pause
    contentService.pause();
    expect(contentService.getCurrentContent()).toEqual(mockContent);

    // Resume
    contentService.resume();
    expect(contentService.getCurrentContent()).toEqual(mockContent);
  });
}); 