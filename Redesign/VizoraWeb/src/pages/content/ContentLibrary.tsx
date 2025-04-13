import React, { useState, useEffect, useRef, Fragment, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PhotoIcon,
  FilmIcon,
  DocumentIcon,
  MagnifyingGlassIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  FolderIcon,
  FolderOpenIcon,
  WifiIcon,
  SparklesIcon,
  ExclamationCircleIcon,
  FolderPlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
  BellIcon,
} from '@heroicons/react/24/outline';
import { Content, ContentMetadata, UploadProgress, contentService } from '@vizora/common';
import { folderService, Folder } from '@/services/folderService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import ContentUploadModal from '@/components/content/ContentUploadModal';
import { FolderModal } from '@/components/content/FolderModal';
import { MoveContentModal } from '@/components/content/MoveContentModal';
import { DeleteConfirmationModal } from '@/components/content/DeleteConfirmationModal';
import { EditMetadataModal } from '@/components/content/EditMetadataModal';
import { AIEnhancementModal } from '@/components/content/AIEnhancementModal';
import { AISchedulingModal } from '@/components/content/AISchedulingModal';
import { AIAnalyticsModal } from '@/components/content/AIAnalyticsModal';
import { ContentCard } from '@/components/content/ContentCard';
import { toast } from 'react-hot-toast';
import AIContentCard from './AIContentCard';
import { Dialog, Transition, Menu } from '@headlessui/react';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';

// Custom toast helper methods
const customToast = {
  info: (message: string) => toast(message, { 
    icon: 'ℹ️',
    style: {
      background: '#3b82f6',
      color: '#fff',
    }
  })
};

// Extend UploadProgress for internal usage
interface UploadProgressItem extends UploadProgress {
  fileName: string;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error: string | null;
}

// Type definitions for Select component events
interface SelectChangeEvent extends React.ChangeEvent<HTMLSelectElement> {
  target: HTMLSelectElement;
}

// Type definitions for cache and content responses
interface CacheStatusType {
  isLoading: boolean;
  size: number;
  lastUpdated: Date | null;
  itemCount: number;
  error: string | null;
}

