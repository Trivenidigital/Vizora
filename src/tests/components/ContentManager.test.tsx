import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { contentService, Content } from '../../services/contentService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import reactQueryMock from '../../mocks/reactQuery';
import ContentManager from '../../components/ContentManager';
import { userEvent } from '@testing-library/user-event';

// Mock contentService
vi.mock('../../services/contentService', () => ({
  contentService: {
    getContentList: vi.fn(),
    getContentById: vi.fn(),
    createContent: vi.fn(),
    deleteContent: vi.fn()
  },
  Content: undefined
}));

describe('ContentManager Component', () => {
  // Mock query client responses
  const mockQueryClient = {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn()
  };

  // Sample content data
  const mockContentList = [
    {
      id: '1',
      title: 'Test Content 1',
      type: 'image',
      url: 'http://example.com/1',
      status: 'active'
    },
    {
      id: '2',
      title: 'Test Content 2',
      type: 'video',
      url: 'http://example.com/2',
      status: 'inactive'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    contentService.getContentList.mockResolvedValue(mockContentList);
  });

  it('displays loading state initially', () => {
    render(<ContentManager />);
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('displays content list when data is loaded successfully', async () => {
    render(<ContentManager />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('content-list')).toBeInTheDocument();
    expect(screen.getByTestId('content-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('content-item-2')).toBeInTheDocument();
  });

  it('displays error state when content list query fails', async () => {
    contentService.getContentList.mockRejectedValue(new Error('Failed to load content'));
    render(<ContentManager />);
    
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
  });

  it('allows deleting content', async () => {
    const mockContent = {
      id: '1',
      title: 'Test Content',
      type: 'image',
      url: 'http://example.com/image.jpg',
      status: 'active'
    };

    vi.spyOn(contentService, 'getContentList').mockResolvedValue([mockContent]);
    vi.spyOn(contentService, 'deleteContent').mockResolvedValue(undefined);

    render(<ContentManager />);

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByTestId('content-item-1')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByTestId('delete-button-1');
    await userEvent.click(deleteButton);

    // Verify delete function was called
    expect(contentService.deleteContent).toHaveBeenCalledWith('1');
  });
}); 