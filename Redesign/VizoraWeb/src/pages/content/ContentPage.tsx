import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  PhotoIcon, FilmIcon, GlobeAltIcon, DocumentTextIcon, 
  FolderIcon, Square3Stack3DIcon, ArrowPathIcon,
  PlusIcon, FunnelIcon, ArrowUpTrayIcon, CheckIcon,
  EllipsisHorizontalIcon, MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import contentService from '../../services/contentService';
import { ContentUploadModal } from './ContentUploadModal';
import { ContentDetailsPanel } from './ContentDetailsPanel';
import { ContentFilterBar } from './ContentFilterBar';
import { Spinner } from '../../components/ui/Spinner';

// Define content types
export type ContentType = 'image' | 'video' | 'webpage' | 'document' | 'app' | 'playlist' | 'stream';

// Content interface matching our service
export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  url: string;
  thumbnail?: string;
  description?: string;
  status: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  size?: number;
  duration?: number;
  tags?: string[];
  version?: number;
}

// Content type icons mapping
const contentTypeIcons: Record<ContentType, React.ForwardRefExoticComponent<any>> = {
  image: PhotoIcon,
  video: FilmIcon,
  webpage: GlobeAltIcon,
  document: DocumentTextIcon,
  app: Square3Stack3DIcon,
  playlist: FolderIcon,
  stream: ArrowPathIcon
};

// Helper for file sizes
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

// Content view types
type ViewMode = 'grid' | 'list';

