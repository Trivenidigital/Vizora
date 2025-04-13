import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { VizoraDisplay } from '../DisplayApp';
import { contentService } from '../services/contentService';
import { socketClient } from '../services/socketClient';

vi.mock('../services/contentService', () => ({
  contentService: {
    getContent: vi.fn(),
    isOffline: vi.fn(),
    handleError: vi.fn(),
  },
}));

vi.mock('../services/socketClient', () => ({
  socketClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
}));

describe('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles socket connection errors', async () => {
    const error = new Error('Connection failed');
    vi.mocked(socketClient.connect).mockRejectedValue(error);
    
    render(<VizoraDisplay />);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Socket connection error:', error);
    });
  });

  it('handles content fetch errors', async () => {
    const error = new Error('Failed to fetch content');
    vi.mocked(contentService.getContent).mockRejectedValue(error);
    
    render(<VizoraDisplay />);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Error fetching content:', error);
    });
  });

  it('handles schedule conflict errors', async () => {
    const error = new Error('Schedule conflict');
    vi.mocked(socketClient.on).mockImplementation((event, callback) => {
      if (event === 'schedule:conflict') {
        callback(error);
      }
    });
    
    render(<VizoraDisplay />);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Schedule conflict error:', error);
    });
  });

  it('handles offline mode recovery', async () => {
    vi.mocked(contentService.isOffline).mockReturnValue(true);
    
    render(<VizoraDisplay />);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Offline mode activated');
    });
  });

  it('handles invalid content data', async () => {
    const invalidContent = null;
    vi.mocked(contentService.getContent).mockResolvedValue(invalidContent);
    
    render(<VizoraDisplay />);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Error parsing content data');
    });
  });
}); 