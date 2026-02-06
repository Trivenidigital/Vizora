'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Playlist, PlaylistItem, Content } from '@/lib/types';
import { Icon } from '@/theme/icons';
import { useToast } from '@/lib/hooks/useToast';
import { usePlaylistHistory } from '@/lib/hooks/usePlaylistHistory';
import LoadingSpinner from '@/components/LoadingSpinner';
import ContentLibraryPanel from '@/components/playlist/ContentLibraryPanel';
import PlaylistEditorPanel from '@/components/playlist/PlaylistEditorPanel';
import PlaylistPreviewPanel from '@/components/playlist/PlaylistPreviewPanel';
import {
 DndContext,
 DragOverlay,
 closestCenter,
 PointerSensor,
 KeyboardSensor,
 useSensor,
 useSensors,
 DragStartEvent,
 DragEndEvent,
} from '@dnd-kit/core';
import {
 arrayMove,
 sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import DraggableContentItem from '@/components/playlist/DraggableContentItem';

export default function PlaylistBuilderPage() {
 const router = useRouter();
 const params = useParams();
 const playlistId = params.id as string;
 const toast = useToast();

 const [playlist, setPlaylist] = useState<Playlist | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [activeContent, setActiveContent] = useState<Content | null>(null);

 // Undo/Redo history for playlist items
 const {
 state: playlistItems,
 pushState: pushPlaylistState,
 undo,
 redo,
 reset: resetHistory,
 canUndo,
 canRedo,
 } = usePlaylistHistory<PlaylistItem[]>([]);

 // DnD sensors
 const sensors = useSensors(
 useSensor(PointerSensor),
 useSensor(KeyboardSensor, {
 coordinateGetter: sortableKeyboardCoordinates,
 })
 );

 useEffect(() => {
 loadPlaylist();
 }, [playlistId]);

 // Sync playlist items when history state changes (for undo/redo)
 useEffect(() => {
 if (playlist && playlistItems !== playlist.items) {
 setPlaylist(prev => prev ? { ...prev, items: playlistItems } : prev);
 }
 }, [playlistItems]);

 // Wrapped undo handler that shows toast feedback
 const handleUndo = useCallback(() => {
 if (canUndo) {
 undo();
 toast.info('Undo');
 }
 }, [canUndo, undo, toast]);

 // Wrapped redo handler that shows toast feedback
 const handleRedo = useCallback(() => {
 if (canRedo) {
 redo();
 toast.info('Redo');
 }
 }, [canRedo, redo, toast]);

 // Keyboard shortcuts for undo/redo
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 // Don't trigger if user is typing in an input
 if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
 return;
 }

 if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
 if (e.shiftKey) {
 handleRedo();
 } else {
 handleUndo();
 }
 e.preventDefault();
 }
 };

 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [handleUndo, handleRedo]);

 const loadPlaylist = async (resetUndoHistory = true) => {
 try {
 setLoading(true);
 const data = await apiClient.getPlaylist(playlistId);
 setPlaylist(data);
 // Reset undo history when initially loading or reloading from server
 if (resetUndoHistory) {
 resetHistory(data.items || []);
 }
 } catch (error: any) {
 toast.error(error.message || 'Failed to load playlist');
 router.push('/dashboard/playlists');
 } finally {
 setLoading(false);
 }
 };

 const handleDragStart = (event: DragStartEvent) => {
 const { active } = event;
 if (active.data.current?.content) {
 setActiveContent(active.data.current.content);
 }
 };

 const handleDragEnd = async (event: DragEndEvent) => {
 const { active, over } = event;
 setActiveContent(null);

 if (!over || !playlist) return;

 // Check if dragging from content library to playlist
 if (active.id.toString().startsWith('content-') && over.id === 'playlist-drop-zone') {
 const content = active.data.current?.content as Content;
 if (content) {
 try {
 const newItem = await apiClient.addPlaylistItem(playlist.id, content.id);
 const updatedPlaylist = await apiClient.getPlaylist(playlist.id);
 // Push new state to history before updating
 pushPlaylistState(updatedPlaylist.items || []);
 setPlaylist(updatedPlaylist);
 toast.success('Item added to playlist');
 } catch (error: any) {
 toast.error(error.message || 'Failed to add item');
 }
 }
 return;
 }

 // Check if reordering within playlist
 if (!active.id.toString().startsWith('content-') && !over.id.toString().startsWith('content-')) {
 if (active.id !== over.id) {
 const oldIndex = playlistItems.findIndex((item) => item.id === active.id);
 const newIndex = playlistItems.findIndex((item) => item.id === over.id);

 if (oldIndex !== -1 && newIndex !== -1) {
 const newItems = arrayMove(playlistItems, oldIndex, newIndex);

 // Push new state to history and update UI optimistically
 pushPlaylistState(newItems);
 setPlaylist({ ...playlist, items: newItems });

 try {
 await apiClient.reorderPlaylistItems(playlist.id, newItems.map((item) => item.id));
 toast.success('Playlist reordered');
 } catch (error: any) {
 toast.error(error.message || 'Failed to reorder items');
 // Revert on error by undoing
 undo();
 await loadPlaylist(false);
 }
 }
 }
 }
 };

 const handleRemoveItem = async (itemId: string) => {
 if (!playlist) return;

 // Optimistically update UI
 const newItems = playlistItems.filter((item) => item.id !== itemId);
 pushPlaylistState(newItems);
 setPlaylist({ ...playlist, items: newItems });

 try {
 await apiClient.removePlaylistItem(playlist.id, itemId);
 toast.success('Item removed from playlist');
 } catch (error: any) {
 toast.error(error.message || 'Failed to remove item');
 // Revert on error
 undo();
 await loadPlaylist(false);
 }
 };

 const handleUpdateDuration = async (itemId: string, duration: number) => {
 if (!playlist) return;

 // Optimistically update UI
 const newItems = playlistItems.map((item) =>
 item.id === itemId ? { ...item, duration } : item
 );
 pushPlaylistState(newItems);
 setPlaylist({ ...playlist, items: newItems });

 try {
 await apiClient.updatePlaylistItem(playlist.id, itemId, { duration });
 toast.success('Duration updated');
 } catch (error: any) {
 toast.error(error.message || 'Failed to update duration');
 // Revert on error
 undo();
 await loadPlaylist(false);
 }
 };

 const handleReorder = async (itemIds: string[]) => {
 if (!playlist) return;

 // Create reordered items array based on new order
 const itemMap = new Map(playlistItems.map((item) => [item.id, item]));
 const newItems = itemIds
 .map((id) => itemMap.get(id))
 .filter((item): item is PlaylistItem => item !== undefined);

 // Optimistically update UI
 pushPlaylistState(newItems);
 setPlaylist({ ...playlist, items: newItems });

 try {
 await apiClient.reorderPlaylistItems(playlist.id, itemIds);
 toast.success('Playlist reordered');
 } catch (error: any) {
 toast.error(error.message || 'Failed to reorder items');
 // Revert on error
 undo();
 await loadPlaylist(false);
 }
 };

 const handleSave = async () => {
 if (!playlist) return;

 try {
 setSaving(true);
 // The playlist is already saved via individual operations
 // This is just a confirmation
 toast.success('Playlist saved successfully');
 } catch (error: any) {
 toast.error(error.message || 'Failed to save playlist');
 } finally {
 setSaving(false);
 }
 };

 const handleBack = () => {
 router.push('/dashboard/playlists');
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-screen">
 <LoadingSpinner size="xl" />
 </div>
 );
 }

 if (!playlist) {
 return null;
 }

 return (
 <div className="flex flex-col h-screen overflow-hidden">
 <toast.ToastContainer />

 {/* Header */}
 <div className="flex items-center justify-between px-6 py-4 bg-[var(--surface)] border-b border-[var(--border)]">
 <div className="flex items-center gap-4">
 <button
 onClick={handleBack}
 className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition"
 title="Back to playlists"
 >
 <Icon name="chevronLeft" size="md" className="text-[var(--foreground-secondary)]" />
 </button>
 <div>
 <h1 className="text-2xl font-bold text-[var(--foreground)]">{playlist.name}</h1>
 {playlist.description && (
 <p className="text-sm text-[var(--foreground-secondary)] mt-1">{playlist.description}</p>
 )}
 </div>
 </div>
 <div className="flex items-center gap-3">
 {/* Undo/Redo buttons */}
 <div className="flex items-center gap-1 mr-2">
 <button
 onClick={handleUndo}
 disabled={!canUndo}
 className="p-2 rounded hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition"
 title="Undo (Ctrl+Z)"
 >
 <Icon name="undo" size="md" className="text-[var(--foreground-secondary)]" />
 </button>
 <button
 onClick={handleRedo}
 disabled={!canRedo}
 className="p-2 rounded hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition"
 title="Redo (Ctrl+Shift+Z)"
 >
 <Icon name="redo" size="md" className="text-[var(--foreground-secondary)]" />
 </button>
 </div>
 <button
 onClick={handleSave}
 disabled={saving}
 className="px-6 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-medium flex items-center gap-2 disabled:opacity-50"
 >
 {saving && <LoadingSpinner size="sm" />}
 <Icon name="check" size="sm" className="text-white" />
 Save
 </button>
 </div>
 </div>

 {/* 3-Panel Layout */}
 <div className="flex-1 flex overflow-hidden">
 <DndContext
 sensors={sensors}
 collisionDetection={closestCenter}
 onDragStart={handleDragStart}
 onDragEnd={handleDragEnd}
 >
 {/* Left Panel - Content Library */}
 <div className="w-80 flex-shrink-0">
 <ContentLibraryPanel organizationId={playlist.id} />
 </div>

 {/* Center Panel - Playlist Editor */}
 <div className="flex-1 min-w-0">
 <PlaylistEditorPanel
 items={playlistItems}
 onRemoveItem={handleRemoveItem}
 onUpdateDuration={handleUpdateDuration}
 onReorder={handleReorder}
 />
 </div>

 {/* Right Panel - Preview */}
 <div className="w-96 flex-shrink-0">
 <PlaylistPreviewPanel items={playlistItems} />
 </div>

 {/* Drag Overlay */}
 <DragOverlay>
 {activeContent ? <DraggableContentItem content={activeContent} isDragging /> : null}
 </DragOverlay>
 </DndContext>
 </div>
 </div>
 );
}
