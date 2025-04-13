import React, { useState, useEffect } from 'react';
import { Folder, Tag } from '../types/organization';
import organizationService from '../services/organizationService';
import { FolderIcon, TagIcon } from '@heroicons/react/24/outline';

interface BulkOrganizationActionsProps {
  selectedContentIds: string[];
  onComplete?: () => void;
}

const BulkOrganizationActions: React.FC<BulkOrganizationActionsProps> = ({
  selectedContentIds,
  onComplete
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleApply = async () => {
    if (selectedContentIds.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      await Promise.all(
        selectedContentIds.map(contentId =>
          organizationService.updateContentOrganization(contentId, {
            folderId: selectedFolder || undefined,
            tagIds: selectedTags
          })
        )
      );
      onComplete?.();
    } catch (err) {
      setError('Failed to update content organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Bulk Organization ({selectedContentIds.length} items)
        </h3>
      </div>

      <div className="space-y-4">
        {/* Folder Selection */}
        <div>
          <label 
            htmlFor="folder-select" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Folder
          </label>
          <select
            id="folder-select"
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="">No Folder</option>
            {folders.map(folder => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tags Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => handleTagToggle(tag.id)}
                className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-sm font-medium ${
                  selectedTags.includes(tag.id)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color } : undefined}
              >
                <TagIcon className="h-4 w-4 mr-1" />
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => {
              setSelectedFolder('');
              setSelectedTags([]);
              onComplete?.();
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isLoading || (!selectedFolder && selectedTags.length === 0)}
            className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              (isLoading || (!selectedFolder && selectedTags.length === 0))
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {isLoading ? 'Applying...' : 'Apply Changes'}
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkOrganizationActions; 