import React, { useState, useEffect } from 'react';
import { Content } from '../types/content';
import { Folder, Tag } from '../types/organization';
import ContentCard from './ContentCard';
import ContentFilterBar from './ContentFilterBar';
import ContentOrganizationBadges from './ContentOrganizationBadges';
import BulkOrganizationActions from './BulkOrganizationActions';
import ContentDisplayActions from './ContentDisplayActions';
import organizationService from '../services/organizationService';

interface ContentListProps {
  onContentSelect?: (content: Content) => void;
}

interface ContentFilters {
  folderId?: string;
  tagIds?: string[];
  includeSubfolders?: boolean;
  search?: string;
}

const ContentList: React.FC<ContentListProps> = ({ onContentSelect }) => {
  const [content, setContent] = useState<Content[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showDisplayActions, setShowDisplayActions] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [contentResponse, foldersData, tagsData] = await Promise.all([
          organizationService.getContentByOrganization({}),
          organizationService.getFolders(),
          organizationService.getTags()
        ]);

        if (isMounted) {
          setContent(contentResponse || []);
          setFolders(foldersData || []);
          setTags(tagsData || []);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load content');
          setContent([]);
          setFolders([]);
          setTags([]);
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadContent = async () => {
    try {
      setIsLoading(true);
      const response = await organizationService.getContentByOrganization({});
      setContent(response || []);
      setError(null);
    } catch (err) {
      setError('Failed to load content');
      setContent([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentSelect = (contentId: string) => {
    setSelectedContentIds(prev =>
      prev.includes(contentId)
        ? prev.filter(id => id !== contentId)
        : [...prev, contentId]
    );
  };

  const handleBulkActionComplete = async () => {
    setSelectedContentIds([]);
    setShowBulkActions(false);
    await loadContent();
  };

  const handleDisplayActionComplete = async () => {
    setSelectedContent(null);
    setShowDisplayActions(false);
    await loadContent();
  };

  const handleFilterChange = async (filters: ContentFilters) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await organizationService.getContentByOrganization({
        folderId: filters.folderId,
        tagIds: filters.tagIds,
        includeSubfolders: filters.includeSubfolders
      });
      setContent(response || []);
    } catch (err) {
      setError('Failed to apply filters');
      setContent([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await organizationService.getContentByOrganization({
        search: query
      });
      setContent(response || []);
    } catch (err) {
      setError('Failed to search content');
      setContent([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentClick = (content: Content) => {
    setSelectedContent(content);
    setShowDisplayActions(true);
  };

  const handleDelete = async (id: string) => {
    try {
      setIsLoading(true);
      await organizationService.deleteContent(id);
      await loadContent();
    } catch (err) {
      setError('Failed to delete content');
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <ContentFilterBar
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        folders={folders}
        tags={tags}
      />

      {selectedContentIds.length > 0 && (
        <div data-testid="selection-banner" className="flex items-center justify-between bg-blue-50 p-4 rounded-lg">
          <span className="text-sm text-blue-700">
            {selectedContentIds.length} items selected
          </span>
          <div className="space-x-2">
            <button
              onClick={() => setShowBulkActions(true)}
              className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              data-testid="organize-selected-button"
            >
              Organize Selected
            </button>
            <button
              onClick={() => setSelectedContentIds([])}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              data-testid="clear-selection-button"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {showBulkActions && (
        <BulkOrganizationActions
          selectedContentIds={selectedContentIds}
          onComplete={handleBulkActionComplete}
        />
      )}

      {showDisplayActions && selectedContent && (
        <ContentDisplayActions
          contentId={selectedContent.id}
          onComplete={handleDisplayActionComplete}
        />
      )}

      <div data-testid="content-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div data-testid="loading-state" className="col-span-full flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="col-span-full text-center text-red-600 p-4" data-testid="error-state">
            {error}
          </div>
        ) : content.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 p-4" data-testid="empty-state">
            No content found
          </div>
        ) : (
          content.map((item) => (
            <div key={item.id} data-testid={`content-item-${item.id}`} className="relative">
              <div
                data-testid={`content-select-${item.id}`}
                className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-opacity bg-white border-gray-300 group-hover:opacity-100 opacity-0 cursor-pointer"
                onClick={() => handleContentSelect(item.id)}
              />
              <div
                data-testid={`content-card-${item.id}`}
                className="relative bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer group"
                onClick={() => handleContentClick(item)}
              >
                <ContentCard
                  content={item}
                  isSelected={selectedContentIds.includes(item.id)}
                />
                <div className="absolute bottom-2 left-2 right-2">
                  <ContentOrganizationBadges
                    folder={item.folder}
                    tags={item.tags}
                    onFolderClick={() => handleFilterChange({ folderId: item.folder?.id })}
                    onTagClick={(tagId) => handleFilterChange({ tagIds: [tagId] })}
                  />
                </div>
              </div>
              <button
                data-testid={`delete-button-${item.id}`}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                onClick={() => handleDelete(item.id)}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ContentList; 