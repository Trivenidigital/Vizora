import React, { useState } from 'react';
import { Folder, Tag } from '../types/organization';
import { 
  FunnelIcon, 
  XMarkIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  TagIcon,
  FolderIcon
} from '@heroicons/react/24/outline';
import { ContentType } from '../types/content';

interface ContentFilterBarProps {
  onFilterChange: (filters: any) => void;
  onSearch: (query: string) => void;
  folders: Folder[];
  tags: Tag[];
}

interface ContentFilters {
  type?: string;
  status?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  tags: string[];
  folder?: string;
  includeSubfolders?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const ContentFilterBar: React.FC<ContentFilterBarProps> = ({
  onFilterChange,
  onSearch,
  folders,
  tags
}) => {
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ContentFilters>({
    tags: [],
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  const handleFilterChange = (newFilters: Partial<ContentFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      tags: [],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const handleTagToggle = (tagId: string) => {
    const updatedTags = filters.tags.includes(tagId)
      ? filters.tags.filter(id => id !== tagId)
      : [...filters.tags, tagId];
    handleFilterChange({ tags: updatedTags });
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <div className="flex items-center space-x-4">
        {/* Search Bar */}
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              data-testid="search-input"
            />
          </div>
        </div>

        {/* Filter Button */}
        <button
          onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          data-testid="filters-button"
        >
          <FunnelIcon className="h-4 w-4 mr-2" />
          Filters
        </button>
      </div>

      {/* Filter Panel */}
      {isFilterPanelOpen && (
        <div className="mt-4 space-y-4">
          {/* Content Type */}
          <div>
            <label htmlFor="content-type" className="block text-sm font-medium text-gray-700 mb-1">
              Content Type
            </label>
            <select
              id="content-type"
              value={filters.type || ''}
              onChange={(e) => handleFilterChange({ type: e.target.value || undefined })}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              data-testid="content-type-select"
            >
              <option value="">All Types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="document">Documents</option>
              <option value="webpage">Web Pages</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              value={filters.status || ''}
              onChange={(e) => handleFilterChange({ status: e.target.value || undefined })}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              data-testid="status-select"
            >
              <option value="">All Statuses</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Folder */}
          <div>
            <label htmlFor="folder" className="block text-sm font-medium text-gray-700 mb-1">
              Folder
            </label>
            <select
              id="folder"
              value={filters.folder || ''}
              onChange={(e) => handleFilterChange({ folder: e.target.value || undefined })}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              data-testid="folder-select"
            >
              <option value="">All Folders</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <div className="mt-2">
              <label htmlFor="include-subfolders" className="inline-flex items-center">
                <input
                  id="include-subfolders"
                  type="checkbox"
                  checked={filters.includeSubfolders}
                  onChange={(e) => handleFilterChange({ includeSubfolders: e.target.checked })}
                  className="form-checkbox h-4 w-4 text-blue-600"
                  data-testid="include-subfolders"
                  disabled={!filters.folder}
                />
                <span className="ml-2 text-sm text-gray-700">
                  Include subfolders
                </span>
              </label>
            </div>
          </div>

          {/* Tags */}
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
                    filters.tags.includes(tag.id)
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  data-testid={`tag-${tag.id}`}
                  style={{
                    backgroundColor: filters.tags.includes(tag.id) ? `rgba(${tag.color}, 0.125)` : undefined,
                    color: filters.tags.includes(tag.id) ? tag.color : undefined
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <div className="flex space-x-2">
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange({ sortBy: e.target.value })}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                data-testid="sort-by-select"
              >
                <option value="createdAt">Date Created</option>
                <option value="updatedAt">Date Updated</option>
                <option value="name">Name</option>
              </select>
              <select
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange({ sortOrder: e.target.value as 'asc' | 'desc' })}
                className="block w-32 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                data-testid="sort-order-select"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          {/* Active Filters */}
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.folder && (
                <span 
                  className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  data-testid="active-folder"
                >
                  Folder: {folders.find(f => f.id === filters.folder)?.name}
                  <button
                    onClick={() => handleFilterChange({ folder: undefined })}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                    data-testid="remove-folder-filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.tags.map(tagId => {
                const tag = tags.find(t => t.id === tagId);
                if (!tag) return null;
                return (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    data-testid={`active-tag-${tag.id}`}
                    style={{
                      backgroundColor: `rgba(${tag.color}, 0.125)`,
                      color: tag.color
                    }}
                  >
                    {tag.name}
                    <button
                      onClick={() => handleTagToggle(tag.id)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                      data-testid={`remove-tag-${tag.id}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
            <button
              onClick={handleClearFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
              data-testid="clear-filters"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentFilterBar; 