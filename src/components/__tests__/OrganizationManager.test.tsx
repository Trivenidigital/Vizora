import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import OrganizationManager from '../OrganizationManager';
import organizationService from '../../services/organizationService';

// Mock the organization service
vi.mock('../../services/organizationService');

describe('OrganizationManager', () => {
  const mockFolders = [
    { id: '1', name: 'Folder 1', owner: 'user1', contentCount: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: '2', name: 'Folder 2', owner: 'user1', contentCount: 0, createdAt: '2024-01-02', updatedAt: '2024-01-02' }
  ];

  const mockTags = [
    { id: '1', name: 'Tag 1', owner: 'user1', contentCount: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: '2', name: 'Tag 2', owner: 'user1', contentCount: 0, createdAt: '2024-01-02', updatedAt: '2024-01-02' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (organizationService.getFolders as jest.Mock).mockResolvedValue(mockFolders);
    (organizationService.getTags as jest.Mock).mockResolvedValue(mockTags);
  });

  it('renders folders and tags sections', async () => {
    render(<OrganizationManager />);

    await waitFor(() => {
      expect(screen.getByText('Folders')).toBeInTheDocument();
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });

    expect(screen.getByText('Folder 1')).toBeInTheDocument();
    expect(screen.getByText('Folder 2')).toBeInTheDocument();
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 2')).toBeInTheDocument();
  });

  it('creates a new folder', async () => {
    const newFolder = {
      id: '3',
      name: 'New Folder',
      owner: 'user1',
      contentCount: 0,
      createdAt: '2024-01-03',
      updatedAt: '2024-01-03'
    };

    (organizationService.createFolder as jest.Mock).mockResolvedValue(newFolder);

    render(<OrganizationManager />);

    // Click "New Folder" button
    fireEvent.click(screen.getByText('New Folder'));

    // Enter folder name
    const input = screen.getByPlaceholderText('Folder name');
    await userEvent.type(input, 'New Folder');

    // Click Create button
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(organizationService.createFolder).toHaveBeenCalledWith({
        name: 'New Folder',
        owner: 'current-user'
      });
      expect(screen.getByText('New Folder')).toBeInTheDocument();
    });
  });

  it('creates a new tag', async () => {
    const newTag = {
      id: '3',
      name: 'New Tag',
      owner: 'user1',
      contentCount: 0,
      createdAt: '2024-01-03',
      updatedAt: '2024-01-03'
    };

    (organizationService.createTag as jest.Mock).mockResolvedValue(newTag);

    render(<OrganizationManager />);

    // Click "New Tag" button
    fireEvent.click(screen.getByText('New Tag'));

    // Enter tag name
    const input = screen.getByPlaceholderText('Tag name');
    await userEvent.type(input, 'New Tag');

    // Click Create button
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(organizationService.createTag).toHaveBeenCalledWith({
        name: 'New Tag',
        owner: 'current-user'
      });
      expect(screen.getByText('New Tag')).toBeInTheDocument();
    });
  });

  it('deletes a folder', async () => {
    (organizationService.deleteFolder as jest.Mock).mockResolvedValue(undefined);

    render(<OrganizationManager />);

    await waitFor(() => {
      expect(screen.getByText('Folder 1')).toBeInTheDocument();
    });

    // Click delete button for Folder 1
    const deleteButton = screen.getByTestId('delete-folder-1');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(organizationService.deleteFolder).toHaveBeenCalledWith('1');
      expect(screen.queryByText('Folder 1')).not.toBeInTheDocument();
    });
  });

  it('deletes a tag', async () => {
    (organizationService.deleteTag as jest.Mock).mockResolvedValue(undefined);

    render(<OrganizationManager />);

    await waitFor(() => {
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
    });

    // Click delete button for Tag 1
    const deleteButton = screen.getByTestId('delete-tag-1');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(organizationService.deleteTag).toHaveBeenCalledWith('1');
      expect(screen.queryByText('Tag 1')).not.toBeInTheDocument();
    });
  });

  it('selects a folder and calls onFolderSelect', async () => {
    const onFolderSelect = vi.fn();
    render(<OrganizationManager onFolderSelect={onFolderSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Folder 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Folder 1'));

    expect(onFolderSelect).toHaveBeenCalledWith('1');
  });

  it('selects tags and calls onTagSelect', async () => {
    const onTagSelect = vi.fn();
    render(<OrganizationManager onTagSelect={onTagSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
    });

    // Select first tag
    fireEvent.click(screen.getByTestId('tag-1'));
    expect(onTagSelect).toHaveBeenCalledWith(['1']);

    // Select second tag
    fireEvent.click(screen.getByTestId('tag-2'));
    expect(onTagSelect).toHaveBeenCalledWith(['1', '2']);

    // Deselect first tag
    fireEvent.click(screen.getByTestId('tag-1'));
    expect(onTagSelect).toHaveBeenCalledWith(['2']);
  });

  it('handles errors when loading organizations', async () => {
    (organizationService.getFolders as jest.Mock).mockRejectedValue(new Error('Failed to load'));

    render(<OrganizationManager />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load organizations')).toBeInTheDocument();
    });
  });

  it('handles errors when creating folder', async () => {
    (organizationService.createFolder as jest.Mock).mockRejectedValue(new Error('Failed to create'));

    render(<OrganizationManager />);

    // Click "New Folder" button
    fireEvent.click(screen.getByText('New Folder'));

    // Enter folder name
    const input = screen.getByPlaceholderText('Folder name');
    await userEvent.type(input, 'New Folder');

    // Click Create button
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('Failed to create folder')).toBeInTheDocument();
    });
  });

  it('handles errors when creating tag', async () => {
    (organizationService.createTag as jest.Mock).mockRejectedValue(new Error('Failed to create'));

    render(<OrganizationManager />);

    // Click "New Tag" button
    fireEvent.click(screen.getByText('New Tag'));

    // Enter tag name
    const input = screen.getByPlaceholderText('Tag name');
    await userEvent.type(input, 'New Tag');

    // Click Create button
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('Failed to create tag')).toBeInTheDocument();
    });
  });
}); 