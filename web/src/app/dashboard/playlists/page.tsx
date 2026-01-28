'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Playlist, Content } from '@/lib/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';

export default function PlaylistsPage() {
  const toast = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBuilderModalOpen, setIsBuilderModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadPlaylists();
    loadContent();
  }, []);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPlaylists();
      setPlaylists(response.data || response || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const loadContent = async () => {
    try {
      const response = await apiClient.getContent();
      setContent(response.data || response || []);
    } catch (error) {
      // Silent fail
    }
  };

  const handleCreate = async () => {
    try {
      setActionLoading(true);
      await apiClient.createPlaylist({
        name: createForm.name,
        description: createForm.description,
        items: [],
      });
      toast.success('Playlist created successfully');
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', description: '' });
      loadPlaylists();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create playlist');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setIsBuilderModalOpen(true);
  };

  const handleDelete = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedPlaylist) return;

    try {
      setActionLoading(true);
      await apiClient.deletePlaylist(selectedPlaylist.id);
      toast.success('Playlist deleted successfully');
      loadPlaylists();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete playlist');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async (playlist: Playlist) => {
    try {
      await apiClient.updatePlaylist(playlist.id, { name: playlist.name });
      toast.success('Playlist published successfully');
      loadPlaylists();
    } catch (error: any) {
      toast.error(error.message || 'Failed to publish playlist');
    }
  };

  const getTotalDuration = (playlist: Playlist) => {
    if (!playlist.items || playlist.items.length === 0) return '0s';
    const total = playlist.items.reduce((sum, item) => sum + (item.duration || 30), 0);
    if (total < 60) return `${total}s`;
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Playlists</h2>
          <p className="mt-2 text-gray-600">
            Create and manage content playlists ({playlists.length} total)
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          <span>Create Playlist</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search playlists by name..."
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
      </div>

      {/* Playlists List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : playlists.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No playlists yet</h3>
          <p className="text-gray-600 mb-6">Create your first playlist to organize content</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Create Playlist
          </button>
        </div>
      ) : (
        <>
          {debouncedSearch && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                {playlists.filter(p => p.name.toLowerCase().includes(debouncedSearch.toLowerCase())).length}{' '}
                {playlists.filter(p => p.name.toLowerCase().includes(debouncedSearch.toLowerCase())).length === 1 ? 'result' : 'results'} found
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {playlists
            .filter(p => !debouncedSearch || p.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
            .map((playlist) => (
            <div
              key={playlist.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-all p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  <span className="text-4xl">📋</span>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      {playlist.name}
                    </h3>
                    {playlist.description && (
                      <p className="text-sm text-gray-600 mb-2">{playlist.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        📹 {playlist.items?.length || 0}{' '}
                        {playlist.items?.length === 1 ? 'item' : 'items'}
                      </span>
                      <span>⏱️ {getTotalDuration(playlist)}</span>
                    </div>
                  </div>
                </div>
                {playlist.isActive && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    Active
                  </span>
                )}
              </div>

              {/* Preview of items */}
              {playlist.items && playlist.items.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 mb-2 uppercase">
                    Content Preview
                  </div>
                  <div className="space-y-1">
                    {playlist.items.slice(0, 3).map((item, idx) => (
                      <div key={item.id} className="text-sm text-gray-700 flex items-center gap-2">
                        <span className="text-gray-400">{idx + 1}.</span>
                        <span className="flex-1 truncate">
                          {item.content?.title || `Content ${item.contentId}`}
                        </span>
                        <span className="text-xs text-gray-500">{item.duration || 30}s</span>
                      </div>
                    ))}
                    {playlist.items.length > 3 && (
                      <div className="text-xs text-gray-500 italic">
                        +{playlist.items.length - 3} more items...
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(playlist)}
                  className="flex-1 px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handlePublish(playlist)}
                  className="flex-1 px-4 py-2 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition font-medium"
                >
                  🚀 Publish
                </button>
                <button
                  onClick={() => handleDelete(playlist)}
                  className="flex-1 px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Playlist"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Playlist Name
            </label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Morning Promotions"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description of this playlist"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
              disabled={actionLoading || !createForm.name.trim()}
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              Create Playlist
            </button>
          </div>
        </div>
      </Modal>

      {/* Playlist Builder Modal */}
      <Modal
        isOpen={isBuilderModalOpen}
        onClose={() => setIsBuilderModalOpen(false)}
        title={`Edit: ${selectedPlaylist?.name}`}
        size="xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Available Content */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Available Content</h4>
              <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
                {content.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No content available. Upload content first.
                  </p>
                ) : (
                  content.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                      onClick={async () => {
                        if (selectedPlaylist) {
                          try {
                            await apiClient.addPlaylistItem(selectedPlaylist.id, item.id);
                            toast.success('Item added to playlist');
                            loadPlaylists();
                          } catch (error: any) {
                            toast.error(error.message || 'Failed to add item');
                          }
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {item.type === 'image' && '🖼️'}
                          {item.type === 'video' && '🎥'}
                          {item.type === 'pdf' && '📄'}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.title}</div>
                          <div className="text-xs text-gray-500">{item.type}</div>
                        </div>
                      </div>
                      <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                        Add →
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Playlist Items */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">
                Playlist Items ({selectedPlaylist?.items?.length || 0})
              </h4>
              <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
                {!selectedPlaylist?.items || selectedPlaylist.items.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No items in playlist. Add content from the left.
                  </p>
                ) : (
                  selectedPlaylist.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-gray-400 font-medium">{idx + 1}</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {item.content?.title || `Content ${item.contentId}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            Duration: {item.duration || 30}s
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await apiClient.removePlaylistItem(selectedPlaylist.id, item.id);
                            toast.success('Item removed from playlist');
                            loadPlaylists();
                          } catch (error: any) {
                            toast.error(error.message || 'Failed to remove item');
                          }
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={() => {
                setIsBuilderModalOpen(false);
                loadPlaylists();
              }}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Playlist"
        message={`Are you sure you want to delete "${selectedPlaylist?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
