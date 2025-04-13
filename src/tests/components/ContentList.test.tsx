import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ContentList from '../../components/ContentList';
import { organizationService } from '../../services/organizationService';

// Mock the organization service
vi.mock('../../services/organizationService');

describe.skip('ContentList Component', () => {
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
    (organizationService.deleteContent as jest.Mock).mockResolvedValue(undefined);
  });

  it('displays loading state initially and then content', async () => {
    render(<ContentList />);
    
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('content-item-1')).toBeInTheDocument();
    });
  });

  it('displays error state when query fails', async () => {
    (organizationService.getContentByOrganization as jest.Mock).mockRejectedValue(new Error('Failed to load content'));

    render(<ContentList />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    expect(screen.getByTestId('error-state')).toHaveTextContent('Failed to load content');
  });

  it('displays empty state when no contents are returned', async () => {
    (organizationService.getContentByOrganization as jest.Mock).mockResolvedValue([]);

    render(<ContentList />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No content found');
  });

  it('displays content items when data is returned', async () => {
    render(<ContentList />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    const contentItem = screen.getByTestId('content-item-1');
    expect(contentItem).toBeInTheDocument();
    expect(contentItem.querySelector('h3')).toHaveTextContent('Content 1');
  });

  it('displays content details correctly', async () => {
    render(<ContentList />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    const contentItem = screen.getByTestId('content-item-1');
    expect(contentItem).toBeInTheDocument();
    expect(contentItem.querySelector('h3')).toHaveTextContent('Content 1');
    expect(contentItem.querySelector('[data-testid="content-type-icon"]')).toHaveAttribute('data-type', 'image');
    expect(contentItem.querySelector('[data-testid="content-status"]')).toHaveTextContent('Ready');
  });

  it('handles content selection', async () => {
    render(<ContentList />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    const selectButton = screen.getByTestId('content-select-1');
    expect(selectButton).toBeInTheDocument();

    await act(async () => {
      await userEvent.click(selectButton);
    });

    expect(screen.getByText('1 items selected')).toBeInTheDocument();
    expect(screen.getByTestId('organize-selected-button')).toBeInTheDocument();
    expect(screen.getByTestId('clear-selection-button')).toBeInTheDocument();
  });

  it('handles content deletion', async () => {
    render(<ContentList />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    const deleteButton = screen.getByTestId('delete-button-1');
    expect(deleteButton).toBeInTheDocument();

    await act(async () => {
      await userEvent.click(deleteButton);
    });

    expect(organizationService.deleteContent).toHaveBeenCalledWith('1');
    expect(organizationService.getContentByOrganization).toHaveBeenCalledTimes(2);
  });

  it('handles filter changes', async () => {
    render(<ContentList />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    const filtersButton = screen.getByTestId('filters-button');
    expect(filtersButton).toBeInTheDocument();

    await act(async () => {
      await userEvent.click(filtersButton);
    });

    const folderSelect = screen.getByTestId('folder-select');
    expect(folderSelect).toBeInTheDocument();

    await act(async () => {
      await userEvent.selectOptions(folderSelect, mockFolders[0].id);
    });

    expect(organizationService.getContentByOrganization).toHaveBeenCalledWith({
      folderId: 'folder1',
      tagIds: undefined,
      includeSubfolders: undefined
    });
  });

  it('handles search functionality', async () => {
    render(<ContentList />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('search-input');
    expect(searchInput).toBeInTheDocument();

    await act(async () => {
      await userEvent.type(searchInput, 'test');
    });

    expect(organizationService.getContentByOrganization).toHaveBeenCalledWith({
      search: 'test'
    });
  });
}); 