interface ContentResponse {
  data: {
    content: Content[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

// Update Folder interface to ensure compatibility
interface FolderWithCount extends Folder {
  itemCount: number;
}

interface BulkUploadResult {
  results: Array<{
    success: boolean;
    content?: Content;
    error?: string;
  }>;
}

// Maps content types to their respective icons
const CONTENT_TYPE_ICONS: Record<string, React.ElementType> = {
  'image': PhotoIcon,
  'video': FilmIcon,
  'document': DocumentIcon,
  'webpage': DocumentIcon,
  'default': DocumentIcon,
};

// Format file size to human-readable format
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Enhanced Empty state component with modern styling
const EmptyState = ({ 
  title = "No content found", 
  message = "Try changing your search filters or adding new content.", 
  icon,
  actionText = "Add Content",
  onAction
}: { 
  title?: string, 
  message?: string, 
  icon?: React.ReactNode,
  actionText?: string,
  onAction?: () => void
}) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gradient-to-b from-gray-50 to-white">
    <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-2xl bg-white shadow-lg mb-6 text-primary-500 transform transition-transform hover:scale-105 hover:rotate-3">
      {icon || <PhotoIcon className="h-10 w-10 text-primary-500" />}
    </div>
    <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
    <p className="mt-2 text-sm text-gray-600 max-w-md leading-relaxed">{message}</p>
    <div className="mt-8">
          <Button
        onClick={onAction} 
        className="bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-lg hover:shadow-xl transform transition-all duration-200 hover:-translate-y-0.5 px-6 py-3 rounded-xl"
      >
        <PlusIcon className="h-5 w-5 mr-2" />
        {actionText}
          </Button>
        </div>
      </div>
);

// Enhanced Content card skeleton with modern styling
const ContentCardSkeleton = () => (
  <div className="border border-gray-100 rounded-xl shadow-sm overflow-hidden h-full bg-white animate-pulse flex flex-col transform transition-all duration-200 hover:shadow-md">
    <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200"></div>
    <div className="p-5 flex-1 flex flex-col">
      <div className="h-5 bg-gradient-to-r from-gray-200 to-gray-100 rounded-lg w-3/4 mb-3"></div>
      <div className="h-4 bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg w-5/6 mb-2"></div>
      <div className="h-4 bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg w-4/6 mb-4"></div>
      <div className="mt-auto flex justify-between items-center">
        <div className="h-7 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full w-24"></div>
        <div className="flex space-x-2">
          <div className="h-8 w-8 bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg"></div>
          <div className="h-8 w-8 bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg"></div>
          <div className="h-8 w-8 bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg"></div>
        </div>
      </div>
    </div>
  </div>
);

// Enhanced folder item component with modern styling
const FolderItem: React.FC<{ 
  folder: Folder | FolderWithCount; 
  isActive: boolean; 
  onClick: () => void;
  depth?: number;
}> = ({ folder, isActive, onClick, depth = 0 }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
      transition-all duration-200 group
      ${isActive 
        ? 'bg-primary-50 text-primary-700 shadow-sm' 
        : 'text-gray-700 hover:bg-gray-50'
      }
    `}
    style={{ paddingLeft: `${(depth * 1.5) + 0.75}rem` }}
  >
    <div className={`
      mr-3 transition-colors duration-200
      ${isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'}
    `}>
      {isActive ? (
        <FolderOpenIcon className="h-5 w-5" />
      ) : (
        <FolderIcon className="h-5 w-5" />
      )}
    </div>
    <span className="truncate flex-1 text-left">{folder.name}</span>
    <span className={`
      ml-3 text-xs rounded-full px-2 py-0.5
      ${isActive 
        ? 'bg-primary-100 text-primary-700' 
        : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
      }
    `}>
      {'itemCount' in folder ? folder.itemCount : 0}
    </span>
  </button>
);

// Enhanced SearchAndFilterBar component with proper TypeScript interfaces
interface SearchAndFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: string;
  onSortChange: (sortBy: string) => void;
  view: 'grid' | 'list';
  onViewChange: (view: 'grid' | 'list') => void;
}

const SearchAndFilterBar: React.FC<SearchAndFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  view,
  onViewChange
}) => {
  // Handler for sort changes
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSortChange(e.target.value);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      {/* Search input */}
      <div className="relative w-full sm:w-72 lg:w-96">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search content..."
          className="block w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5B2E91] focus:border-[#5B2E91] text-sm"
          />
        </div>
        
      {/* Sorting and view options */}
      <div className="flex items-center space-x-4">
        {/* Sort dropdown */}
        <div className="flex items-center space-x-2">
          <label htmlFor="sort-by" className="text-sm font-medium text-gray-600">
            Sort by:
          </label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={handleSortChange}
            className="border border-gray-200 rounded-xl shadow-sm pl-4 pr-8 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#5B2E91] focus:border-[#5B2E91] text-sm"
          >
            <option value="name">Name</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="size">Size</option>
          </select>
        </div>
        
        {/* View toggle */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => onViewChange('grid')}
            className={`p-2 rounded-lg transition-all duration-200 ${
              view === 'grid'
                ? 'bg-white text-[#5B2E91] shadow-sm'
                : 'bg-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Squares2X2Icon className="h-5 w-5" />
          </button>
                <button 
            onClick={() => onViewChange('list')}
            className={`p-2 rounded-lg transition-all duration-200 ${
              view === 'list'
                ? 'bg-white text-[#5B2E91] shadow-sm'
                : 'bg-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ListBulletIcon className="h-5 w-5" />
                </button>
          </div>
          </div>
        </div>
  );
};

// Enhanced action buttons component
const ActionButtons: React.FC<{
  onNewFolder: () => void;
  onUpload: () => void;
  onAIFeatures: () => void;
  selectedCount: number;
}> = ({ onNewFolder, onUpload, onAIFeatures, selectedCount }) => (
  <div className="flex items-center space-x-3">
          <Button
      onClick={onNewFolder}
      className="bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm rounded-lg px-4 py-2 flex items-center space-x-2 transition-all duration-200 hover:shadow hover:scale-105"
    >
      <FolderIcon className="h-5 w-5 text-gray-500" />
      <span>New Folder</span>
          </Button>
    
          <Button
      onClick={onUpload}
      className="bg-[#5B2E91] text-white hover:bg-[#6A4FB6] shadow-sm rounded-lg px-4 py-2 flex items-center space-x-2 transition-all duration-200 hover:shadow hover:scale-105"
          >
      <ArrowUpTrayIcon className="h-5 w-5" />
      <span>Upload</span>
          </Button>
    
    {selectedCount > 0 && (
          <Button
        onClick={onAIFeatures}
        className="bg-gradient-to-r from-[#5B2E91] to-[#6A4FB6] text-white hover:from-[#4A2275] hover:to-[#584099] shadow-sm rounded-lg px-4 py-2 flex items-center space-x-2 transition-all duration-200 hover:shadow hover:scale-105"
      >
        <SparklesIcon className="h-5 w-5" />
        <span>AI Features</span>
          </Button>
    )}
        </div>
);

// Wrapper component to apply the content data error boundary
const ContentLibraryWrapper: React.FC = () => {
  return (
    <ErrorBoundary 
      fallback={
        <div className="p-8 bg-white rounded-xl shadow-lg mx-auto max-w-3xl mt-8">
          <div className="flex items-center justify-center mb-6 text-red-500">
            <ExclamationCircleIcon className="h-12 w-12" />
            </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">
            Something went wrong
          </h2>
          <p className="text-gray-600 text-center mb-6">
            We encountered an error while loading the content library. Please try again or contact support.
          </p>
          <div className="flex justify-center space-x-4">
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Reload Page
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-800 rounded-md hover:bg-gray-50 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      }
    >
      <ContentLibrary />
    </ErrorBoundary>
  );
};

// ContentLibrary component with improved null checks
const ContentLibrary: React.FC = () => {
  const { user } = useAuth();
  const [selectedFolder, setSelectedFolder] = useState<FolderWithCount | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isAIEnhancementModalOpen, setIsAIEnhancementModalOpen] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [contentTypeFilter, setContentTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // Additional modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isDeleteFolderModalOpen, setIsDeleteFolderModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  
  const [isFoldersLoading, setIsFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState<Error | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  
  const [cacheStatus, setCacheStatus] = useState<CacheStatusType>({
    isLoading: true,
    size: 0,
    lastUpdated: null,
    itemCount: 0,
    error: null
  });
  
  const queryClient = useQueryClient();

  useEffect(() => {
    // Handle online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('You are back online');
      refetch(); // Refresh content
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('You are offline. Showing cached content.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Load cache status on mount
    loadCacheStatus();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const {
    data: contentData,
    isLoading: isLoadingContent,
    isError: isErrorContent,
    error: contentError,
    refetch
  } = useQuery<ContentResponse, Error>({
    queryKey: ['content', selectedFolder?.id || 'root', currentPage, contentTypeFilter, searchQuery, sortOrder],
    queryFn: async () => {
      try {
        console.log('Fetching content with params:', {
          folder: selectedFolder?.id || 'root',
          page: currentPage,
          type: contentTypeFilter,
          search: searchQuery,
          sort: sortOrder
        });

        // Build query parameters
        const params: Record<string, any> = {
          page: currentPage,
          limit: 20,
          folder: selectedFolder?.id || null
        };
        
        if (searchQuery) {
          params.search = searchQuery;
        }
        
        if (contentTypeFilter !== 'all') {
          params.type = contentTypeFilter;
        }

        if (sortOrder) {
          params.sort = sortOrder;
        }
        
        // Make the API call with full type safety
        const response = await contentService.getContent(params);
        
        // Validate response structure - handle both success:true format and direct content format
        if (!response) {
          console.error('API returned empty response');
          return { 
            data: { 
              content: [], 
              pagination: { page: currentPage, limit: 20, total: 0, pages: 0 } 
            } 
          };
        }

        // Handle different response formats
        if ('success' in response && Array.isArray(response.content)) {
          // Handle format { success: true, content: [] }
          return {
            data: {
              content: response.content || [],
              pagination: {
                page: currentPage,
                limit: 20,
                total: response.content?.length || 0,
                pages: Math.ceil((response.content?.length || 0) / 20)
              }
            }
          };
        } else if (response.data && Array.isArray(response.data.content)) {
          // Standard expected format with data.content
          if (response.data.content) {
            await contentService.cacheContent(response.data.content);
          }
          return response;
        } else {
          // Fallback for unexpected structure
          console.error('Invalid response structure:', response);
          return {
            data: {
              content: [],
              pagination: {
                page: currentPage,
                limit: 20,
                total: 0,
                pages: 0
              }
            }
          };
        }
      } catch (err) {
        console.error('[ContentLibrary] Error fetching content:', err);
        const error = err as Error;
        
        // If offline, try to serve from cache
        if (!navigator.onLine) {
          try {
            const cachedContent = await contentService.getCachedContent() || [];
            console.log(`[ContentLibrary] Serving ${cachedContent.length} items from cache in offline mode`);
            
            if (cachedContent && cachedContent.length > 0) {
              return {
                data: {
                  content: cachedContent,
                  pagination: {
                    page: 1,
                    limit: cachedContent.length,
                    total: cachedContent.length,
                    pages: 1
                  }
                }
              } as ContentResponse;
            }
          } catch (cacheError) {
            console.error('[ContentLibrary] Failed to load cache:', cacheError);
          }
        }
        
        // If all else fails, return empty response instead of undefined
        return {
          data: {
            content: [],
            pagination: {
              page: currentPage,
              limit: 20,
              total: 0,
              pages: 0
            }
          }
        } as ContentResponse;
      }
    },
    // Enable network-mode aware refetching
    refetchOnWindowFocus: isOnline,
    // If offline, serve from cache without refetching
    staleTime: !isOnline ? Infinity : 5 * 60 * 1000, // 5 minutes or Infinity if offline
    // Add retry configuration
    retry: (failureCount, error) => {
      // Only retry network errors, not 4xx responses
      if (error instanceof Error && error.message.includes('Network Error')) {
        return failureCount < 3;
      }
      return false;
    },
    // Add error boundary
    useErrorBoundary: (error) => {
      // Only trigger error boundary for severe errors
      return error instanceof Error && error.message.includes('FATAL:');
    }
  });
  
  useEffect(() => {
    if (contentData?.data?.pagination?.total) {
      setTotalItems(contentData.data.pagination.total);
    }
  }, [contentData]);
  
  // Fetch folders
  useEffect(() => {
    const loadFolders = async () => {
      try {
        setIsFoldersLoading(true);
        const foldersData = await folderService.getAllFolders();
        setFolders(foldersData);
        setFoldersError(null);
      } catch (error) {
        console.error('Error loading folders:', error);
        setFoldersError(error instanceof Error ? error : new Error('Failed to load folders'));
      } finally {
        setIsFoldersLoading(false);
      }
    };
    
    loadFolders();
  }, []);
  
  const loadCacheStatus = async () => {
    try {
      setCacheStatus(prev => ({ ...prev, isLoading: true, error: null }));
      
      let cachedContent = [];
      try {
        // Safely call getCachedContent with proper error handling
        cachedContent = await contentService.getCachedContent() || [];
      } catch (cacheError) {
        console.error('[ContentLibrary] Failed to load cache:', cacheError);
        // Continue with empty array
      }
      
      const lastCacheUpdate = localStorage.getItem('lastCacheUpdate');
      
      setCacheStatus({
        isLoading: false,
        size: estimateCacheSize(cachedContent),
        lastUpdated: lastCacheUpdate ? new Date(lastCacheUpdate) : null,
        itemCount: cachedContent?.length || 0,
        error: null
      });
    } catch (error) {
      console.error('[ContentLibrary] Failed to load cache status:', error);
      setCacheStatus({
        isLoading: false,
        size: 0,
        lastUpdated: null,
        itemCount: 0,
        error: error instanceof Error ? error.message : 'Failed to load cache status'
      });
    }
  };

  const clearCache = async () => {
    try {
      setCacheStatus(prev => ({ ...prev, isLoading: true }));
      
      // Clear content cache
      await contentService.clearContentCache();
      
      toast.success('Content cache cleared successfully');
      loadCacheStatus(); // Refresh cache status
    } catch (error) {
      console.error('Error clearing cache:', error);
      setCacheStatus(prev => ({ 
        ...prev, 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to clear cache'
      }));
      toast.error('Failed to clear content cache');
    }
  };

  const updateCache = async () => {
    try {
      setCacheStatus(prev => ({ ...prev, isLoading: true }));
      
      // This would fetch fresh content and update the cache
      const freshContent = await contentService.refreshContentCache();
      
      toast.success('Content cache updated successfully');
      loadCacheStatus(); // Refresh cache status
    } catch (error) {
      console.error('Error updating cache:', error);
      setCacheStatus(prev => ({ 
        ...prev, 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update cache'
      }));
      toast.error('Failed to update content cache');
    }
  };

  const estimateCacheSize = (content: Content[] | null): number => {
    if (!content || content.length === 0) return 0;
    
    // Rough estimate - in a real app you'd use a more accurate method
    // This assumes ~2KB per content item plus any thumbnail/preview data
    const baseSize = content.length * 2; // 2KB per item
    
    // Add estimated size for thumbnails/previews
    const mediaItems = content.filter(item => 
      item.type === 'image' || item.type === 'video'
    );
    const mediaSize = mediaItems.length * 50; // Assume ~50KB per thumbnail
    
    return baseSize + mediaSize;
  };

  const createFolderMutation = useMutation(
    (folderData: { name: string; description?: string }) => folderService.createFolder(folderData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['folders']);
        toast.success('Folder created successfully');
        setIsCreateFolderModalOpen(false);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to create folder');
      }
    }
  );
  
  const updateFolderMutation = useMutation(
    ({ id, data }: { id: string; data: Partial<Folder> }) => folderService.updateFolder(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['folders']);
        toast.success('Folder updated successfully');
        setIsCreateFolderModalOpen(false);
        setEditingFolder(null);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to update folder');
      }
    }
  );
  
  const deleteFolderMutation = useMutation(
    (folderId: string) => folderService.deleteFolder(folderId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['folders']);
        toast.success('Folder deleted successfully');
        setIsDeleteFolderModalOpen(false);
        setSelectedFolder(null);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to delete folder');
      }
    }
  );
  
  const deleteMutation = useMutation(
    (contentId: string) => contentService.deleteContent(contentId),
    {
      onSuccess: () => {
        // Invalidate the content query to refetch
        queryClient.invalidateQueries(['content']);
        toast.success('Content deleted successfully');
        setIsDeleteModalOpen(false);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to delete content');
      }
    }
  );
  
  const updateMetadataMutation = useMutation(
    ({ id, metadata }: { id: string; metadata: ContentMetadata }) => 
      contentService.updateContentMetadata(id, metadata),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['content']);
        toast.success('Content updated successfully');
        setIsEditModalOpen(false);
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to update content');
      }
    }
  );
  
  const moveContentMutation = useMutation(
    (params: { contentIds: string[], targetFolder: string | 'root' }) => 
      contentService.moveMultipleContent(params.contentIds, params.targetFolder),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['content']);
        toast.success('Content moved successfully');
        setIsMoveModalOpen(false);
        setSelectedItems(new Set());
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to move content');
      }
    }
  );
  
  // Content upload handlers
  const handleUploadProgress = useCallback((progress: UploadProgress) => {
    setUploadProgress(prev => {
      const exists = prev.findIndex(p => p.fileName === progress.fileName);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = {...updated[exists], ...progress, fileName: updated[exists].fileName};
        return updated;
      }
      return [...prev, {...progress, fileName: 'Unknown file', status: 'uploading', error: null} as UploadProgressItem];
    });
  }, []);

  const handleApplyAIEnhancements = async (content: Content, updates: Partial<ContentMetadata>) => {
    try {
      setIsAIProcessing(true);
      // Update content metadata with AI-suggested changes
      await contentService.updateContentMetadata(content.id, updates);
      toast.success('AI enhancements applied successfully');
      // Refresh content list
      refetch();
      setIsAIEnhancementModalOpen(false);
    } catch (error) {
      console.error('Error applying AI enhancements:', error);
      toast.error('Failed to apply AI enhancements');
    } finally {
      setIsAIProcessing(false);
    }
  };

  // Handle file uploads
  const uploadFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    
    try {
      // Clear previous upload progress
      setUploadProgress([]);
      
      // Create progress trackers for each file
      const progressTrackers: UploadProgressItem[] = files.map(file => ({
        fileName: file.name,
        progress: 0,
        status: 'pending' as const,
        error: null
      }));
      
      setUploadProgress(progressTrackers);
      
      // Process each file sequentially
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Update status to uploading
        setUploadProgress(prev => {
          const newProgress = [...prev];
          newProgress[i] = { ...newProgress[i], status: 'uploading' };
          return newProgress;
        });
        
        // Track upload progress
        const onProgress = (progress: number) => {
          setUploadProgress(prev => {
            const newProgress = [...prev];
            newProgress[i] = { ...newProgress[i], progress };
            return newProgress;
          });
        };
        
        try {
          // Create metadata from file
          const metadata: ContentMetadata = {
            title: file.name,
            description: '',
            tags: [],
            folder: selectedFolder?.id
          };
          
          // Upload the file
          await contentService.uploadContentFile(file, metadata, (data) => onProgress(data.progress));
          
          // Update status to complete
          setUploadProgress(prev => {
            const newProgress = [...prev];
            newProgress[i] = { ...newProgress[i], status: 'complete', progress: 100 };
            return newProgress;
          });
        } catch (error) {
          // Update status to error
          setUploadProgress(prev => {
            const newProgress = [...prev];
            newProgress[i] = { 
              ...newProgress[i], 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed'
            };
            return newProgress;
          });
        }
      }
      
      // Refresh content list after all uploads
      refetch();
      
      // Show success message
      const successCount = uploadProgress.filter(p => p.status === 'complete').length;
      if (successCount === files.length) {
        toast.success(`All ${files.length} files uploaded successfully`);
      } else if (successCount > 0) {
        toast.success(`${successCount} of ${files.length} files uploaded successfully`);
    } else {
        toast.error('Failed to upload files');
      }
      
      // Don't close modal immediately to allow user to see progress
      setTimeout(() => {
        if (uploadProgress.every(p => p.status === 'complete')) {
          setIsUploadModalOpen(false);
        }
      }, 1000);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    }
  };

  const handleCreateFolder = async (folderName: string) => {
    try {
      await folderService.createFolder({ 
        name: folderName,
        description: ''
      });
      setIsCreateFolderModalOpen(false);
      queryClient.invalidateQueries(['folders']);
      toast.success(`Folder "${folderName}" created`);
    } catch (error) {
      console.error('Create folder error:', error);
      toast.error('Failed to create folder');
    }
  };

  // Content action handlers
  const handlePreviewContent = (content: Content) => {
    setSelectedContent(content);
    // Implement preview functionality here
    console.log('Preview content:', content);
    customToast.info(`Previewing ${content.title}`);
    // In a real app, you'd show a preview modal or navigate to a detail page
  };

  const handleRenameContent = (content: Content) => {
    setSelectedContent(content);
    // In a real implementation, you might open a modal for renaming
    console.log('Rename content:', content);
    customToast.info(`Renaming ${content.title}`);
    // Example implementation:
    // setIsRenameModalOpen(true);
  };

  const handleDeleteContent = (content: Content) => {
    setSelectedContent(content);
    // In a real implementation, you'd show a confirmation dialog
    console.log('Delete content:', content);
    
    if (confirm(`Are you sure you want to delete "${content.title}"?`)) {
      // Call the API to delete the content
      contentService.deleteContent(content.id)
        .then(() => {
          toast.success(`Deleted ${content.title}`);
          refetch(); // Refresh the content list
        })
        .catch(error => {
          console.error('Error deleting content:', error);
          toast.error(`Failed to delete ${content.title}`);
        });
    }
  };

  const handleEnhanceContent = (content: Content) => {
    setSelectedContent(content);
    setIsAIEnhancementModalOpen(true);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Folder selection handler
  const handleFolderSelect = (folder: FolderWithCount | null) => {
    setSelectedFolder(folder);
    setCurrentPage(1); // Reset pagination when changing folders
  };

  // Modal handlers
  const handleCloseAddModal = () => setIsAddModalOpen(false);
  
  const handleCloseUploadModal = () => {
    // Only close if no uploads are in progress
    if (!uploadProgress.some(p => p.progress < 100)) {
      setIsUploadModalOpen(false);
      // Clear progress after closing
      setUploadProgress([]);
    }
  };
  
  const handleCloseCreateFolderModal = () => setIsCreateFolderModalOpen(false);
  
  const handleCloseAIEnhancementModal = () => {
    setIsAIEnhancementModalOpen(false);
    setSelectedContent(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main content area */}
      <div className="max-w-[95vw] mx-auto">
        {/* Header with user profile - REMOVING DUPLICATE AVATAR */}
        <header className="bg-white shadow-sm px-6 py-4 mb-6 rounded-xl flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Content Library</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#5B2E91] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#6A4FB6] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5B2E91] hover:scale-105 transition-all duration-200 flex items-center space-x-2"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Add Content</span>
            </button>
            <button className="text-gray-500 hover:text-gray-700 relative">
              <BellIcon className="h-6 w-6" />
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
            </button>
            {/* Removed duplicate avatar - we use the global one instead */}
          </div>
        </header>

        <div className="flex gap-4">
          {/* Folder sidebar - IMPROVED STYLING */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-200">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wider">FOLDERS</h3>
                <button 
            onClick={() => setIsCreateFolderModalOpen(true)}
                  className="text-[#5B2E91] hover:text-[#6A4FB6] hover:scale-110 transition-transform duration-200"
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
        </div>
              
              <div className="p-3">
                <button
                  onClick={() => handleFolderSelect(null)}
                  className={`flex items-center w-full px-4 py-3 text-sm rounded-xl text-left mb-2 transition-all duration-200 ${
                    !selectedFolder ? 'bg-[#5B2E91] bg-opacity-10 text-[#5B2E91] font-medium shadow-sm' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FolderIcon className={`mr-3 h-5 w-5 ${!selectedFolder ? 'text-[#5B2E91]' : 'text-gray-400'}`} />
                  <span>All Content</span>
                </button>
                
                {isFoldersLoading ? (
                  <div className="py-3 px-3 flex justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#5B2E91]"></div>
            </div>
                ) : foldersError ? (
                  <div className="py-3 px-3 text-sm text-red-500">Failed to load folders</div>
                ) : (
                  folders.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => handleFolderSelect(folder as FolderWithCount)}
                      className={`flex items-center w-full px-4 py-3 text-sm rounded-xl text-left mb-2 transition-all duration-200 ${
                        selectedFolder?.id === folder.id ? 'bg-[#5B2E91] bg-opacity-10 text-[#5B2E91] font-medium shadow-sm' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <FolderIcon className={`mr-3 h-5 w-5 ${selectedFolder?.id === folder.id ? 'text-[#5B2E91]' : 'text-gray-400'}`} />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))
          )}
        </div>
            </div>
      </div>
      
          {/* Content area - IMPROVED STYLING */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-lg p-5 mb-6 transition-all duration-200">
              <SearchAndFilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortBy={sortBy}
                onSortChange={setSortBy}
                view={viewType}
                onViewChange={setViewType}
              />
        </div>
            
            <ErrorBoundary 
              fallback={<div className="mt-8 text-center text-red-500">Failed to load content</div>}
            >
              {contentError ? (
                <div className="mt-8 text-center text-red-500">Error loading content: {contentError.message}</div>
              ) : isLoadingContent ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B2E91]"></div>
            </div>
              ) : (
                <>
                  {contentData?.data?.content && contentData.data.content.length > 0 ? (
                    <div className={`${viewType === 'grid' 
                      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6' 
                      : 'space-y-4'}`}
                    >
                      {contentData.data.content.map((content) => (
                        <div key={content.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden transform hover:scale-[1.02]">
                          <ContentCard
                            content={content}
                            onSelect={() => handlePreviewContent(content)}
                            onEdit={() => handleRenameContent(content)}
                            onDelete={() => handleDeleteContent(content)}
                            onEnhance={() => handleEnhanceContent(content)}
                          />
            </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl shadow-lg p-12 flex flex-col items-center justify-center text-center transition-all duration-200">
                      <div className="bg-gray-50 p-6 rounded-full mb-6">
                        <DocumentIcon className="h-16 w-16 text-gray-400" />
                      </div>
                      <h3 className="text-2xl font-semibold text-gray-900 mb-3">No content yet</h3>
                      <p className="text-gray-500 mb-8 max-w-md">Get started by uploading your first file or creating a folder to organize your content</p>
                      <div className="flex space-x-4">
                        <button
                          onClick={() => setIsUploadModalOpen(true)}
                          className="bg-[#5B2E91] text-white px-6 py-3 rounded-xl hover:bg-[#6A4FB6] hover:scale-105 transition-all duration-200 flex items-center shadow-md"
                        >
                          <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
                          Upload Files
                        </button>
                        <button
                          onClick={() => setIsCreateFolderModalOpen(true)}
                          className="bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-50 hover:scale-105 transition-all duration-200 flex items-center shadow-sm"
                        >
                          <FolderPlusIcon className="h-5 w-5 mr-2 text-gray-500" />
                          Create Folder
                        </button>
          </div>
        </div>
      )}
                </>
              )}
            </ErrorBoundary>
            
            {/* Pagination Controls - IMPROVED STYLING */}
            {contentData?.data.pagination && contentData.data.pagination.pages > 1 && (
              <div className="flex justify-center mt-10 mb-6">
                <nav className="flex items-center bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-200">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-4 py-3 ${
                      currentPage === 1 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  
                  {/* Page number buttons */}
                  {Array.from({ length: Math.min(5, contentData.data.pagination.pages) }).map((_, i) => {
                    // Calculate page number to display
                    let pageNum = i + 1;
                    if (contentData.data.pagination.pages > 5) {
                      if (currentPage > 3 && currentPage < contentData.data.pagination.pages - 1) {
                        pageNum = currentPage - 2 + i;
                      } else if (currentPage >= contentData.data.pagination.pages - 1) {
                        pageNum = contentData.data.pagination.pages - 4 + i;
                      }
                    }
                    
                    return pageNum <= contentData.data.pagination.pages ? (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`relative inline-flex items-center px-4 py-3 text-sm ${
                          currentPage === pageNum
                            ? 'bg-[#5B2E91] bg-opacity-10 text-[#5B2E91] font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ) : null;
                  })}
                      
                        <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === contentData.data.pagination.pages}
                    className={`relative inline-flex items-center px-4 py-3 ${
                      currentPage === contentData.data.pagination.pages
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRightIcon className="h-5 w-5" />
                        </button>
                </nav>
                      </div>
            )}
          </div>
          </div>
        </div>
        
      {/* Modals */}
      {isAddModalOpen && (
        <AddContentModal
          isOpen={isAddModalOpen}
          onClose={handleCloseAddModal}
          onUpload={() => {
            setIsAddModalOpen(false);
            setIsUploadModalOpen(true);
          }}
          onCreateFolder={() => {
            setIsAddModalOpen(false);
            setIsCreateFolderModalOpen(true);
          }}
          onAIEnhance={() => {
            setIsAddModalOpen(false);
            setIsAIEnhancementModalOpen(true);
          }}
        />
      )}
      
      {isUploadModalOpen && (
        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={handleCloseUploadModal}
          onUpload={uploadFiles}
          uploadProgress={uploadProgress}
        />
      )}
      
      {isCreateFolderModalOpen && (
        <CreateFolderModal
          isOpen={isCreateFolderModalOpen}
          onClose={handleCloseCreateFolderModal}
          onCreateFolder={handleCreateFolder}
        />
      )}
      
      {isAIEnhancementModalOpen && selectedContent && (
        <AIEnhancementModal
          isOpen={isAIEnhancementModalOpen}
          onClose={handleCloseAIEnhancementModal}
          onApply={handleApplyAIEnhancements}
          content={selectedContent}
          isProcessing={isAIProcessing}
        />
      )}
                </div>
  );
};

// Add the modal components
interface AddContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: () => void;
  onCreateFolder: () => void;
  onAIEnhance: () => void;
}

const AddContentModal: React.FC<AddContentModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  onCreateFolder,
  onAIEnhance
}) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-gray-900 mb-4"
                >
                  Add Content
                </Dialog.Title>
                
                <div className="mt-4 space-y-3">
                  <button
                    onClick={onUpload}
                    className="w-full flex items-center justify-between p-4 text-left rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#5B2E91]"
                  >
                    <div className="flex items-center">
                      <div className="bg-[#5B2E91] bg-opacity-10 p-2.5 rounded-lg mr-4">
                        <ArrowUpTrayIcon className="h-5 w-5 text-[#5B2E91]" />
                </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Upload Files</h4>
                        <p className="text-xs text-gray-500">Upload images, videos, or documents</p>
              </div>
            </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  </button>
                  
                  <button
                    onClick={onCreateFolder}
                    className="w-full flex items-center justify-between p-4 text-left rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#5B2E91]"
                  >
                <div className="flex items-center">
                      <div className="bg-[#5B2E91] bg-opacity-10 p-2.5 rounded-lg mr-4">
                        <FolderPlusIcon className="h-5 w-5 text-[#5B2E91]" />
                </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Create Folder</h4>
                        <p className="text-xs text-gray-500">Organize your content with folders</p>
                </div>
              </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  </button>
                  
                  <button
                    onClick={onAIEnhance}
                    className="w-full flex items-center justify-between p-4 text-left rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#5B2E91]"
                  >
                    <div className="flex items-center">
                      <div className="bg-[#5B2E91] bg-opacity-10 p-2.5 rounded-lg mr-4">
                        <SparklesIcon className="h-5 w-5 text-[#5B2E91]" />
                </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">AI Generated Content</h4>
                        <p className="text-xs text-gray-500">Create content with AI assistance</p>
                </div>
              </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  </button>
              </div>
              
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-xl border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B2E91] focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
            </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => void;
  uploadProgress: UploadProgressItem[];
}

const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  uploadProgress
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      setSelectedFiles(fileArray);
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileArray = Array.from(e.dataTransfer.files);
      setSelectedFiles(fileArray);
    }
  };
  
  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
    }
  };
  
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-gray-900"
                >
                  Upload Files
                </Dialog.Title>
                
                <div className="mt-4">
                  {/* Drag & Drop area */}
                  <div
                    className={`border-2 ${
                      isDragging ? 'border-[#5B2E91] bg-[#5B2E91]/5' : 'border-dashed border-gray-300'
                    } rounded-xl p-8 text-center transition-colors duration-200`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      multiple
                    />
                    
                    <div className="mx-auto h-14 w-14 flex items-center justify-center rounded-full bg-[#5B2E91]/10 mb-4">
                      <ArrowUpTrayIcon className="h-7 w-7 text-[#5B2E91]" />
                    </div>
                    <p className="text-sm text-gray-600 font-medium">
                      {isDragging ? (
                        "Drop files here"
                      ) : (
                        <>
                          Drag and drop files here, or{" "}
                          <button
                            type="button"
                            className="text-[#5B2E91] font-semibold hover:text-[#6A4FB6] focus:outline-none"
                            onClick={triggerFileInput}
                          >
                            browse
                          </button>
                  </>
                )}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Supports images, videos, and documents (Max: 100MB)
                    </p>
              </div>
                  
                  {/* Selected files */}
                  {selectedFiles.length > 0 && (
                    <div className="mt-5">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Selected Files ({selectedFiles.length})
                      </h4>
                      <ul className="border rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {selectedFiles.map((file, index) => (
                          <li key={index} className="p-3 flex justify-between items-center text-sm">
                            <div className="flex items-center">
                              <DocumentIcon className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">{file.name}</span>
            </div>
                            <span className="text-gray-500 text-xs">
                              {(file.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Upload progress */}
                  {uploadProgress.length > 0 && (
                    <div className="mt-5">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Upload Progress
                      </h4>
                      <ul className="border rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {uploadProgress.map((progress, index) => (
                          <li key={index} className="p-3">
                            <div className="flex justify-between items-center mb-1">
                              <div className="truncate max-w-[240px] text-sm">{progress.fileName}</div>
                              <div className="text-xs font-medium">
                                {progress.status === 'complete' 
                                  ? <span className="text-green-600">Completed</span>
                                  : progress.status === 'error'
                                    ? <span className="text-red-600">Failed</span>
                                    : <span>{progress.progress}%</span>
                                }
            </div>
          </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  progress.status === 'error' 
                                    ? 'bg-red-500' 
                                    : progress.status === 'complete' 
                                      ? 'bg-green-500' 
                                      : 'bg-[#5B2E91]'
                                }`}
                                style={{ width: `${progress.progress}%` }}
                              ></div>
        </div>
                            {progress.status === 'error' && progress.error && (
                              <div className="mt-1 text-xs text-red-500">{progress.error}</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
      </div>
      
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#5B2E91] focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={selectedFiles.length === 0 || uploadProgress.length > 0}
                    className={`inline-flex justify-center rounded-xl border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#5B2E91] focus:ring-offset-2 ${
                      selectedFiles.length === 0 || uploadProgress.length > 0
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-[#5B2E91] hover:bg-[#6A4FB6]'
                    }`}
                  >
                    {uploadProgress.length > 0 ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
                      </span>
                    ) : (
                      'Upload'
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (folderName: string) => void;
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ 
  isOpen,
  onClose,
  onCreateFolder
}) => {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!folderName.trim()) {
      setError('Please enter a folder name');
      return;
    }
    
    onCreateFolder(folderName);
    setFolderName('');
    setError('');
  };
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
          <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-gray-900"
                >
                  Create New Folder
                    </Dialog.Title>
                
                <form onSubmit={handleSubmit} className="mt-5">
                  <div className="mb-4">
                    <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 mb-1">
                      Folder Name
                    </label>
                    <input
                      type="text"
                      id="folderName"
                      name="folderName"
                      value={folderName}
                      onChange={(e) => {
                        setFolderName(e.target.value);
                        if (error) setError('');
                      }}
                      className="mt-1 block w-full rounded-xl border-gray-200 shadow-sm focus:border-[#5B2E91] focus:ring-[#5B2E91] sm:text-sm px-4 py-3"
                      placeholder="Enter folder name"
                      autoComplete="off"
                    />
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                    </div>
                  
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setFolderName('');
                        setError('');
                      }}
                      className="inline-flex justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#5B2E91] focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex justify-center rounded-xl border border-transparent bg-[#5B2E91] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#6A4FB6] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#5B2E91] focus:ring-offset-2"
                    >
                      Create
                    </button>
                  </div>
                </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};

export default ContentLibraryWrapper; 