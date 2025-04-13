import React, { useState, useEffect } from 'react';
import { Folder, Tag } from '../types/organization';
import organizationService from '../services/organizationService';
import { PlusIcon, TrashIcon, PencilIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface OrganizationManagerProps {
  onFolderSelect?: (folderId: string) => void;
  onTagSelect?: (tagIds: string[]) => void;
}

const OrganizationManager: React.FC<OrganizationManagerProps> = ({
  onFolderSelect,
  onTagSelect
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        owner: 'current-user' // Replace with actual user ID
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
        owner: 'current-user' // Replace with actual user ID
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
    onFolderSelect?.(folderId);
  };

  const handleTagSelect = (tagId: string) => {
    const newSelectedTags = selectedTags.includes(tagId)
      ? selectedTags.filter(id => id !== tagId)
      : [...selectedTags, tagId];
    setSelectedTags(newSelectedTags);
    onTagSelect?.(newSelectedTags);
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await organizationService.deleteFolder(folderId);
      setFolders(folders.filter(f => f.id !== folderId));
      if (selectedFolder === folderId) {
        setSelectedFolder(null);
        onFolderSelect?.('');
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
      onTagSelect?.(selectedTags.filter(id => id !== tagId));
    } catch (err) {
      setError('Failed to delete tag');
    }
  };

  return (
    <div className="space-y-6">
      {/* Folders Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Folders</h3>
          <button
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
            onClick={() => setIsCreatingFolder(true)}
          >
            <PlusIcon className="h-4 w-4 mr-1" />
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
            />
            <div className="mt-2 flex justify-end space-x-2">
              <button
                onClick={() => setIsCreatingFolder(false)}
                className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-3 py-1.5 text-sm text-blue-700 hover:text-blue-900"
              >
                Create
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {folders.map((folder) => (
            <div 
              key={folder.id}
              onClick={() => onFolderSelect(folder.id)}
              className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer"
              data-testid={`folder-${folder.id}`}
            >
              <span>{folder.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(folder.id);
                }}
                className="text-red-600 hover:text-red-800"
                data-testid={`delete-folder-${folder.id}`}
                aria-label={`delete folder ${folder.name.toLowerCase()}`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tags Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Tags</h3>
          <button
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
            onClick={() => setIsCreatingTag(true)}
          >
            <PlusIcon className="h-4 w-4 mr-1" />
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
            />
            <div className="mt-2 flex justify-end space-x-2">
              <button
                onClick={() => setIsCreatingTag(false)}
                className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                className="px-3 py-1.5 text-sm text-blue-700 hover:text-blue-900"
              >
                Create
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div 
              key={tag.id}
              onClick={() => handleTagSelect(tag.id)}
              className={`flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer ${
                selectedTags.includes(tag.id) ? 'bg-blue-50' : ''
              }`}
              data-testid={`tag-${tag.id}`}
            >
              <span>{tag.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTag(tag.id);
                }}
                className="text-red-600 hover:text-red-800"
                data-testid={`delete-tag-${tag.id}`}
                aria-label={`delete tag ${tag.name.toLowerCase()}`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

export default OrganizationManager; 