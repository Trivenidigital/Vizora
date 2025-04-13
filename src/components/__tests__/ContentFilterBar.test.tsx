import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ContentFilterBar from '../ContentFilterBar';
import { Folder, Tag } from '../../types/organization';

describe('ContentFilterBar', () => {
  const mockFolders: Folder[] = [
    {
      id: 'folder1',
      name: 'Folder 1',
      parentId: undefined,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1',
      contentCount: 5
    },
    {
      id: 'folder2',
      name: 'Folder 2',
      parentId: 'folder1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1',
      contentCount: 3
    }
  ];

  const mockTags: Tag[] = [
    {
      id: 'tag1',
      name: 'Tag 1',
      color: '#FF0000',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1',
      contentCount: 4
    },
    {
      id: 'tag2',
      name: 'Tag 2',
      color: '#00FF00',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1',
      contentCount: 2
    }
  ];

  const mockOnFilterChange = vi.fn();
  const mockOnSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the filter bar with search input', () => {
    render(
      <ContentFilterBar
        folders={mockFolders}
        tags={mockTags}
        onFilterChange={mockOnFilterChange}
        onSearch={mockOnSearch}
      />
    );

    expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('shows filter panel when filters button is clicked', async () => {
    render(
      <ContentFilterBar
        folders={mockFolders}
        tags={mockTags}
        onFilterChange={mockOnFilterChange}
        onSearch={mockOnSearch}
      />
    );

    const filtersButton = screen.getByText('Filters');
    await userEvent.click(filtersButton);

    expect(screen.getByLabelText('Folder')).toBeInTheDocument();
    expect(screen.getByLabelText('Content Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByTestId('tag-tag1')).toBeInTheDocument();
    expect(screen.getByTestId('tag-tag2')).toBeInTheDocument();
  });

  it('handles tag selection and deselection', async () => {
    render(
      <ContentFilterBar
        folders={mockFolders}
        tags={mockTags}
        onFilterChange={mockOnFilterChange}
        onSearch={mockOnSearch}
      />
    );

    // Open filter panel
    const filtersButton = screen.getByText('Filters');
    await userEvent.click(filtersButton);

    // Select and deselect a tag
    const tag1Button = screen.getByTestId('tag-tag1');
    await userEvent.click(tag1Button);
    expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      tags: ['tag1']
    }));

    await userEvent.click(tag1Button);
    expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      tags: []
    }));
  });

  it('handles folder selection and subfolder toggle', async () => {
    render(
      <ContentFilterBar
        folders={mockFolders}
        tags={mockTags}
        onFilterChange={mockOnFilterChange}
        onSearch={mockOnSearch}
      />
    );

    // Open filter panel
    const filtersButton = screen.getByText('Filters');
    await userEvent.click(filtersButton);

    // Select a folder
    const folderSelect = screen.getByLabelText('Folder');
    await userEvent.selectOptions(folderSelect, 'folder1');
    expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      folder: 'folder1'
    }));

    // Toggle include subfolders
    const includeSubfoldersCheckbox = screen.getByTestId('include-subfolders');
    await userEvent.click(includeSubfoldersCheckbox);
    expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      includeSubfolders: true
    }));
  });

  it('disables include subfolders when no folder is selected', async () => {
    render(
      <ContentFilterBar
        folders={mockFolders}
        tags={mockTags}
        onFilterChange={mockOnFilterChange}
        onSearch={mockOnSearch}
      />
    );

    // Open filter panel
    const filtersButton = screen.getByText('Filters');
    await userEvent.click(filtersButton);

    const includeSubfoldersCheckbox = screen.getByTestId('include-subfolders');
    expect(includeSubfoldersCheckbox).toBeDisabled();
  });

  it('shows active filters', async () => {
    render(
      <ContentFilterBar
        folders={mockFolders}
        tags={mockTags}
        onFilterChange={mockOnFilterChange}
        onSearch={mockOnSearch}
      />
    );

    // Open filter panel
    const filtersButton = screen.getByText('Filters');
    await userEvent.click(filtersButton);

    // Select filters
    const folderSelect = screen.getByLabelText('Folder');
    await userEvent.selectOptions(folderSelect, 'folder1');
    const tag1Button = screen.getByTestId('tag-tag1');
    await userEvent.click(tag1Button);

    // Check if active filters are shown
    expect(screen.getByTestId('active-folder')).toHaveTextContent('Folder: Folder 1');
    expect(screen.getByTestId('active-tag-tag1')).toHaveTextContent('Tag 1');
  });
}); 