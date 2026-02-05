'use client';

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { apiClient } from '@/lib/api';
import { Content, Display, Playlist, ContentFolder } from '@/lib/types';
import FolderTree from '@/components/FolderTree';
import FolderBreadcrumb from '@/components/FolderBreadcrumb';
import Modal from '@/components/Modal';
import PreviewModal from '@/components/PreviewModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import SearchFilter from '@/components/SearchFilter';
import ContentTagger, { ContentTag } from '@/components/ContentTagger';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useRealtimeEvents, useOptimisticState, useErrorRecovery } from '@/lib/hooks';
import { contentUploadSchema, validateForm } from '@/lib/validation';
import { Icon } from '@/theme/icons';
import type { IconName } from '@/theme/icons';

export default function ContentPage() {
  const toast = useToast();
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [isAddToPlaylistModalOpen, setIsAddToPlaylistModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [devices, setDevices] = useState<Display[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [pushDuration, setPushDuration] = useState(30);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    type: 'image' as 'image' | 'video' | 'pdf' | 'url',
    url: '',
    file: null as File | null,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | '7days' | '30days' | '90days'>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [uploadQueue, setUploadQueue] = useState<Array<{
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    error?: string;
  }>>([]);
  const [tags] = useState<ContentTag[]>([
    { id: '1', name: 'Marketing', color: 'blue' },
    { id: '2', name: 'Seasonal', color: 'green' },
    { id: '3', name: 'Featured', color: 'red' },
    { id: '4', name: 'Archive', color: 'gray' },
  ]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'offline'>('offline');

  // Folder state
  const [folders, setFolders] = useState<ContentFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isMoveToFolderModalOpen, setIsMoveToFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

  // Real-time event handling
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isConnected: _isConnected, isOffline: _isOffline } = useRealtimeEvents({
    enabled: true,
    onConnectionChange: (connected) => {
      setRealtimeStatus(connected ? 'connected' : 'offline');
      if (connected) {
        toast.info('Real-time sync enabled');
      }
    },
  });

  // Optimistic state management
  const {
    updateOptimistic,
    commitOptimistic,
    rollbackOptimistic,
    getPendingCount,
  } = useOptimisticState<Content[]>(content);

  // Error recovery
  const { retry, recordError } = useErrorRecovery({
    onError: (errorInfo) => {
      if (errorInfo.severity === 'critical') {
        toast.error(`Error: ${errorInfo.error}`);
      }
    },
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 1000,
    },
  });

  useEffect(() => {
    loadContent();
    loadDevices();
    loadPlaylists();
    loadFolders();
  }, []);

  // Reload content when folder selection changes
  useEffect(() => {
    loadContent();
  }, [selectedFolderId]);

  // ESC key handler for preview modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPreviewModalOpen) {
        setIsPreviewModalOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isPreviewModalOpen]);

  const loadContent = async () => {
    try {
      setLoading(true);
      let response;
      if (selectedFolderId) {
        response = await apiClient.getFolderContent(selectedFolderId);
      } else {
        response = await apiClient.getContent();
      }
      setContent(response.data || response || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const folderList = await apiClient.getFolders({ format: 'tree' });
      setFolders(folderList || []);
    } catch (error: any) {
      console.error('[ContentPage] Failed to load folders:', error);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Folder name is required');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.createFolder({
        name: newFolderName.trim(),
        parentId: newFolderParentId || undefined,
      });
      toast.success('Folder created successfully');
      setIsCreateFolderModalOpen(false);
      setNewFolderName('');
      setNewFolderParentId(null);
      loadFolders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create folder');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveToFolder = async () => {
    if (selectedItems.size === 0 || !targetFolderId) return;

    try {
      setActionLoading(true);
      await apiClient.moveContentToFolder(targetFolderId, Array.from(selectedItems));
      toast.success(`${selectedItems.size} item(s) moved to folder`);
      setIsMoveToFolderModalOpen(false);
      setSelectedItems(new Set());
      setTargetFolderId(null);
      loadContent();
      loadFolders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to move content');
    } finally {
      setActionLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const response = await apiClient.getDisplays();
      setDevices(response.data || response || []);
    } catch (error: any) {
      console.error('[ContentPage] Failed to load devices:', error);
      // Non-critical: devices are optional for content listing
      if (process.env.NODE_ENV === 'development') {
        toast.warning('Could not load devices list');
      }
    }
  };

  const loadPlaylists = async () => {
    try {
      const response = await apiClient.getPlaylists();
      setPlaylists(response.data || response || []);
    } catch (error: any) {
      console.error('[ContentPage] Failed to load playlists:', error);
      // Non-critical: playlists are optional for content listing
      if (process.env.NODE_ENV === 'development') {
        toast.warning('Could not load playlists list');
      }
    }
  };

  const handleBulkUpload = async () => {
    if (uploadQueue.length === 0) {
      toast.error('No files in queue');
      return;
    }

    setActionLoading(true);
    
    // Upload files sequentially
    for (let i = 0; i < uploadQueue.length; i++) {
      const item = uploadQueue[i];
      
      // Update status to uploading
      setUploadQueue(prev => prev.map((q, idx) => 
        idx === i ? { ...q, status: 'uploading' as const } : q
      ));

      try {
        const title = item.file.name.replace(/\.[^/.]+$/, '');

        // Pass file directly to API - it will handle multipart upload
        const newContent = await apiClient.createContent({
          title,
          type: uploadForm.type,
          file: item.file, // Pass file object instead of blob URL
        });

        // Generate thumbnail for images
        if (uploadForm.type === 'image' && newContent.id) {
          try {
            await apiClient.post(`/content/${newContent.id}/thumbnail`);
          } catch (thumbnailError) {
            console.warn('Thumbnail generation failed:', thumbnailError);
          }
        }

        // Mark as success
        setUploadQueue(prev => prev.map((q, idx) => 
          idx === i ? { ...q, status: 'success' as const, progress: 100 } : q
        ));
      } catch (error: any) {
        // Mark as error
        setUploadQueue(prev => prev.map((q, idx) => 
          idx === i ? { ...q, status: 'error' as const, error: error.message } : q
        ));
      }
    }

    setActionLoading(false);
    
    const successCount = uploadQueue.filter(q => q.status === 'success').length;
    const errorCount = uploadQueue.filter(q => q.status === 'error').length;
    
    if (errorCount === 0) {
      toast.success(`${successCount} file(s) uploaded successfully`);
      setIsUploadModalOpen(false);
      setUploadQueue([]);
      setUploadForm({ title: '', type: 'image', url: '', file: null });
      loadContent();
    } else {
      toast.error(`${errorCount} file(s) failed to upload`);
    }
  };

  const handleUpload = async () => {
    // If queue has files, use bulk upload
    if (uploadQueue.length > 0) {
      return handleBulkUpload();
    }

    // Otherwise, single file upload
    const errors = validateForm(contentUploadSchema, uploadForm);
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    try {
      setActionLoading(true);
      // Pass file if available, otherwise pass the form as-is (for URL type)
      const contentData = uploadForm.file
        ? { title: uploadForm.title, type: uploadForm.type, file: uploadForm.file }
        : { title: uploadForm.title, type: uploadForm.type, url: uploadForm.url };

      const newContent = await apiClient.createContent(contentData);
      
      // Generate thumbnail for images
      if (uploadForm.type === 'image' && newContent.id) {
        try {
          await apiClient.post(`/content/${newContent.id}/thumbnail`);
        } catch (thumbnailError) {
          // Don't fail upload if thumbnail generation fails
          console.warn('Thumbnail generation failed:', thumbnailError);
        }
      }
      
      toast.success('Content uploaded successfully');
      setIsUploadModalOpen(false);
      setUploadForm({ title: '', type: 'image', url: '', file: null });
      setFormErrors({});
      loadContent();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload content');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreview = (item: Content) => {
    setSelectedContent(item);
    setIsPreviewModalOpen(true);
  };

  const handleEdit = (item: Content) => {
    setSelectedContent(item);
    setUploadForm({
      title: item.title,
      type: item.type as 'image' | 'video' | 'pdf' | 'url',
      url: item.url || '',
      file: null,
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedContent) return;

    // Validate form
    const errors = validateForm(contentUploadSchema, uploadForm);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error('Please fix the errors before saving');
      return;
    }

    try {
      setActionLoading(true);
      const updateId = `edit_${selectedContent.id}_${Date.now()}`;

      // Apply optimistic update
      updateOptimistic(updateId, (prev) =>
        prev.map((item) =>
          item.id === selectedContent.id
            ? { ...item, title: uploadForm.title }
            : item
        )
      );

      // Send update with retry
      await retry(
        updateId,
        async () => {
          await apiClient.updateContent(selectedContent.id, {
            title: uploadForm.title,
          });
          return true;
        },
        () => {
          // Commit optimistic update
          commitOptimistic(updateId);
          toast.success('Content updated successfully');
          setIsEditModalOpen(false);
        },
        (error) => {
          // Rollback on failure
          rollbackOptimistic(updateId);
          toast.error('Failed to update content: ' + (error.message || 'Unknown error'));
          recordError(updateId, error, 'warning');
        }
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to update content');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (item: Content) => {
    setSelectedContent(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedContent) return;

    try {
      setActionLoading(true);
      const deleteId = `delete_${selectedContent.id}_${Date.now()}`;
      const deletedContentId = selectedContent.id;

      // Apply optimistic update (remove from list immediately)
      updateOptimistic(deleteId, (prev) =>
        prev.filter((item) => item.id !== deletedContentId)
      );

      // Send deletion with retry
      await retry(
        deleteId,
        async () => {
          await apiClient.deleteContent(deletedContentId);
          return true;
        },
        () => {
          // Commit optimistic deletion
          commitOptimistic(deleteId);
          toast.success('Content deleted successfully');
          setIsDeleteModalOpen(false);
          setSelectedContent(null);
        },
        (error) => {
          // Rollback on failure - reload list
          rollbackOptimistic(deleteId);
          toast.error('Failed to delete content: ' + (error.message || 'Unknown error'));
          recordError(deleteId, error, 'warning');
          loadContent(); // Reload to sync state
        }
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete content');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePushToDevice = (item: Content) => {
    setSelectedContent(item);
    setSelectedDevices([]);
    setPushDuration(30);
    setIsPushModalOpen(true);
  };

  const confirmPush = async () => {
    if (!selectedContent || selectedDevices.length === 0) return;

    try {
      setActionLoading(true);
      // Push content directly to each selected device (temporary override)
      await Promise.all(
        selectedDevices.map((deviceId) =>
          apiClient.pushContentToDisplay(deviceId, selectedContent.id, pushDuration)
        )
      );

      toast.success(`Content pushed to ${selectedDevices.length} device(s) for ${pushDuration}s`);
      setIsPushModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to push content');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddToPlaylist = (item: Content) => {
    setSelectedContent(item);
    setSelectedPlaylist('');
    setIsAddToPlaylistModalOpen(true);
  };

  const confirmAddToPlaylist = async () => {
    if (!selectedContent || !selectedPlaylist) return;

    try {
      setActionLoading(true);
      await apiClient.addPlaylistItem(selectedPlaylist, selectedContent.id);
      toast.success('Content added to playlist');
      setIsAddToPlaylistModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add to playlist');
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk selection handlers
  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredContent.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredContent.map(item => item.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    
    try {
      setActionLoading(true);
      await Promise.all(
        Array.from(selectedItems).map(id => apiClient.deleteContent(id))
      );
      toast.success(`${selectedItems.size} items deleted`);
      setSelectedItems(new Set());
      loadContent();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete some items');
    } finally {
      setActionLoading(false);
    }
  };

  const getTypeIcon = (type: string): IconName => {
    switch (type) {
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      case 'pdf':
        return 'document';
      case 'url':
        return 'link';
      default:
        return 'folder';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Dropzone configuration
  const getAcceptedFileTypes = (): Record<string, string[]> => {
    if (uploadForm.type === 'image') return { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] };
    if (uploadForm.type === 'video') return { 'video/*': ['.mp4', '.mov', '.avi', '.webm'] };
    if (uploadForm.type === 'pdf') return { 'application/pdf': ['.pdf'] };
    return {};
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: getAcceptedFileTypes() as any,
    multiple: true, // Enable multiple file selection
    disabled: uploadForm.type === 'url',
    onDrop: (acceptedFiles) => {
      // Add files to upload queue
      const newQueueItems = acceptedFiles.map(file => ({
        file,
        status: 'pending' as const,
        progress: 0,
      }));
      setUploadQueue(prev => [...prev, ...newQueueItems]);
      
      // For backward compatibility, set first file to uploadForm
      if (acceptedFiles.length > 0 && !uploadForm.file) {
        const file = acceptedFiles[0];
        setUploadForm(prev => ({
          ...prev,
          file,
          url: URL.createObjectURL(file),
        }));
        if (!uploadForm.title) {
          setUploadForm(prev => ({
            ...prev,
            title: file.name.replace(/\.[^/.]+$/, '')
          }));
        }
      }
    },
  });

  // Filter by type and search query
  const filteredContent = content.filter((c) => {
    // Type filter
    const matchesType = filterType === 'all' || c.type === filterType;

    // Search filter
    const matchesSearch = !debouncedSearch ||
      c.title.toLowerCase().includes(debouncedSearch.toLowerCase());

    // Status filter
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;

    // Date range filter
    let matchesDate = true;
    if (filterDateRange !== 'all' && c.createdAt) {
      const contentDate = new Date(c.createdAt);
      const now = new Date();
      const daysAgo = {
        '7days': 7,
        '30days': 30,
        '90days': 90,
      }[filterDateRange] || 0;
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      matchesDate = contentDate >= cutoffDate;
    }

    // Tag filter (TODO: implement when content model has tags)
    let matchesTags = true;
    if (selectedTags.length > 0) {
      // For now, this is a placeholder - tags will be added to Content model
      matchesTags = true;
    }

    return matchesType && matchesSearch && matchesStatus && matchesDate && matchesTags;
  });

  const clearAllFilters = () => {
    setFilterType('all');
    setFilterStatus('all');
    setFilterDateRange('all');
    setSearchQuery('');
  };

  const hasActiveFilters = filterType !== 'all' || filterStatus !== 'all' || filterDateRange !== 'all' || searchQuery !== '';

  return (
    <div className="flex h-full">
      {/* Folder Sidebar */}
      <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <FolderTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onCreateFolder={() => setIsCreateFolderModalOpen(true)}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
      <toast.ToastContainer />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Content Library</h2>
          <p className="mt-2 text-gray-600">
            Manage your media assets ({content.length} items)
            {realtimeStatus === 'connected' && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600">
                <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                Real-time enabled
              </span>
            )}
            {realtimeStatus === 'offline' && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-yellow-600">
                <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                Offline mode
              </span>
            )}
            {getPendingCount() > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-blue-600">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                {getPendingCount()} pending
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 text-sm font-medium transition flex items-center gap-2 ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon name="grid" size="md" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm font-medium transition flex items-center gap-2 ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon name="list" size="md" />
            </button>
          </div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Icon name="add" size="lg" className="text-white" />
            <span>Upload Content</span>
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <SearchFilter
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search content by title..."
      />
      {debouncedSearch && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {filteredContent.length} {filteredContent.length === 1 ? 'result' : 'results'} found
        </p>
      )}

      {/* Tag Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <button
          onClick={() => setShowTagFilter(!showTagFilter)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
        >
          <Icon name="folder" size="md" />
          <span>Filter by Tags</span>
          <svg
            className={`w-4 h-4 transition-transform ${showTagFilter ? 'rotate-180' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {showTagFilter && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <ContentTagger
              tags={tags}
              selectedTags={selectedTags}
              onChange={setSelectedTags}
            />
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
              >
                Clear tag filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {['all', 'image', 'video', 'pdf', 'url'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  filterType === type
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
                {type !== 'all' && ` (${content.filter((c) => c.type === type).length})`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear all
              </button>
            )}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <Icon name="settings" size="md" className="text-gray-600" />
              <span>Advanced</span>
              <svg 
                className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`}
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="ready">Ready</option>
                <option value="processing">Processing</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Date
              </label>
              <select
                value={filterDateRange}
                onChange={(e) => setFilterDateRange(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">All Time</option>
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
              </select>
            </div>
          </div>
        )}

        {/* Active Filters Indicator */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-gray-200 flex items-center gap-2 text-sm">
            <span className="text-gray-600">Active filters:</span>
            {filterType !== 'all' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                Type: {filterType}
              </span>
            )}
            {filterStatus !== 'all' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                Status: {filterStatus}
              </span>
            )}
            {filterDateRange !== 'all' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                Date: {filterDateRange}
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                Search: "{searchQuery}"
              </span>
            )}
          </div>
        )}
      </div>

      {/* Folder Breadcrumb */}
      <FolderBreadcrumb
        folders={folders}
        currentFolderId={selectedFolderId}
        onNavigate={setSelectedFolderId}
      />

      {/* Bulk Actions Toolbar */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-blue-900">
              {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedItems(new Set())}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMoveToFolderModalOpen(true)}
              disabled={actionLoading}
              className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <Icon name="folder" size="md" className="text-white" />
              Move to Folder
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={actionLoading}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              <Icon name="delete" size="md" className="text-white" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Content Grid */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredContent.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No content yet"
          description="Start by uploading your first media file"
          action={{
            label: 'Upload Content',
            onClick: () => setIsUploadModalOpen(true),
          }}
        />
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === filteredContent.length && filteredContent.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredContent.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleSelectItem(item.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => handlePreview(item)}>
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <Icon name={getTypeIcon(item.type)} size="xl" className="text-white" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate" title={item.title}>
                          {item.title}
                        </div>
                        {item.duration && (
                          <div className="text-xs text-gray-500">{item.duration}s</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium uppercase text-gray-600 bg-gray-100 rounded">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handlePushToDevice(item)}
                        className="text-green-600 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded transition"
                        title="Push to device"
                      >
                        <Icon name="push" size="md" />
                      </button>
                      <button
                        onClick={() => handleAddToPlaylist(item)}
                        className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition"
                        title="Add to playlist"
                      >
                        <Icon name="add" size="md" />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition"
                        title="Edit"
                      >
                        <Icon name="edit" size="md" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition"
                        title="Delete"
                      >
                        <Icon name="delete" size="md" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContent.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              <div 
                className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center relative overflow-hidden cursor-pointer"
                onClick={() => handlePreview(item)}
                title="Click to preview"
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to icon if thumbnail fails to load
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <Icon name={getTypeIcon(item.type)} size="6xl" className={`text-white ${item.thumbnailUrl ? 'hidden' : ''}`} />
                <div className="absolute top-3 left-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelectItem(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-white shadow-sm"
                  />
                </div>
                <span
                  className={`absolute top-3 right-3 px-3 py-1 text-xs rounded-full font-semibold ${getStatusColor(
                    item.status
                  )}`}
                >
                  {item.status}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 truncate" title={item.title}>
                  {item.title}
                </h3>
                <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                  <span className="uppercase">{item.type}</span>
                  {item.duration && <span>{item.duration}s</span>}
                </div>
                {item.createdAt && (
                  <div className="text-xs text-gray-400 mb-4">
                    Uploaded {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePushToDevice(item)}
                    className="text-sm bg-green-50 text-green-600 py-2 rounded hover:bg-green-100 transition font-medium flex items-center justify-center gap-1"
                  >
                    <Icon name="push" size="sm" />
                    Push
                  </button>
                  <button
                    onClick={() => handleAddToPlaylist(item)}
                    className="text-sm bg-purple-50 text-purple-600 py-2 rounded hover:bg-purple-100 transition font-medium flex items-center justify-center gap-1"
                  >
                    <Icon name="add" size="sm" />
                    Playlist
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="text-sm bg-blue-50 text-blue-600 py-2 rounded hover:bg-blue-100 transition font-medium flex items-center justify-center gap-1"
                  >
                    <Icon name="edit" size="sm" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="text-sm bg-red-50 text-red-600 py-2 rounded hover:bg-red-100 transition font-medium flex items-center justify-center gap-1"
                  >
                    <Icon name="delete" size="sm" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Content"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content Title
            </label>
            <input
              type="text"
              value={uploadForm.title}
              onChange={(e) => {
                setUploadForm({ ...uploadForm, title: e.target.value });
                // Clear error on change
                if (formErrors.title) {
                  setFormErrors({ ...formErrors, title: '' });
                }
              }}
              onBlur={() => {
                // Validate on blur
                const errors = validateForm(contentUploadSchema, uploadForm);
                if (errors.title) {
                  setFormErrors({ ...formErrors, title: errors.title });
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
                formErrors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Summer Sale Banner"
              autoComplete="off"
            />
            {formErrors.title && (
              <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content Type
            </label>
            <select
              value={uploadForm.type}
              onChange={(e) =>
                setUploadForm({ ...uploadForm, type: e.target.value as any })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="pdf">PDF</option>
              <option value="url">URL/Web Page</option>
            </select>
          </div>
          
          {/* File Upload Section - Drag and Drop */}
          {uploadForm.type !== 'url' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload File
              </label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              >
                <input {...getInputProps()} />
                <svg
                  className="w-12 h-12 text-gray-400 mb-3 mx-auto"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {isDragActive ? (
                  <p className="text-sm font-medium text-blue-600">
                    Drop the file here...
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-blue-600 hover:text-blue-700 mb-1">
                      Drag & drop file here, or click to browse
                    </p>
                    <p className="text-xs text-gray-500">
                      {uploadForm.type === 'image' && 'PNG, JPG, GIF up to 10MB'}
                      {uploadForm.type === 'video' && 'MP4, MOV, AVI up to 100MB'}
                      {uploadForm.type === 'pdf' && 'PDF up to 50MB'}
                    </p>
                  </>
                )}
              </div>
              
              {/* Upload Queue */}
              {uploadQueue.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      Upload Queue ({uploadQueue.length} file{uploadQueue.length > 1 ? 's' : ''})
                    </p>
                    <button
                      onClick={() => setUploadQueue([])}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {uploadQueue.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(item.file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                          {item.status === 'pending' && (
                            <span className="text-xs text-gray-500">Pending</span>
                          )}
                          {item.status === 'uploading' && (
                            <LoadingSpinner size="sm" />
                          )}
                          {item.status === 'success' && (
                            <span className="text-green-600">✓</span>
                          )}
                          {item.status === 'error' && (
                            <span className="text-red-600" title={item.error}>✗</span>
                          )}
                          <button
                            onClick={() => setUploadQueue(prev => prev.filter((_, i) => i !== idx))}
                            className="text-gray-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* URL Input (for URL type or fallback) */}
          {uploadForm.type === 'url' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL
              </label>
              <input
                type="url"
                value={uploadForm.url}
                onChange={(e) => {
                  setUploadForm({ ...uploadForm, url: e.target.value });
                  if (formErrors.url) {
                    setFormErrors({ ...formErrors, url: '' });
                  }
                }}
                onBlur={() => {
                  const errors = validateForm(contentUploadSchema, uploadForm);
                  if (errors.url) {
                    setFormErrors({ ...formErrors, url: errors.url });
                  }
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
                  formErrors.url ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="https://example.com/page"
                autoComplete="off"
              />
              {formErrors.url && (
                <p className="mt-1 text-sm text-red-600">{formErrors.url}</p>
              )}
            </div>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsUploadModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
              disabled={actionLoading || (uploadQueue.length === 0 && (!uploadForm.title || !uploadForm.url))}
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              {uploadQueue.length > 0 
                ? `Upload ${uploadQueue.length} File${uploadQueue.length > 1 ? 's' : ''}`
                : 'Upload Content'
              }
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Content Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setFormErrors({});
        }}
        title="Edit Content"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content Title
            </label>
            <input
              type="text"
              value={uploadForm.title}
              onChange={(e) => {
                setUploadForm({ ...uploadForm, title: e.target.value });
                if (formErrors.title) {
                  setFormErrors({ ...formErrors, title: '' });
                }
              }}
              onBlur={() => {
                const errors = validateForm(contentUploadSchema, uploadForm);
                if (errors.title) {
                  setFormErrors({ ...formErrors, title: errors.title });
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
                formErrors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Summer Sale Banner"
              autoComplete="off"
            />
            {formErrors.title && (
              <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
            )}
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Type:</strong> {uploadForm.type}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Content type cannot be changed after upload
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setFormErrors({});
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
              disabled={actionLoading || !uploadForm.title}
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Push to Device Modal */}
      <Modal
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
        title="Push Content to Devices"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Push "{selectedContent?.title}" directly to devices. The content will display for the specified duration, then the previous playlist will resume.
          </p>

          {/* Duration Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Duration (seconds)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={3600}
                value={pushDuration}
                onChange={(e) => setPushDuration(Math.max(5, Math.min(3600, parseInt(e.target.value) || 30)))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
              />
              <div className="flex gap-1">
                {[15, 30, 60, 120].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setPushDuration(sec)}
                    className={`px-2 py-1 text-xs rounded ${
                      pushDuration === sec
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Min: 5s, Max: 3600s (1 hour)
            </p>
          </div>

          {/* Device Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Devices ({devices.filter(d => d.status === 'online').length} online)
            </label>
            <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
              {devices.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No devices available</p>
              ) : (
                devices.map((device) => (
                  <label
                    key={device.id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${
                      device.status === 'online'
                        ? 'border-gray-200 hover:bg-gray-50'
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDevices.includes(device.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDevices([...selectedDevices, device.id]);
                        } else {
                          setSelectedDevices(selectedDevices.filter((id) => id !== device.id));
                        }
                      }}
                      className="mr-3 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{device.nickname}</div>
                      <div className="text-xs text-gray-500">{device.location || 'No location'}</div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        device.status === 'online'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {device.status}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsPushModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={confirmPush}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
              disabled={actionLoading || selectedDevices.length === 0}
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              <Icon name="push" size="md" className="text-white" />
              Push to {selectedDevices.length} Device{selectedDevices.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add to Playlist Modal */}
      <Modal
        isOpen={isAddToPlaylistModalOpen}
        onClose={() => setIsAddToPlaylistModalOpen(false)}
        title="Add to Playlist"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Add "{selectedContent?.title}" to a playlist:
          </p>
          <select
            value={selectedPlaylist}
            onChange={(e) => setSelectedPlaylist(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a playlist</option>
            {playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name} ({playlist.items?.length || 0} items)
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsAddToPlaylistModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={confirmAddToPlaylist}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
              disabled={actionLoading || !selectedPlaylist}
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              Add to Playlist
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={selectedContent?.title || 'Preview'}
        size="lg"
      >
        <div className="space-y-4">
          {selectedContent && (
            <>
              {selectedContent.type === 'image' && (
                <div className="flex justify-center bg-gray-100 rounded-lg p-4">
                  <img
                    src={selectedContent.url}
                    alt={selectedContent.title}
                    className="max-w-full max-h-[70vh] object-contain rounded"
                  />
                </div>
              )}
              
              {selectedContent.type === 'video' && (
                <div className="bg-black rounded-lg overflow-hidden">
                  <video
                    src={selectedContent.url}
                    controls
                    className="w-full max-h-[70vh]"
                    autoPlay
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              )}
              
              {selectedContent.type === 'pdf' && (
                <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '70vh' }}>
                  <iframe
                    src={selectedContent.url}
                    className="w-full h-full"
                    title={selectedContent.title}
                  />
                </div>
              )}
              
              {selectedContent.type === 'url' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>URL Content:</strong>
                    </p>
                    <a
                      href={selectedContent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline break-all"
                    >
                      {selectedContent.url}
                    </a>
                  </div>
                  <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '60vh' }}>
                    <iframe
                      src={selectedContent.url}
                      className="w-full h-full"
                      title={selectedContent.title}
                      sandbox="allow-same-origin allow-scripts"
                    />
                  </div>
                </div>
              )}
              
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Type:</strong> {selectedContent.type.toUpperCase()}</p>
                {selectedContent.duration && (
                  <p><strong>Duration:</strong> {selectedContent.duration}s</p>
                )}
                {selectedContent.createdAt && (
                  <p><strong>Uploaded:</strong> {new Date(selectedContent.createdAt).toLocaleDateString()}</p>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Preview Modal */}
      <PreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        content={selectedContent}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Content"
        message={`Are you sure you want to delete "${selectedContent?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />

      {/* Create Folder Modal */}
      <Modal
        isOpen={isCreateFolderModalOpen}
        onClose={() => {
          setIsCreateFolderModalOpen(false);
          setNewFolderName('');
          setNewFolderParentId(null);
        }}
        title="Create New Folder"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Folder Name
            </label>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="e.g., Marketing Materials"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parent Folder (optional)
            </label>
            <select
              value={newFolderParentId || ''}
              onChange={(e) => setNewFolderParentId(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            >
              <option value="">Root (No Parent)</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setIsCreateFolderModalOpen(false);
                setNewFolderName('');
                setNewFolderParentId(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateFolder}
              disabled={actionLoading || !newFolderName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              Create Folder
            </button>
          </div>
        </div>
      </Modal>

      {/* Move to Folder Modal */}
      <Modal
        isOpen={isMoveToFolderModalOpen}
        onClose={() => {
          setIsMoveToFolderModalOpen(false);
          setTargetFolderId(null);
        }}
        title="Move Content to Folder"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Move {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} to a folder:
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Destination Folder
            </label>
            <select
              value={targetFolderId || ''}
              onChange={(e) => setTargetFolderId(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            >
              <option value="">Select a folder...</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name} ({folder.contentCount || 0} items)
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setIsMoveToFolderModalOpen(false);
                setTargetFolderId(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleMoveToFolder}
              disabled={actionLoading || !targetFolderId}
              className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              <Icon name="folder" size="md" className="text-white" />
              Move to Folder
            </button>
          </div>
        </div>
      </Modal>
      </div>
    </div>
  );
}
