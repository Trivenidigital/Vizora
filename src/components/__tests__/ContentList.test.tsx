import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ContentList from '../ContentList';
import organizationService from '../../services/organizationService';

// Mock the organization service
vi.mock('../../services/organizationService', () => ({
  default: {
    getContentByOrganization: vi.fn(),
    getFolders: vi.fn(),
    getTags: vi.fn(),
    getOrganizations: vi.fn()
  }
}));

describe('ContentList', () => {
  const mockContent = [
    {
      id: '1',
      name: 'Content 1',
      type: 'image',
      url: 'https://example.com/content1.jpg',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      size: 1024,
      status: 'ready',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1',
      folder: {
        id: 'folder1',
        name: 'Folder 1',
        parentId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        owner: 'user1'
      },
      tags: [
        {
          id: 'tag1',
          name: 'Tag 1',
          color: '#FF0000',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          owner: 'user1'
        }
      ]
    }
  ];

  const mockFolders = [
    {
      id: 'folder1',
      name: 'Folder 1',
      parentId: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1'
    }
  ];

  const mockTags = [
    {
      id: 'tag1',
      name: 'Tag 1',
      color: '#FF0000',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (organizationService.getContentByOrganization as jest.Mock).mockResolvedValue(mockContent);
    (organizationService.getFolders as jest.Mock).mockResolvedValue(mockFolders);
    (organizationService.getTags as jest.Mock).mockResolvedValue(mockTags);
    (organizationService.getOrganizations as jest.Mock).mockResolvedValue([]);
  });

  it('renders content list with items', async () => {
    await act(async () => {
      render(<ContentList />);
    });

    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.getByTestId('folder-badge-folder1')).toBeInTheDocument();
      expect(screen.getByTestId('tag-badge-tag1')).toBeInTheDocument();
    });
  });

  it('handles content selection', async () => {
    await act(async () => {
      render(<ContentList />);
    });

    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });

    await act(async () => {
      const selectButton = screen.getByTestId('content-select-1');
      await userEvent.click(selectButton);
    });

    await waitFor(() => {
      expect(screen.getByText('1 items selected')).toBeInTheDocument();
    });
  });

  it('handles bulk actions', async () => {
    await act(async () => {
      render(<ContentList />);
    });

    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });

    await act(async () => {
      const selectButton = screen.getByTestId('content-select-1');
      await userEvent.click(selectButton);
    });

    await waitFor(() => {
      expect(screen.getByText('1 items selected')).toBeInTheDocument();
    });

    await act(async () => {
      const organizeButton = screen.getByRole('button', { name: /organize selected/i });
      await userEvent.click(organizeButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('bulk-actions-modal')).toBeInTheDocument();
    });
  });

  it('handles content display actions', async () => {
    await act(async () => {
      render(<ContentList />);
    });

    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });

    await act(async () => {
      const contentCard = screen.getByTestId('content-card-1');
      await userEvent.click(contentCard);
    });

    await waitFor(() => {
      expect(screen.getByText('Push or Schedule Content')).toBeInTheDocument();
    });
  });

  it('handles filter changes', async () => {
    await act(async () => {
      render(<ContentList />);
    });

    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });

    await act(async () => {
      const folderBadge = screen.getByTestId('folder-badge-folder1');
      await userEvent.click(folderBadge);
    });

    await waitFor(() => {
      expect(organizationService.getContentByOrganization).toHaveBeenCalledWith({
        folderId: 'folder1'
      });
    });
  });

  it('handles tag filtering', async () => {
    await act(async () => {
      render(<ContentList />);
    });

    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });

    await act(async () => {
      const tagBadge = screen.getByTestId('tag-badge-tag1');
      await userEvent.click(tagBadge);
    });

    await waitFor(() => {
      expect(organizationService.getContentByOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          tagIds: ['tag1']
        })
      );
    });
  });

  it('handles search', async () => {
    await act(async () => {
      render(<ContentList />);
    });

    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });

    await act(async () => {
      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, 'test');
    });

    await waitFor(() => {
      expect(organizationService.getContentByOrganization).toHaveBeenCalledWith({
        search: 'test'
      });
    });
  });

  it('handles loading state', async () => {
    await act(async () => {
      render(<ContentList />);
    });

    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    (organizationService.getContentByOrganization as jest.Mock).mockRejectedValue(new Error('Failed to load content'));

    await act(async () => {
      render(<ContentList />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
  });

  it('handles organization loading errors', async () => {
    // Mock organization service to reject
    (organizationService.getOrganizations as jest.Mock).mockRejectedValue(new Error('Failed to load organizations'));
    (organizationService.getContentByOrganization as jest.Mock).mockRejectedValue(new Error('Failed to load content'));

    await act(async () => {
      render(<ContentList />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
  });
}); 