import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../src/test/test-utils';
import ContentPage from '../../src/pages/content/ContentPage';
import { contentService } from '../../src/services/contentService';
import { toast } from 'react-hot-toast';

// Mock the content service
vi.mock('../../src/services/contentService', () => ({
  contentService: {
    getContentList: vi.fn().mockResolvedValue([]),
    getContentById: vi.fn().mockResolvedValue(null),
    createContent: vi.fn().mockResolvedValue(null),
    updateContent: vi.fn().mockResolvedValue(null),
    deleteContent: vi.fn().mockResolvedValue(undefined),
    scheduleContent: vi.fn().mockResolvedValue(undefined),
    getContentAnalytics: vi.fn().mockResolvedValue(null),
    uploadContent: vi.fn().mockResolvedValue(null),
    pushContentToDisplay: vi.fn().mockResolvedValue(undefined),
    validateContent: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
  },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ContentPage Component', () => {
  const mockContent = [
    {
      id: '1',
      title: 'Test Video',
      description: 'Test video content',
      type: 'video' as const,
      url: 'https://example.com/video.mp4',
      duration: 60,
      displayIds: ['display-1'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      status: 'published' as const,
      category: 'test',
      tags: ['test', 'video'],
      metadata: { resolution: '1920x1080' }
    },
    {
      id: '2',
      title: 'Test Image',
      description: 'Test image content',
      type: 'image' as const,
      url: 'https://example.com/image.jpg',
      displayIds: ['display-2'],
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      status: 'published' as const,
      category: 'test',
      tags: ['test', 'image'],
      metadata: { resolution: '1920x1080' }
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (contentService.getContentList as jest.Mock).mockResolvedValue(mockContent);
  });

  it('renders content list', async () => {
    render(<ContentPage />);

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument();
      expect(screen.getByText('Test Image')).toBeInTheDocument();
    });
  });

  it('filters content by type', async () => {
    const user = userEvent.setup();
    render(<ContentPage />);

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });

    // Filter by image type
    const filterSelect = screen.getByLabelText('Filter content by type');
    await user.selectOptions(filterSelect, 'image');

    // Check that only image content is shown
    expect(screen.queryByText('Test Video')).not.toBeInTheDocument();
    expect(screen.getByText('Test Image')).toBeInTheDocument();
  });

  it('sorts content by different criteria', async () => {
    const user = userEvent.setup();
    render(<ContentPage />);

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });

    // Sort by name
    const sortSelect = screen.getByLabelText('Sort content by');
    await user.selectOptions(sortSelect, 'name-asc');

    // Check that content is sorted by name
    const contentItems = screen.getAllByRole('heading', { level: 3 });
    expect(contentItems[0]).toHaveTextContent('Test Image');
    expect(contentItems[1]).toHaveTextContent('Test Video');
  });

  it('handles content deletion', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (contentService.deleteContent as jest.Mock).mockResolvedValue(undefined);

    render(<ContentPage />);

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[0]);

    // Check if delete was called
    await waitFor(() => {
      expect(contentService.deleteContent).toHaveBeenCalledWith('1');
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('handles search input', async () => {
    const user = userEvent.setup();
    render(<ContentPage />);

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });

    // Type in search input
    const searchInput = screen.getByPlaceholderText('Search content...');
    await user.type(searchInput, 'Image');

    // Check that only matching content is shown
    expect(screen.queryByText('Test Video')).not.toBeInTheDocument();
    expect(screen.getByText('Test Image')).toBeInTheDocument();
  });
}); 