const ContentPageContent: React.FC = () => {
  const queryClient = useQueryClient();
  const [filteredItems, setFilteredItems] = useState<ContentItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ContentType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'type' | 'size'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch content using React Query
  const { data: contentData, isLoading, error } = useQuery({
    queryKey: ['content'],
    queryFn: () => contentService.getContentList({}),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const contentItems = contentData?.data || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => contentService.deleteContent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      toast.success('Content deleted successfully');
    },
    onError: (err) => {
      console.error('Error deleting content:', err);
      toast.error('Failed to delete content');
    },
  });

  // Push to displays mutation
  const pushToDisplaysMutation = useMutation({
    mutationFn: (id: string) => contentService.pushContentToAllDisplays(id),
    onSuccess: () => {
      toast.success('Content pushed to all displays successfully');
    },
    onError: (err) => {
      console.error('Error pushing content:', err);
      toast.error('Failed to push content to displays');
    },
  });

  // Apply filters and sorting when dependencies change
  useEffect(() => {
    filterAndSortContent();
  }, [contentItems, searchQuery, activeFilter, sortBy, sortDirection]);

  const filterAndSortContent = () => {
    // Filter by search query and content type
    const filtered = contentItems.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (item.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
      const matchesType = activeFilter === 'all' || item.type === activeFilter;
      return matchesSearch && matchesType;
    });
    
    // Sort by the selected criteria
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'date':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    setFilteredItems(filtered);
  };
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };
  
  const handleFilterChange = (filter: ContentType | 'all') => {
    setActiveFilter(filter);
  };
  
  const handleSortChange = (sort: 'date' | 'name' | 'type' | 'size') => {
    if (sortBy === sort) {
      // Toggle direction if clicking the same sort option
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(sort);
      setSortDirection('desc'); // Default to descending when changing sort type
    }
  };
  
  const handleItemSelect = (id: string, isMultiSelect: boolean) => {
    if (isMultiSelect) {
      // Multi-select logic (Ctrl/Cmd key pressed)
      const newSelected = new Set(selectedItems);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelectedItems(newSelected);
    } else {
      // Single select
      if (selectedItems.size === 1 && selectedItems.has(id)) {
        // Deselect if clicking the only selected item
        setSelectedItems(new Set());
        setSelectedItemId(null);
        setDetailsOpen(false);
      } else {
        // Select only this item
        setSelectedItems(new Set([id]));
        setSelectedItemId(id);
        setDetailsOpen(true);
      }
    }
  };
  
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedItems.size} item(s)?`)) {
      try {
        const deletePromises = Array.from(selectedItems).map(id => 
          deleteMutation.mutateAsync(id)
        );
        
        await Promise.all(deletePromises);
        setSelectedItems(new Set());
      } catch (err) {
        console.error('Error deleting items:', err);
        toast.error('Failed to delete items');
      }
    }
  };
  
  const handleContentUpload = (newContent: ContentItem) => {
    // Implement content upload logic
    setIsUploadModalOpen(false);
    toast.success('Content uploaded successfully!');
  };
  
  const handlePushToDisplays = async (contentId: string) => {
    await pushToDisplaysMutation.mutateAsync(contentId);
  };
  
  const selectedItem = selectedItemId 
    ? contentItems.find(item => item.id === selectedItemId) 
    : null;
  
  // Create view options (cards list or table)
  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {filteredItems.map(item => {
        const IconComponent = contentTypeIcons[item.type] || DocumentTextIcon;
        const isSelected = selectedItems.has(item.id);
        
        return (
          <div
            key={item.id}
            className={`relative overflow-hidden rounded-lg border ${
              isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
            } bg-white shadow transition-all hover:shadow-md`}
            onClick={(e) => handleItemSelect(item.id, e.ctrlKey || e.metaKey)}
            data-testid="content-item"
          >
            {/* Selection indicator */}
            <div className="absolute top-2 left-2 z-10">
              <div className={`rounded-full w-5 h-5 flex items-center justify-center ${
                isSelected ? 'bg-blue-500' : 'bg-gray-200 bg-opacity-70'
              }`}>
                {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
              </div>
            </div>
            
            {/* Thumbnail or placeholder */}
            <div className="aspect-video w-full bg-gray-100 relative">
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <IconComponent className="h-12 w-12 text-gray-400" />
                </div>
              )}
              
              {/* Type badge */}
              <span className="absolute bottom-2 right-2 rounded-full bg-gray-800 bg-opacity-70 px-2 py-0.5 text-xs text-white">
                {item.type}
              </span>
            </div>
            
            {/* Content info */}
            <div className="p-4">
              <h3 className="truncate text-sm font-medium text-gray-900">{item.title}</h3>
              <div className="mt-1 flex items-center text-xs text-gray-500">
                <span>{formatFileSize(item.size)}</span>
                <span className="mx-1.5">•</span>
                <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
              </div>
              
              {/* Action buttons */}
              <div className="mt-4 flex justify-between">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePushToDisplays(item.id);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Push to Displays
                </button>
                <div className="relative group">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Toggle dropdown menu
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <EllipsisHorizontalIcon className="h-5 w-5" />
                  </button>
                  {/* Dropdown menu would be here */}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Add content card */}
      <div
        onClick={() => setIsUploadModalOpen(true)}
        className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-gray-400 hover:bg-gray-50"
      >
        <ArrowUpTrayIcon className="h-10 w-10 text-gray-400" />
        <span className="text-sm font-medium text-gray-900">Add New Content</span>
        <span className="text-xs text-gray-500">Upload files or create content</span>
      </div>
    </div>
  );
  
  const renderListView = () => (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="w-10 px-3 py-3.5">
              {/* Bulk selection checkbox would go here */}
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
              onClick={() => handleSortChange('name')}
            >
              Name
              {sortBy === 'name' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
              onClick={() => handleSortChange('type')}
            >
              Type
              {sortBy === 'type' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
              onClick={() => handleSortChange('size')}
            >
              Size
              {sortBy === 'size' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
              onClick={() => handleSortChange('date')}
            >
              Last Modified
              {sortBy === 'date' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {filteredItems.map((item) => {
            const IconComponent = contentTypeIcons[item.type] || DocumentTextIcon;
            const isSelected = selectedItems.has(item.id);
            
            return (
              <tr 
                key={item.id} 
                className={`${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={(e) => handleItemSelect(item.id, e.ctrlKey || e.metaKey)}
                data-testid="content-item"
              >
                <td className="w-10 px-3 py-4">
                  <div className={`h-4 w-4 rounded-sm ${isSelected ? 'bg-blue-500' : 'border border-gray-300'}`}>
                    {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
                  </div>
                </td>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                  <div className="flex items-center">
                    <div className="h-8 w-8 flex-shrink-0 mr-3">
                      {item.thumbnail ? (
                        <img 
                          src={item.thumbnail} 
                          alt={item.title}
                          className="h-8 w-8 rounded object-cover" 
                        />
                      ) : (
                        <IconComponent className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                    <div className="font-medium text-gray-900">{item.title}</div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">
                  {item.type}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {formatFileSize(item.size)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {new Date(item.updatedAt).toLocaleDateString()}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePushToDisplays(item.id);
                    }}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    Push
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Preview action
                    }}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    Preview
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Delete action
                    }}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all your digital signage content in one place
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            data-testid="view-toggle-button"
          >
            {viewMode === 'grid' ? 'List View' : 'Grid View'}
          </button>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            data-testid="upload-button"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Add Content
          </button>
        </div>
      </div>
      
      {/* Search and filters bar */}
      <div className="flex items-center space-x-4 border-b border-gray-200 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center max-w-md">
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="block w-full rounded-md border-gray-300 pl-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Search content..."
              data-testid="search-input"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Filter:</span>
          <select
            value={activeFilter}
            onChange={(e) => handleFilterChange(e.target.value as ContentType | 'all')}
            className="rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="webpage">Webpages</option>
            <option value="document">Documents</option>
            <option value="app">Apps</option>
            <option value="playlist">Playlists</option>
            <option value="stream">Streams</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Sort:</span>
          <select
            value={`${sortBy}-${sortDirection}`}
            onChange={(e) => {
              const [sort, direction] = e.target.value.split('-');
              setSortBy(sort as 'date' | 'name' | 'type' | 'size');
              setSortDirection(direction as 'asc' | 'desc');
            }}
            className="rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="type-asc">Type (A-Z)</option>
            <option value="size-desc">Size (Largest)</option>
            <option value="size-asc">Size (Smallest)</option>
          </select>
        </div>
        
        {selectedItems.size > 0 && (
          <div className="flex items-center space-x-2 ml-auto bg-blue-50 px-3 py-1.5 rounded-md">
            <span className="text-sm text-blue-700">{selectedItems.size} selected</span>
            <button
              onClick={handleBulkDelete}
              className="text-sm text-red-600 hover:text-red-800"
              data-testid="delete-button"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      
      {/* Main content area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
              <p className="mt-3 text-sm text-gray-500">Loading content...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                {/* Error icon would go here */}
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading content</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error.message}</p>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => queryClient.invalidateQueries(['content'])}
                    className="rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <DocumentTextIcon className="h-12 w-12" />
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No content</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || activeFilter !== 'all'
                ? 'No content matches your filters. Try different search terms or filters.'
                : 'Get started by creating or uploading new content.'}
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                Add Content
              </button>
            </div>
          </div>
        ) : (
          <div className="min-h-full">
            {viewMode === 'grid' ? renderGridView() : renderListView()}
          </div>
        )}
      </div>
      
      {/* Content Upload Modal */}
      {isUploadModalOpen && (
        <ContentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onContentUploaded={handleContentUpload}
        />
      )}
      
      {/* Content Details Sidebar */}
      {selectedItem && (
        <ContentDetailsPanel
          isOpen={detailsOpen}
          onClose={() => {
            setDetailsOpen(false);
            setSelectedItemId(null);
            setSelectedItems(new Set());
          }}
          content={selectedItem}
          onContentUpdated={(updatedContent) => {
            // Implement content update logic
          }}
          onContentDeleted={(id) => {
            // Implement content deletion logic
          }}
        />
      )}
    </div>
  );
}

export const ContentPage: React.FC = () => {
  return <ContentPageContent />;
}; 