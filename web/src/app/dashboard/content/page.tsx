'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Content, Display, Playlist } from '@/lib/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { contentUploadSchema, validateForm } from '@/lib/validation';

export default function ContentPage() {
  const toast = useToast();
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [isAddToPlaylistModalOpen, setIsAddToPlaylistModalOpen] = useState(false);
  const [devices, setDevices] = useState<Display[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [uploadForm, setUploadForm] = useState({
    title: '',
    type: 'image' as 'image' | 'video' | 'pdf' | 'url',
    url: '',
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadContent();
    loadDevices();
    loadPlaylists();
  }, []);

  const loadContent = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getContent();
      setContent(response.data || response || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const response = await apiClient.getDisplays();
      setDevices(response.data || response || []);
    } catch (error) {
      // Silent fail
    }
  };

  const loadPlaylists = async () => {
    try {
      const response = await apiClient.getPlaylists();
      setPlaylists(response.data || response || []);
    } catch (error) {
      // Silent fail
    }
  };

  const handleUpload = async () => {
    // Validate form
    const errors = validateForm(contentUploadSchema, uploadForm);
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.createContent(uploadForm);
      toast.success('Content uploaded successfully');
      setIsUploadModalOpen(false);
      setUploadForm({ title: '', type: 'image', url: '' });
      setFormErrors({});
      loadContent();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload content');
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
      await apiClient.deleteContent(selectedContent.id);
      toast.success('Content deleted successfully');
      loadContent();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete content');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePushToDevice = (item: Content) => {
    setSelectedContent(item);
    setSelectedDevices([]);
    setIsPushModalOpen(true);
  };

  const confirmPush = async () => {
    if (!selectedContent || selectedDevices.length === 0) return;

    try {
      setActionLoading(true);
      // Create a temporary playlist and assign to devices
      const playlist = await apiClient.createPlaylist({
        name: `Quick Push - ${selectedContent.title}`,
        description: 'Auto-generated playlist for direct content push',
        items: [{ contentId: selectedContent.id, duration: 30 }],
      });

      // Assign the playlist to all selected devices
      await Promise.all(
        selectedDevices.map((deviceId) =>
          apiClient.updateDisplay(deviceId, { currentPlaylistId: playlist.id })
        )
      );

      toast.success(`Content pushed to ${selectedDevices.length} device(s)`);
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return '🖼️';
      case 'video':
        return '🎥';
      case 'pdf':
        return '📄';
      case 'url':
        return '🔗';
      default:
        return '📁';
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

  // Filter by type and search query
  const filteredContent = content.filter((c) => {
    const matchesType = filterType === 'all' || c.type === filterType;
    const matchesSearch = !debouncedSearch || 
      c.title.toLowerCase().includes(debouncedSearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Content Library</h2>
          <p className="mt-2 text-gray-600">
            Manage your media assets ({content.length} items)
          </p>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          <span>Upload Content</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search content by title..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoComplete="off"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        {debouncedSearch && (
          <p className="mt-2 text-sm text-gray-600">
            {filteredContent.length} {filteredContent.length === 1 ? 'result' : 'results'} found
          </p>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow p-2 flex gap-2">
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

      {/* Content Grid */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredContent.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No content yet</h3>
          <p className="text-gray-600 mb-6">Start by uploading your first media file</p>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Upload Content
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContent.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              <div className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center relative">
                <span className="text-6xl">{getTypeIcon(item.type)}</span>
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
                    className="text-sm bg-green-50 text-green-600 py-2 rounded hover:bg-green-100 transition font-medium"
                  >
                    📤 Push
                  </button>
                  <button
                    onClick={() => handleAddToPlaylist(item)}
                    className="text-sm bg-purple-50 text-purple-600 py-2 rounded hover:bg-purple-100 transition font-medium"
                  >
                    ➕ Playlist
                  </button>
                  <button className="text-sm bg-blue-50 text-blue-600 py-2 rounded hover:bg-blue-100 transition font-medium">
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="text-sm bg-red-50 text-red-600 py-2 rounded hover:bg-red-100 transition font-medium"
                  >
                    🗑️ Delete
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
          
          {/* File Upload Section */}
          {uploadForm.type !== 'url' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload File
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
                <input
                  type="file"
                  id="file-upload"
                  accept={
                    uploadForm.type === 'image' ? 'image/*' :
                    uploadForm.type === 'video' ? 'video/*' :
                    uploadForm.type === 'pdf' ? '.pdf' : '*'
                  }
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Create object URL for preview
                      const url = URL.createObjectURL(file);
                      setUploadForm({ ...uploadForm, url });
                      // Set title from filename if not set
                      if (!uploadForm.title) {
                        setUploadForm(prev => ({ ...prev, title: file.name.replace(/\.[^/.]+$/, '') }));
                      }
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer inline-flex flex-col items-center"
                >
                  <svg
                    className="w-12 h-12 text-gray-400 mb-3"
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
                  <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
                    Click to browse
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {uploadForm.type === 'image' && 'PNG, JPG, GIF up to 10MB'}
                    {uploadForm.type === 'video' && 'MP4, MOV, AVI up to 100MB'}
                    {uploadForm.type === 'pdf' && 'PDF up to 50MB'}
                  </span>
                </label>
              </div>
              {uploadForm.url && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    <span className="text-sm text-green-800">File selected</span>
                  </div>
                  <button
                    onClick={() => setUploadForm({ ...uploadForm, url: '' })}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
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
              disabled={actionLoading || !uploadForm.title || !uploadForm.url}
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              Upload Content
            </button>
          </div>
        </div>
      </Modal>

      {/* Push to Device Modal */}
      <Modal
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
        title="Push to Devices"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Select devices to push "{selectedContent?.title}" to:
          </p>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {devices.map((device) => (
              <label
                key={device.id}
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
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
                  className="mr-3 h-4 w-4"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{device.nickname}</div>
                  <div className="text-sm text-gray-500">{device.status}</div>
                </div>
              </label>
            ))}
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
              Push to {selectedDevices.length} Device(s)
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
    </div>
  );
}
