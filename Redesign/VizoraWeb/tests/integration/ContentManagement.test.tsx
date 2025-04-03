import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import ContentPage from '../../src/pages/content/ContentPage';
import * as contentService from '../../src/services/contentService';
import toast from 'react-hot-toast';

// Mock services
vi.mock('../../src/services/contentService');
vi.mock('react-hot-toast');

const mockContent = [
  {
    id: '1',
    title: 'Test Image',
    type: 'image',
    url: 'https://example.com/image.jpg',
    thumbnail: 'https://example.com/thumb.jpg',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user1',
    description: 'Test description',
    tags: ['test'],
    fileSize: 1024,
    dimensions: '1920x1080',
  },
  {
    id: '2',
    title: 'Test Video',
    type: 'video',
    url: 'https://example.com/video.mp4',
    thumbnail: 'https://example.com/thumb-video.jpg',
    status: 'draft',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    userId: 'user1',
    description: 'Test video description',
    tags: ['video', 'test'],
    fileSize: 2048,
    dimensions: '1280x720',
    duration: 60,
  },
];

describe('Content Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (contentService.getContentList as any).mockResolvedValue(mockContent);
  });

  it('loads and displays content list', async () => {
    render(<ContentPage />);

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument();
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });

    // Verify content details are displayed
    expect(screen.getByText('published')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
  });

  it('allows filtering content by type', async () => {
    render(<ContentPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument();
    });

    // Click image filter
    fireEvent.click(screen.getByText('Images'));
    
    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument();
      expect(screen.queryByText('Test Video')).not.toBeInTheDocument();
    });
  });

  it('allows searching content', async () => {
    render(<ContentPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument();
    });

    // Enter search term
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Video' } });

    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument();
      expect(screen.queryByText('Test Image')).not.toBeInTheDocument();
    });
  });

  it('handles content deletion', async () => {
    (contentService.deleteContent as any).mockResolvedValue(undefined);
    
    render(<ContentPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument();
    });

    // Click delete button for first content
    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(contentService.deleteContent).toHaveBeenCalledWith('1');
      expect(toast.success).toHaveBeenCalledWith('Content deleted successfully');
    });
  });

  it('handles content push to display', async () => {
    (contentService.pushContentToDisplay as any).mockResolvedValue({ success: true });
    
    render(<ContentPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument();
    });

    // Click push button for first content
    const pushButton = screen.getAllByRole('button', { name: /push/i })[0];
    fireEvent.click(pushButton);

    // Select display and confirm
    const displaySelect = screen.getByRole('combobox');
    fireEvent.change(displaySelect, { target: { value: 'display1' } });
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(contentService.pushContentToDisplay).toHaveBeenCalledWith('1', 'display1');
      expect(toast.success).toHaveBeenCalledWith('Content pushed successfully');
    });
  });

  it('handles errors gracefully', async () => {
    const error = new Error('API Error');
    (contentService.getContentList as any).mockRejectedValue(error);
    
    render(<ContentPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load content');
    });
  });
}); 