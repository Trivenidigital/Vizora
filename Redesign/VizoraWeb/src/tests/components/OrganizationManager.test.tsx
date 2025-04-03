import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { createSuccessQueryResponse } from '../helpers/queryMockHelpers';
import reactQueryMock from '../../mocks/reactQuery';

// Define interfaces
interface Folder {
  id: string;
  name: string;
  owner: string;
}

interface Tag {
  id: string;
  name: string;
  owner: string;
}

// Mock organization service
const organizationService = {
  getFolders: vi.fn(),
  getTags: vi.fn(),
  createFolder: vi.fn(),
  createTag: vi.fn(),
  deleteFolder: vi.fn(),
  deleteTag: vi.fn()
};

vi.mock('../../services/organizationService', () => ({
  default: organizationService
}));

// Mock OrganizationManager component
const OrganizationManager = () => {
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [tags, setTags] = React.useState<Tag[]>([]);
  const [selectedFolder, setSelectedFolder] = React.useState<string | null>(null);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
  const [isCreatingTag, setIsCreatingTag] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');
  const [newTagName, setNewTagName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const [foldersData, tagsData] = await Promise.all([
        organizationService.getFolders(),
        organizationService.getTags()
      ]);
      setFolders(foldersData);
      setTags(tagsData);
    } catch (err) {
      setError('Failed to load organizations');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const newFolder = await organizationService.createFolder({
        name: newFolderName,
        owner: 'current-user'
      });
      setFolders([...folders, newFolder]);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err) {
      setError('Failed to create folder');
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const newTag = await organizationService.createTag({
        name: newTagName,
        owner: 'current-user'
      });
      setTags([...tags, newTag]);
      setNewTagName('');
      setIsCreatingTag(false);
    } catch (err) {
      setError('Failed to create tag');
    }
  };

  const handleFolderSelect = (folderId: string) => {
    setSelectedFolder(folderId);
  };

  const handleTagSelect = (tagId: string) => {
    const newSelectedTags = selectedTags.includes(tagId)
      ? selectedTags.filter(id => id !== tagId)
      : [...selectedTags, tagId];
    setSelectedTags(newSelectedTags);
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await organizationService.deleteFolder(folderId);
      setFolders(folders.filter(f => f.id !== folderId));
      if (selectedFolder === folderId) {
        setSelectedFolder(null);
      }
    } catch (err) {
      setError('Failed to delete folder');
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await organizationService.deleteTag(tagId);
      setTags(tags.filter(t => t.id !== tagId));
      setSelectedTags(selectedTags.filter(id => id !== tagId));
    } catch (err) {
      setError('Failed to delete tag');
    }
  };

  return (
    <div className="space-y-6" data-testid="organization-manager">
      {/* Folders Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Folders</h3>
          <button
            onClick={() => setIsCreatingFolder(true)}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
            data-testid="create-folder-button"
          >
            New Folder
          </button>
        </div>

        {isCreatingFolder && (
          <div className="mb-4">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              data-testid="new-folder-input"
            />
            <div className="mt-2 flex justify-end space-x-2">
              <button
                onClick={() => setIsCreatingFolder(false)}
                className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900"
                data-testid="cancel-folder-button"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-3 py-1.5 text-sm text-blue-700 hover:text-blue-900"
                data-testid="confirm-folder-button"
              >
                Create
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {folders.map(folder => (
            <div
              key={folder.id}
              className={`flex items-center justify-between p-2 rounded-md ${
                selectedFolder === folder.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
              data-testid={`folder-${folder.id}`}
            >
              <button
                onClick={() => handleFolderSelect(folder.id)}
                className="flex-1 text-left"
                data-testid={`folder-name-${folder.id}`}
              >
                {folder.name}
              </button>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="text-gray-400 hover:text-red-500"
                  aria-label={`Delete ${folder.name}`}
                  data-testid={`delete-folder-${folder.id}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tags Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Tags</h3>
          <button
            onClick={() => setIsCreatingTag(true)}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
            data-testid="create-tag-button"
          >
            New Tag
          </button>
        </div>

        {isCreatingTag && (
          <div className="mb-4">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              data-testid="new-tag-input"
            />
            <div className="mt-2 flex justify-end space-x-2">
              <button
                onClick={() => setIsCreatingTag(false)}
                className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900"
                data-testid="cancel-tag-button"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                className="px-3 py-1.5 text-sm text-blue-700 hover:text-blue-900"
                data-testid="confirm-tag-button"
              >
                Create
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <button
              key={tag.id}
              onClick={() => handleTagSelect(tag.id)}
              className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-sm font-medium ${
                selectedTags.includes(tag.id)
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid={`tag-${tag.id}`}
            >
              {tag.name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTag(tag.id);
                }}
                className="ml-1 text-gray-400 hover:text-red-500"
                aria-label={`Delete ${tag.name}`}
                data-testid={`delete-tag-${tag.id}`}
              >
                Delete
              </button>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600" data-testid="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

describe('OrganizationManager Component', () => {
  const mockFolders: Folder[] = [
    { id: '1', name: 'Folder 1', owner: 'current-user' },
    { id: '2', name: 'Folder 2', owner: 'current-user' }
  ];

  const mockTags: Tag[] = [
    { id: '1', name: 'Tag 1', owner: 'current-user' },
    { id: '2', name: 'Tag 2', owner: 'current-user' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    reactQueryMock.resetReactQueryMocks();
    
    // Mock successful folder and tag fetching
    organizationService.getFolders.mockResolvedValue(mockFolders);
    organizationService.getTags.mockResolvedValue(mockTags);
    
    // Mock successful creation
    organizationService.createFolder.mockImplementation(({ name }) => ({
      id: String(mockFolders.length + 1),
      name,
      owner: 'current-user'
    }));
    
    organizationService.createTag.mockImplementation(({ name }) => ({
      id: String(mockTags.length + 1),
      name,
      owner: 'current-user'
    }));
  });

  it('renders folders and tags', async () => {
    render(<OrganizationManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('organization-manager')).toBeInTheDocument();
    });
    
    // Check if folders are rendered
    expect(screen.getByTestId('folder-1')).toBeInTheDocument();
    expect(screen.getByTestId('folder-2')).toBeInTheDocument();
    expect(screen.getByTestId('folder-name-1')).toHaveTextContent('Folder 1');
    expect(screen.getByTestId('folder-name-2')).toHaveTextContent('Folder 2');
    
    // Check if tags are rendered
    expect(screen.getByTestId('tag-1')).toBeInTheDocument();
    expect(screen.getByTestId('tag-2')).toBeInTheDocument();
    expect(screen.getByTestId('tag-1')).toHaveTextContent('Tag 1');
    expect(screen.getByTestId('tag-2')).toHaveTextContent('Tag 2');
  });

  it('creates a new folder', async () => {
    render(<OrganizationManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('organization-manager')).toBeInTheDocument();
    });
    
    // Click create folder button
    fireEvent.click(screen.getByTestId('create-folder-button'));
    
    // Enter folder name
    fireEvent.change(screen.getByTestId('new-folder-input'), {
      target: { value: 'New Folder' }
    });
    
    // Click create button
    fireEvent.click(screen.getByTestId('confirm-folder-button'));
    
    // Check if createFolder was called
    expect(organizationService.createFolder).toHaveBeenCalledWith({
      name: 'New Folder',
      owner: 'current-user'
    });
    
    // Check if new folder is rendered
    await waitFor(() => {
      expect(screen.getByTestId('folder-3')).toBeInTheDocument();
      expect(screen.getByTestId('folder-name-3')).toHaveTextContent('New Folder');
    });
  });

  it('creates a new tag', async () => {
    render(<OrganizationManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('organization-manager')).toBeInTheDocument();
    });
    
    // Click create tag button
    fireEvent.click(screen.getByTestId('create-tag-button'));
    
    // Enter tag name
    fireEvent.change(screen.getByTestId('new-tag-input'), {
      target: { value: 'New Tag' }
    });
    
    // Click create button
    fireEvent.click(screen.getByTestId('confirm-tag-button'));
    
    // Check if createTag was called
    expect(organizationService.createTag).toHaveBeenCalledWith({
      name: 'New Tag',
      owner: 'current-user'
    });
    
    // Check if new tag is rendered
    await waitFor(() => {
      expect(screen.getByTestId('tag-3')).toBeInTheDocument();
      expect(screen.getByTestId('tag-3')).toHaveTextContent('New Tag');
    });
  });

  it('deletes a folder', async () => {
    render(<OrganizationManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('organization-manager')).toBeInTheDocument();
    });
    
    // Click delete button for Folder 1
    fireEvent.click(screen.getByTestId('delete-folder-1'));
    
    // Check if deleteFolder was called
    expect(organizationService.deleteFolder).toHaveBeenCalledWith('1');
    
    // Check if folder is removed from the list
    await waitFor(() => {
      expect(screen.queryByTestId('folder-1')).not.toBeInTheDocument();
    });
  });

  it('deletes a tag', async () => {
    render(<OrganizationManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('organization-manager')).toBeInTheDocument();
    });
    
    // Click delete button for Tag 1
    fireEvent.click(screen.getByTestId('delete-tag-1'));
    
    // Check if deleteTag was called
    expect(organizationService.deleteTag).toHaveBeenCalledWith('1');
    
    // Check if tag is removed from the list
    await waitFor(() => {
      expect(screen.queryByTestId('tag-1')).not.toBeInTheDocument();
    });
  });

  it('selects a folder', async () => {
    render(<OrganizationManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('organization-manager')).toBeInTheDocument();
    });
    
    // Click on Folder 1
    fireEvent.click(screen.getByTestId('folder-name-1'));
    
    // Check if folder is selected
    expect(screen.getByTestId('folder-1')).toHaveClass('bg-blue-50');
  });

  it('selects multiple tags', async () => {
    render(<OrganizationManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('organization-manager')).toBeInTheDocument();
    });
    
    // Click on Tag 1
    fireEvent.click(screen.getByTestId('tag-1'));
    
    // Click on Tag 2
    fireEvent.click(screen.getByTestId('tag-2'));
    
    // Check if tags are selected
    expect(screen.getByTestId('tag-1')).toHaveClass('bg-blue-100');
    expect(screen.getByTestId('tag-2')).toHaveClass('bg-blue-100');
  });

  it('handles errors during folder creation', async () => {
    // Mock folder creation error
    organizationService.createFolder.mockRejectedValue(new Error('Failed to create folder'));
    
    render(<OrganizationManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('organization-manager')).toBeInTheDocument();
    });
    
    // Click create folder button
    fireEvent.click(screen.getByTestId('create-folder-button'));
    
    // Enter folder name
    fireEvent.change(screen.getByTestId('new-folder-input'), {
      target: { value: 'New Folder' }
    });
    
    // Click create button
    fireEvent.click(screen.getByTestId('confirm-folder-button'));
    
    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to create folder');
    });
  });

  it('handles errors during tag creation', async () => {
    // Mock tag creation error
    organizationService.createTag.mockRejectedValue(new Error('Failed to create tag'));
    
    render(<OrganizationManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('organization-manager')).toBeInTheDocument();
    });
    
    // Click create tag button
    fireEvent.click(screen.getByTestId('create-tag-button'));
    
    // Enter tag name
    fireEvent.change(screen.getByTestId('new-tag-input'), {
      target: { value: 'New Tag' }
    });
    
    // Click create button
    fireEvent.click(screen.getByTestId('confirm-tag-button'));
    
    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to create tag');
    });
  });

  it('handles errors during folder deletion', async () => {
    // Mock folder deletion error
    organizationService.deleteFolder.mockRejectedValue(new Error('Failed to delete folder'));
    
    render(<OrganizationManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('organization-manager')).toBeInTheDocument();
    });
    
    // Click delete button for Folder 1
    fireEvent.click(screen.getByTestId('delete-folder-1'));
    
    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to delete folder');
    });
  });

  it('handles errors during tag deletion', async () => {
    // Mock tag deletion error
    organizationService.deleteTag.mockRejectedValue(new Error('Failed to delete tag'));
    
    render(<OrganizationManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('organization-manager')).toBeInTheDocument();
    });
    
    // Click delete button for Tag 1
    fireEvent.click(screen.getByTestId('delete-tag-1'));
    
    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to delete tag');
    });
  });
}); 