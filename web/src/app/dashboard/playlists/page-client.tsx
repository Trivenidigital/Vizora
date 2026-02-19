'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Playlist, Content, Display } from '@/lib/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import SearchFilter from '@/components/SearchFilter';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useRealtimeEvents } from '@/lib/hooks';
import {
 DndContext,
 closestCenter,
 KeyboardSensor,
 PointerSensor,
 useSensor,
 useSensors,
 DragEndEvent,
} from '@dnd-kit/core';
import {
 arrayMove,
 SortableContext,
 sortableKeyboardCoordinates,
 useSortable,
 verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/theme/icons';
import PlaylistPreview from '@/components/PlaylistPreview';

// Sortable playlist item component
function SortablePlaylistItem({ item, idx, onRemove, onDurationChange }: {
 item: any;
 idx: number;
 onRemove: () => void;
 onDurationChange: (newDuration: number) => void;
}) {
 const {
 attributes,
 listeners,
 setNodeRef,
 transform,
 transition,
 isDragging,
 } = useSortable({ id: item.id });

 const style = {
 transform: CSS.Transform.toString(transform),
 transition,
 opacity: isDragging ? 0.5 : 1,
 };

 return (
 <div
 ref={setNodeRef}
 style={style}
 className="flex items-center justify-between p-3 bg-[var(--background)] rounded-lg hover:bg-[var(--surface-hover)] transition-all duration-300"
 >
 <div className="flex items-center gap-3 flex-1">
 <button
 {...attributes}
 {...listeners}
 className="cursor-grab active:cursor-grabbing p-2 text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
 >
 <Icon name="list" size="sm" className="text-[var(--foreground-tertiary)]" />
 </button>
 <span className="text-[var(--foreground-tertiary)] font-medium">{idx + 1}</span>
 <div className="flex-1">
 <div className="text-sm font-medium text-[var(--foreground)]">
 {item.content?.title || `Content ${item.contentId}`}
 </div>
 <div className="text-xs text-[var(--foreground-tertiary)] flex items-center gap-2">
 <span>Duration:</span>
 <input
 type="number"
 min="1"
 max="300"
 value={item.duration || 30}
 onChange={(e) => {
 const val = parseInt(e.target.value);
 if (val > 0 && val <= 300) {
 onDurationChange(val);
 }
 }}
 onClick={(e) => e.stopPropagation()}
 className="w-16 px-2 py-1 text-xs border border-[var(--border)] rounded focus:ring-1 focus:ring-[#00E5A0] focus:border-[#00E5A0]"
 />
 <span>s</span>
 </div>
 </div>
 </div>
 <button
 onClick={onRemove}
 className="text-red-600 hover:text-red-800 text-sm"
 >
 <Icon name="delete" size="md" className="text-red-600" />
 </button>
 </div>
 );
}

export default function PlaylistsClient() {
 const router = useRouter();
 const toast = useToast();
 const [playlists, setPlaylists] = useState<Playlist[]>([]);
 const [content, setContent] = useState<Content[]>([]);
 const [devices, setDevices] = useState<Display[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
 const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
 const [isEditModalOpen, setIsEditModalOpen] = useState(false);
 const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
 const [playlistThumbnails, setPlaylistThumbnails] = useState<Record<string, string[]>>({});
 const [isBuilderModalOpen, setIsBuilderModalOpen] = useState(false);
 const [createForm, setCreateForm] = useState({ name: '', description: '' });
 const [actionLoading, setActionLoading] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const debouncedSearch = useDebounce(searchQuery, 300);
 const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'offline' | 'error'>('offline');
 const [previewPlaylist, setPreviewPlaylist] = useState<Playlist | null>(null);

 // Real-time event handling
 const { isConnected, isOffline, emitPlaylistUpdate } = useRealtimeEvents({
 enabled: true,
 onPlaylistChange: (update) => {
 // Update playlist in real-time
 setPlaylists((prev) =>
 prev.map((p) =>
 p.id === update.playlistId
 ? {
 ...p,
 ...update.payload,
 }
 : p
 )
 );
 setRealtimeStatus('connected');

 // Show notification for specific actions
 switch (update.action) {
 case 'updated':
 toast.info('Playlist updated by another user');
 break;
 case 'deleted':
 toast.warning('Playlist deleted');
 break;
 case 'items_reordered':
 toast.info('Playlist items reordered');
 break;
 }

 },
 onConnectionChange: (isConnected) => {
 setRealtimeStatus(isConnected ? 'connected' : 'offline');
 if (isConnected) {
 toast.info('Real-time connection established');
 }
 },
 });

 // Drag and drop sensors
 const sensors = useSensors(
 useSensor(PointerSensor),
 useSensor(KeyboardSensor, {
 coordinateGetter: sortableKeyboardCoordinates,
 })
 );

 useEffect(() => {
 loadPlaylists();
 loadContent();
 loadDevices();
 }, []);

 // Load thumbnails for playlists
 useEffect(() => {
 if (playlists.length > 0) {
 const thumbnails: Record<string, string[]> = {};
 playlists.forEach((playlist) => {
 if (playlist.items && playlist.items.length > 0) {
 // Get first 4 items with thumbnails
 const thumbs = playlist.items
 .slice(0, 4)
 .map(item => item.content?.thumbnailUrl || '')
 .filter(Boolean);
 if (thumbs.length > 0) {
 thumbnails[playlist.id] = thumbs;
 }
 }
 });
 setPlaylistThumbnails(thumbnails);
 }
 }, [playlists]);

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

 const loadDevices = async () => {
 try {
 const response = await apiClient.getDisplays();
 setDevices(response.data || response || []);
 } catch (error) {
 // Silent fail
 }
 };

 const getDeviceCount = (playlistId: string) => {
 return devices.filter(d => d.currentPlaylistId === playlistId).length;
 };

 const handleCreate = async () => {
 try {
 setActionLoading(true);
 const newPlaylist = await apiClient.createPlaylist({
 name: createForm.name,
 description: createForm.description,
 items: [],
 });
 toast.success('Playlist created successfully');
 setIsCreateModalOpen(false);
 setCreateForm({ name: '', description: '' });

 // Emit real-time event
 emitPlaylistUpdate({
 playlistId: newPlaylist.id || '',
 action: 'created',
 payload: newPlaylist,
 });

 loadPlaylists();
 } catch (error: any) {
 toast.error(error.message || 'Failed to create playlist');
 } finally {
 setActionLoading(false);
 }
 };

 const handleEdit = async (playlist: Playlist) => {
 router.push(`/dashboard/playlists/${playlist.id}`);
 };

 const handleDelete = (playlist: Playlist) => {
 setSelectedPlaylist(playlist);
 setIsDeleteModalOpen(true);
 };

 const confirmDelete = async () => {
 if (!selectedPlaylist) return;

 try {
 setActionLoading(true);
 const deletedPlaylistId = selectedPlaylist.id;
 await apiClient.deletePlaylist(deletedPlaylistId);
 toast.success('Playlist deleted successfully');

 // Emit real-time event
 emitPlaylistUpdate({
 playlistId: deletedPlaylistId,
 action: 'deleted',
 payload: selectedPlaylist,
 });

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

 const formatFileSize = (bytes: number) => {
 if (bytes === 0) return '0 B';
 const k = 1024;
 const sizes = ['B', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
 };

 const getTotalDuration = (playlist: Playlist) => {
 const total = (playlist as any).totalDuration ||
 (playlist.items?.reduce((sum, item) => sum + (item.duration || 30), 0) || 0);
 if (total === 0) return '0s';
 if (total < 60) return `${total}s`;
 const minutes = Math.floor(total / 60);
 const seconds = total % 60;
 return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
 };

 const handleDragEnd = async (event: DragEndEvent) => {
 const { active, over } = event;

 if (!over || !selectedPlaylist) return;

 if (active.id !== over.id) {
 const oldIndex = selectedPlaylist.items.findIndex((item) => item.id === active.id);
 const newIndex = selectedPlaylist.items.findIndex((item) => item.id === over.id);

 // Optimistically update UI
 const newItems = arrayMove(selectedPlaylist.items, oldIndex, newIndex);
 setSelectedPlaylist({ ...selectedPlaylist, items: newItems });

 try {
 await apiClient.reorderPlaylistItems(selectedPlaylist.id, newItems.map(item => item.id));
 toast.success('Playlist reordered');
 loadPlaylists();
 } catch (error: any) {
 toast.error(error.message || 'Failed to reorder items');
 loadPlaylists(); // Revert on error
 }
 }
 };

 return (
 <div className="space-y-6">
 <toast.ToastContainer />

 <div className="flex justify-between items-center">
 <div>
 <h2 className="eh-heading font-[var(--font-sora)] text-2xl text-[var(--foreground)]">Playlists</h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Create and manage content playlists ({playlists.length} total)
 </p>
 </div>
 <button
 onClick={() => setIsCreateModalOpen(true)}
 className="bg-[#00E5A0] text-[#061A21] px-6 py-3 rounded-lg hover:bg-[#00CC8E] transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
 >
 <span className="text-xl">+</span>
 <span>Create Playlist</span>
 </button>
 </div>

 {/* Search Filter */}
 <SearchFilter
 value={searchQuery}
 onChange={setSearchQuery}
 placeholder="Search playlists by name..."
 />

 {/* Playlists List */}
 {loading ? (
 <div className="bg-[var(--surface)] rounded-lg shadow p-12">
 <LoadingSpinner size="lg" />
 </div>
 ) : playlists.length === 0 ? (
 <EmptyState
 icon="playlists"
 title="No playlists yet"
 description="Create your first playlist to organize content"
 action={{
 label: 'Create Playlist',
 onClick: () => setIsCreateModalOpen(true),
 }}
 />
 ) : (
 <>
 {debouncedSearch && (
 <div className="bg-[#00E5A0]/5 border border-[#00E5A0]/30 rounded-lg p-3">
 <p className="text-sm text-[#00E5A0]">
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
 className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow hover:-translate-y-[2px] hover:border-[rgba(0,229,160,0.2)] hover:shadow-md transition-all duration-300 p-6"
 >
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-start gap-4 flex-1">
 {/* Visual Thumbnail Grid */}
 {playlistThumbnails[playlist.id] && playlistThumbnails[playlist.id].length > 0 ? (
 <div className="grid grid-cols-2 gap-1 w-20 h-20 rounded-md overflow-hidden flex-shrink-0 bg-[var(--background-tertiary)]">
 {playlistThumbnails[playlist.id].map((url, i) => (
 <img
 key={i}
 src={url}
 alt=""
 loading="lazy"
 className="w-full h-full object-cover"
 onError={(e) => {
 e.currentTarget.src = '/placeholder.png';
 }}
 />
 ))}
 </div>
 ) : (
 <div className="w-20 h-20 flex items-center justify-center text-4xl bg-[var(--background-secondary)] rounded flex-shrink-0">
 📋
 </div>
 )}
 <div className="flex-1">
 <h3 className="text-xl font-semibold text-[var(--foreground)] mb-1">
 {playlist.name}
 </h3>
 {playlist.description && (
 <p className="text-sm text-[var(--foreground-secondary)] mb-2">{playlist.description}</p>
 )}
 <div className="flex items-center gap-4 text-sm text-[var(--foreground-tertiary)]">
 <span className="flex items-center gap-1">
 <Icon name="playlists" size="sm" className="text-[var(--foreground-tertiary)]" />
 {playlist.items?.length || 0}{' '}
 {playlist.items?.length === 1 ? 'item' : 'items'}
 </span>
 <span className="flex items-center gap-1">
 <Icon name="schedules" size="sm" className="text-[var(--foreground-tertiary)]" />
 {getTotalDuration(playlist)}
 </span>
 {playlist.totalSize && playlist.totalSize > 0 && (
 <span className="flex items-center gap-1">
 <Icon name="content" size="sm" className="text-[var(--foreground-tertiary)]" />
 {formatFileSize(playlist.totalSize)}
 </span>
 )}
 </div>
 {playlist.updatedAt && (
 <div className="text-xs text-[var(--foreground-tertiary)] mt-2">
 Updated {new Date(playlist.updatedAt).toLocaleDateString()}
 </div>
 )}
 </div>
 </div>
 <div className="flex flex-col items-end gap-2">
 {playlist.isActive && (
 <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
 Active
 </span>
 )}
 {getDeviceCount(playlist.id) > 0 && (
 <span className="px-3 py-1 text-xs font-semibold rounded-full bg-[#00E5A0]/10 text-[#00E5A0] flex items-center gap-1">
 <Icon name="devices" size="sm" className="text-[#00E5A0]" />
 <span>{getDeviceCount(playlist.id)} {getDeviceCount(playlist.id) === 1 ? 'device' : 'devices'}</span>
 </span>
 )}
 </div>
 </div>

 {/* Preview of items */}
 {playlist.items && playlist.items.length > 0 && (
 <div className="mb-4 p-3 bg-[var(--background)] rounded-lg">
 <div className="text-xs font-medium text-[var(--foreground-tertiary)] mb-2 uppercase">
 Content Preview
 </div>
 <div className="space-y-1">
 {playlist.items.slice(0, 3).map((item, idx) => (
 <div key={item.id} className="text-sm text-[var(--foreground-secondary)] flex items-center gap-2">
 <span className="text-[var(--foreground-tertiary)]">{idx + 1}.</span>
 <span className="flex-1 truncate">
 {item.content?.title || `Content ${item.contentId}`}
 </span>
 <span className="text-xs text-[var(--foreground-tertiary)]">{item.duration || 30}s</span>
 </div>
 ))}
 {playlist.items.length > 3 && (
 <div className="text-xs text-[var(--foreground-tertiary)] italic">
 +{playlist.items.length - 3} more items...
 </div>
 )}
 </div>
 </div>
 )}

 <div className="flex gap-2 flex-wrap">
 <button
 onClick={() => setPreviewPlaylist(playlist)}
 className="flex-1 px-4 py-2 text-sm bg-[var(--background)] text-[var(--foreground-secondary)] rounded-lg hover:bg-[var(--surface-hover)] transition font-medium flex items-center justify-center gap-1"
 >
 <Icon name="preview" size="sm" className="text-[var(--foreground-secondary)]" />
 Preview
 </button>
 <button
 onClick={() => handleEdit(playlist)}
 className="flex-1 px-4 py-2 text-sm bg-[#00E5A0]/5 text-[#00E5A0] rounded-lg hover:bg-[#00E5A0]/10 transition font-medium flex items-center justify-center gap-1"
 >
 <Icon name="edit" size="sm" className="text-[#00E5A0]" />
 Edit
 </button>
 <button
 onClick={() => handlePublish(playlist)}
 className="flex-1 px-4 py-2 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition font-medium flex items-center justify-center gap-1"
 >
 <Icon name="power" size="sm" className="text-green-600" />
 Publish
 </button>
 <button
 onClick={async () => {
 try {
 await apiClient.duplicatePlaylist(playlist.id);
 toast.success('Playlist duplicated');
 loadPlaylists();
 } catch (error: any) {
 toast.error(error.message || 'Failed to duplicate playlist');
 }
 }}
 className="flex-1 px-4 py-2 text-sm bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition font-medium flex items-center justify-center gap-1"
 >
 <Icon name="playlists" size="sm" className="text-purple-600" />
 Duplicate
 </button>
 <button
 onClick={() => handleDelete(playlist)}
 className="flex-1 px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium flex items-center justify-center gap-1"
 >
 <Icon name="delete" size="sm" className="text-red-600" />
 Delete
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
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
 Playlist Name
 </label>
 <input
 type="text"
 value={createForm.name}
 onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
 className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 placeholder="e.g., Morning Promotions"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
 Description (Optional)
 </label>
 <textarea
 value={createForm.description}
 onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
 className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 placeholder="Brief description of this playlist"
 rows={3}
 />
 </div>
 <div className="flex justify-end gap-3 pt-4">
 <button
 onClick={() => setIsCreateModalOpen(false)}
 className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
 >
 Cancel
 </button>
 <button
 onClick={handleCreate}
 className="px-4 py-2 text-sm font-medium text-white bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50 flex items-center gap-2"
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
 <h4 className="font-semibold text-[var(--foreground)] mb-3">Available Content</h4>
 <div className="border border-[var(--border)] rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
 {content.length === 0 ? (
 <p className="text-sm text-[var(--foreground-tertiary)] text-center py-8">
 No content available. Upload content first.
 </p>
 ) : (
 content.map((item) => (
 <div
 key={item.id}
 className="flex items-center justify-between p-3 bg-[var(--background)] rounded-lg hover:bg-[var(--surface-hover)] transition cursor-pointer"
 onClick={async () => {
 if (selectedPlaylist) {
 try {
 await apiClient.addPlaylistItem(selectedPlaylist.id, item.id);
 toast.success('Item added to playlist');
 // Fetch updated playlist and update selectedPlaylist
 const updatedPlaylist = await apiClient.getPlaylist(selectedPlaylist.id);
 setSelectedPlaylist(updatedPlaylist);
 loadPlaylists();
 } catch (error: any) {
 toast.error(error.message || 'Failed to add item');
 }
 }
 }}
 >
 <div className="flex items-center gap-3">
 {item.type === 'image' && <Icon name="image" size="lg" className="text-[var(--foreground-secondary)]" />}
 {item.type === 'video' && <Icon name="video" size="lg" className="text-[var(--foreground-secondary)]" />}
 {item.type === 'pdf' && <Icon name="document" size="lg" className="text-[var(--foreground-secondary)]" />}
 {!['image', 'video', 'pdf'].includes(item.type) && <Icon name="folder" size="lg" className="text-[var(--foreground-secondary)]" />}
 <div>
 <div className="text-sm font-medium text-[var(--foreground)]">{item.title}</div>
 <div className="text-xs text-[var(--foreground-tertiary)]">{item.type}</div>
 </div>
 </div>
 <button className="px-3 py-1 text-xs bg-[#00E5A0] text-[#061A21] rounded hover:bg-[#00CC8E]">
 Add →
 </button>
 </div>
 ))
 )}
 </div>
 </div>

 {/* Playlist Items */}
 <div>
 <h4 className="font-semibold text-[var(--foreground)] mb-3">
 Playlist Items ({selectedPlaylist?.items?.length || 0})
 </h4>
 <DndContext
 sensors={sensors}
 collisionDetection={closestCenter}
 onDragEnd={handleDragEnd}
 >
 <div className="border border-[var(--border)] rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
 {!selectedPlaylist?.items || selectedPlaylist.items.length === 0 ? (
 <p className="text-sm text-[var(--foreground-tertiary)] text-center py-8">
 No items in playlist. Add content from the left.
 </p>
 ) : (
 <SortableContext
 items={selectedPlaylist.items.map((item) => item.id)}
 strategy={verticalListSortingStrategy}
 >
 {selectedPlaylist.items.map((item, idx) => (
 <SortablePlaylistItem
 key={item.id}
 item={item}
 idx={idx}
 onRemove={async () => {
 try {
 await apiClient.removePlaylistItem(selectedPlaylist.id, item.id);
 toast.success('Item removed from playlist');
 // Fetch updated playlist and update selectedPlaylist
 const updatedPlaylist = await apiClient.getPlaylist(selectedPlaylist.id);
 setSelectedPlaylist(updatedPlaylist);
 loadPlaylists();
 } catch (error: any) {
 toast.error(error.message || 'Failed to remove item');
 }
 }}
 onDurationChange={async (newDuration: number) => {
 try {
 await apiClient.updatePlaylistItem(selectedPlaylist.id, item.id, { duration: newDuration });
 toast.success('Duration updated');
 // Fetch updated playlist and update selectedPlaylist
 const updatedPlaylist = await apiClient.getPlaylist(selectedPlaylist.id);
 setSelectedPlaylist(updatedPlaylist);
 loadPlaylists();
 } catch (error: any) {
 toast.error(error.message || 'Failed to update duration');
 }
 }}
 />
 ))}
 </SortableContext>
 )}
 </div>
 </DndContext>
 </div>
 </div>

 <div className="flex justify-end pt-4 border-t">
 <button
 onClick={() => {
 setIsBuilderModalOpen(false);
 loadPlaylists();
 }}
 className="px-6 py-2 text-sm font-medium text-white bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition"
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

 {/* Preview Modal */}
 <Modal
 isOpen={!!previewPlaylist}
 onClose={() => setPreviewPlaylist(null)}
 title={`Preview: ${previewPlaylist?.name}`}
 size="xl"
 >
 {previewPlaylist && (
 <PlaylistPreview
 items={previewPlaylist.items || []}
 onClose={() => setPreviewPlaylist(null)}
 />
 )}
 </Modal>
 </div>
 );
}
