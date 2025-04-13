import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import BulkOrganizationActions from '../BulkOrganizationActions';
import organizationService from '../../services/organizationService';
import { Folder, Tag } from '../../types/organization';

// Mock the organization service
vi.mock('../../services/organizationService', () => ({
  default: {
    getFolders: vi.fn(),
    getTags: vi.fn(),
    updateContentOrganization: vi.fn()
  }
}));

describe('BulkOrganizationActions', () => {
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

  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (organizationService.getFolders as ReturnType<typeof vi.fn>).mockResolvedValue(mockFolders);
    (organizationService.getTags as ReturnType<typeof vi.fn>).mockResolvedValue(mockTags);
  });

  it('renders bulk organization actions with folders and tags', async () => {
    render(
      <BulkOrganizationActions
        selectedContentIds={['content1', 'content2']}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bulk Organization (2 items)')).toBeInTheDocument();
      expect(screen.getByText('Folder 1')).toBeInTheDocument();
      expect(screen.getByText('Folder 2')).toBeInTheDocument();
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
    });
  });

  it('handles folder selection', async () => {
    render(
      <BulkOrganizationActions
        selectedContentIds={['content1']}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Folder 1')).toBeInTheDocument();
    });

    const folderSelect = screen.getByLabelText('Folder');
    await userEvent.selectOptions(folderSelect, 'folder1');

    expect(folderSelect).toHaveValue('folder1');
  });

  it('handles tag selection', async () => {
    render(
      <BulkOrganizationActions
        selectedContentIds={['content1']}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
    });

    const tag1Button = screen.getByText('Tag 1');
    await userEvent.click(tag1Button);

    expect(tag1Button).toHaveClass('bg-blue-100');
  });

  it('handles multiple tag selection', async () => {
    render(
      <BulkOrganizationActions
        selectedContentIds={['content1']}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
    });

    const tag1Button = screen.getByText('Tag 1');
    const tag2Button = screen.getByText('Tag 2');

    await userEvent.click(tag1Button);
    await userEvent.click(tag2Button);

    expect(tag1Button).toHaveClass('bg-blue-100');
    expect(tag2Button).toHaveClass('bg-blue-100');
  });

  it('handles tag deselection', async () => {
    render(
      <BulkOrganizationActions
        selectedContentIds={['content1']}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
    });

    const tagButton = screen.getByText('Tag 1');
    await userEvent.click(tagButton);
    await userEvent.click(tagButton);

    expect(tagButton).not.toHaveClass('bg-blue-100');
  });

  it('handles apply button click with selected folder and tags', async () => {
    (organizationService.updateContentOrganization as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(
      <BulkOrganizationActions
        selectedContentIds={['content1']}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
    });

    // Select folder and tag
    const folderSelect = screen.getByLabelText('Folder');
    await userEvent.selectOptions(folderSelect, 'folder1');
    const tagButton = screen.getByText('Tag 1');
    await userEvent.click(tagButton);

    // Click apply
    const applyButton = screen.getByText('Apply Changes');
    await userEvent.click(applyButton);

    await waitFor(() => {
      expect(organizationService.updateContentOrganization).toHaveBeenCalledWith('content1', {
        folderId: 'folder1',
        tagIds: ['tag1']
      });
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('handles cancel button click', async () => {
    render(
      <BulkOrganizationActions
        selectedContentIds={['content1']}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    await userEvent.click(cancelButton);

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('handles error when loading organizations', async () => {
    (organizationService.getFolders as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to load folders'));

    render(
      <BulkOrganizationActions
        selectedContentIds={['content1']}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load organizations')).toBeInTheDocument();
    });
  });

  it('handles error when applying changes', async () => {
    (organizationService.updateContentOrganization as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to update organization'));

    render(
      <BulkOrganizationActions
        selectedContentIds={['content1']}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
    });

    // Select folder and tag
    const folderSelect = screen.getByLabelText('Folder');
    await userEvent.selectOptions(folderSelect, 'folder1');
    const tagButton = screen.getByText('Tag 1');
    await userEvent.click(tagButton);

    // Click apply
    const applyButton = screen.getByText('Apply Changes');
    await userEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to update content organization')).toBeInTheDocument();
    });
  });
}); 