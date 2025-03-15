import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ContentDisplay } from '../ContentDisplay';
import { contentService } from '../../services/contentService';

// Mock the content service
vi.mock('../../services/contentService', () => ({
  contentService: {
    getCurrentContent: vi.fn(),
    getCachedElement: vi.fn(),
  },
}));

describe('ContentDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows waiting message when no content is available', () => {
    vi.mocked(contentService.getCurrentContent).mockReturnValue(null);
    render(<ContentDisplay />);
    expect(screen.getByText('Waiting for content...')).toBeInTheDocument();
  });

  it('displays image content correctly', () => {
    const mockContent = {
      id: '1',
      type: 'image',
      content: {
        url: 'https://example.com/image.jpg',
        alt: 'Test Image',
      },
    };
    vi.mocked(contentService.getCurrentContent).mockReturnValue(mockContent);
    render(<ContentDisplay />);
    
    const img = screen.getByAltText('Test Image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('displays video content correctly', () => {
    const mockContent = {
      id: '2',
      type: 'video',
      content: {
        url: 'https://example.com/video.mp4',
      },
    };
    vi.mocked(contentService.getCurrentContent).mockReturnValue(mockContent);
    render(<ContentDisplay />);
    
    const video = screen.getByRole('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'https://example.com/video.mp4');
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('loop');
    expect(video).toHaveAttribute('muted');
  });

  it('displays text content correctly', () => {
    const mockContent = {
      id: '3',
      type: 'text',
      content: {
        title: 'Test Title',
        body: 'Test Body Text',
      },
    };
    vi.mocked(contentService.getCurrentContent).mockReturnValue(mockContent);
    render(<ContentDisplay />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Body Text')).toBeInTheDocument();
  });

  it('shows error message when content fails to load', async () => {
    const mockContent = {
      id: '4',
      type: 'image',
      content: {
        url: 'https://example.com/invalid.jpg',
      },
    };
    vi.mocked(contentService.getCurrentContent).mockReturnValue(mockContent);
    render(<ContentDisplay />);
    
    // Simulate image load error
    const img = screen.getByRole('img');
    img.dispatchEvent(new Event('error'));
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load content. Retrying...')).toBeInTheDocument();
    });
  });
}); 