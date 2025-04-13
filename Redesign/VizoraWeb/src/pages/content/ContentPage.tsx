import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  PhotoIcon, FilmIcon, GlobeAltIcon, DocumentTextIcon, 
  FolderIcon, Square3Stack3DIcon, ArrowPathIcon,
  PlusIcon, FunnelIcon, ArrowUpTrayIcon, CheckIcon,
  EllipsisHorizontalIcon, MagnifyingGlassIcon, ListBulletIcon, Squares2X2Icon, ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { contentService } from '@vizora/common';
import { ContentUploadModal } from './ContentUploadModal';
import { ContentDetailsPanel } from './ContentDetailsPanel';
import { ContentFilterBar } from './ContentFilterBar';
import { Spinner } from '../../components/ui/Spinner';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';

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
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {filteredItems.map((item) => {
        const IconComponent = contentTypeIcons[item.type] || DocumentTextIcon;
        const isSelected = selectedItems.has(item.id);
        
        return (
          <Card
            key={item.id}
            selected={isSelected}
            interactive={true}
            onClick={(e) => handleItemSelect(item.id, e.ctrlKey || e.metaKey)}
            className="group relative flex flex-col"
            data-testid="content-item"
          >
            {/* Selection indicator */}
            {isSelected && (
              <div className="absolute top-2 left-2 z-10 rounded-full bg-violet-500 p-1 shadow-sm">
                <CheckIcon className="h-4 w-4 text-white" />
              </div>
            )}
            
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
                  <IconComponent className="h-14 w-14 text-gray-400" />
                </div>
              )}
              
              {/* Type badge */}
              <span className="absolute bottom-2 right-2 rounded-full bg-gray-800/70 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white">
                {item.type}
              </span>
            </div>
            
            {/* Content info */}
            <CardBody className="flex flex-col flex-grow p-4">
              <h3 className="truncate text-sm font-medium text-gray-900">{item.title}</h3>
              <div className="mt-1 flex items-center text-xs text-gray-500">
                <span>{formatFileSize(item.size)}</span>
                <span className="mx-1.5">•</span>
                <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
              </div>
            </CardBody>
            
            {/* Action buttons */}
            <CardFooter className="flex justify-between items-center bg-gray-50 py-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePushToDisplays(item.id);
                }}
                className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
              >
                Push to Displays
              </button>
              <div className="relative group">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Toggle dropdown menu
                  }}
                  className="rounded-full p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <EllipsisHorizontalIcon className="h-5 w-5" />
                </button>
                {/* Dropdown menu would be here */}
              </div>
            </CardFooter>
          </Card>
        );
      })}
      
      {/* Add content card */}
      <Card
        interactive={true}
        onClick={() => setIsUploadModalOpen(true)}
        className="flex aspect-[4/3] flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50 transition-colors"
      >
        <div className="rounded-full bg-violet-100 p-3">
          <ArrowUpTrayIcon className="h-8 w-8 text-violet-600" />
        </div>
        <div>
          <span className="block text-sm font-medium text-gray-900">Add New Content</span>
          <span className="text-xs text-gray-500">Upload files or create content</span>
        </div>
      </Card>
    </div>
  );
  
  const renderListView = () => (
    <Card>
      <div className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="w-10 pl-6 pr-3 py-3.5">
                {/* Bulk selection checkbox would go here */}
              </th>
              <th
                scope="col"
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:text-violet-700 transition-colors"
                onClick={() => handleSortChange('name')}
              >
                <div className="flex items-center">
                  Name
                  {sortBy === 'name' && (
                    <span className="ml-1 text-violet-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:text-violet-700 transition-colors"
                onClick={() => handleSortChange('type')}
              >
                <div className="flex items-center">
                  Type
                  {sortBy === 'type' && (
                    <span className="ml-1 text-violet-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:text-violet-700 transition-colors"
                onClick={() => handleSortChange('size')}
              >
                <div className="flex items-center">
                  Size
                  {sortBy === 'size' && (
                    <span className="ml-1 text-violet-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:text-violet-700 transition-colors"
                onClick={() => handleSortChange('date')}
              >
                <div className="flex items-center">
                  Last Modified
                  {sortBy === 'date' && (
                    <span className="ml-1 text-violet-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-6">
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
                  className={`${isSelected ? 'bg-violet-50' : 'hover:bg-gray-50'} transition-colors cursor-pointer`}
                  onClick={(e) => handleItemSelect(item.id, e.ctrlKey || e.metaKey)}
                  data-testid="content-item"
                >
                  <td className="w-10 pl-6 pr-3 py-4">
                    <div className={`h-4 w-4 rounded-sm ${isSelected ? 'bg-violet-500' : 'border border-gray-300'}`}>
                      {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 mr-3 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                        {item.thumbnail ? (
                          <img 
                            src={item.thumbnail} 
                            alt={item.title}
                            className="h-10 w-10 object-cover" 
                          />
                        ) : (
                          <IconComponent className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                      <div className="font-medium text-gray-900">{item.title}</div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                      {item.type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {formatFileSize(item.size)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePushToDisplays(item.id);
                        }}
                        className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-violet-600 hover:bg-violet-50 hover:text-violet-700 border border-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1"
                      >
                        Push
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Preview action
                        }}
                        className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1"
                      >
                        Preview
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Delete action
                        }}
                        className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 border border-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
  
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-6 sm:px-8 lg:px-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all your digital signage content in one place
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors"
            data-testid="view-toggle-button"
          >
            {viewMode === 'grid' ? (
              <>
                <ListBulletIcon className="h-5 w-5 mr-2" />
                List View
              </>
            ) : (
              <>
                <Squares2X2Icon className="h-5 w-5 mr-2" />
                Grid View
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center rounded-lg border border-transparent bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors"
            data-testid="upload-button"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Add Content
          </button>
        </div>
      </div>
      
      {/* Search and filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 px-6 py-4 sm:px-8 lg:px-10 bg-gray-50">
        <div className="flex flex-1 items-center max-w-md">
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="block w-full rounded-lg border-gray-300 pl-10 focus:border-violet-500 focus:ring-violet-500 shadow-sm text-sm"
              placeholder="Search content..."
              data-testid="search-input"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-700 mr-2">Filter:</span>
            <select
              value={activeFilter}
              onChange={(e) => handleFilterChange(e.target.value as ContentType | 'all')}
              className="rounded-lg border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-violet-500 focus:ring-violet-500 shadow-sm"
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
          
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-700 mr-2">Sort:</span>
            <select
              value={`${sortBy}-${sortDirection}`}
              onChange={(e) => {
                const [sort, direction] = e.target.value.split('-');
                setSortBy(sort as 'date' | 'name' | 'type' | 'size');
                setSortDirection(direction as 'asc' | 'desc');
              }}
              className="rounded-lg border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-violet-500 focus:ring-violet-500 shadow-sm"
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
        </div>
        
        {selectedItems.size > 0 && (
          <div className="flex items-center space-x-2 bg-violet-50 px-4 py-2 rounded-lg border border-violet-100">
            <span className="text-sm font-medium text-violet-700">{selectedItems.size} selected</span>
            <button
              onClick={handleBulkDelete}
              className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors ml-3"
              data-testid="delete-button"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      
      {/* Main content area */}
      <div className="flex-1 overflow-auto p-6 sm:p-8 lg:p-10 bg-gray-50">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-violet-600"></div>
              <p className="mt-3 text-sm text-gray-600">Loading content...</p>
            </div>
          </div>
        ) : error ? (
          <Card className="bg-red-50 border-red-100">
            <CardBody>
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
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
                      className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <div className="mx-auto h-16 w-16 text-gray-400">
                <DocumentTextIcon className="h-16 w-16" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No content</h3>
              <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                {searchQuery || activeFilter !== 'all'
                  ? 'No content matches your filters. Try different search terms or filters.'
                  : 'Get started by creating or uploading new content.'}
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="inline-flex items-center rounded-lg border border-transparent bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                  Add Content
                </button>
              </div>
            </CardBody>
          </Card>
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