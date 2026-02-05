'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Playlist, Content } from '@/lib/types';
import { Icon } from '@/theme/icons';
import { useToast } from '@/lib/hooks/useToast';
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

  const loadPlaylist = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPlaylist(playlistId);
      setPlaylist(data);
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
        const oldIndex = playlist.items.findIndex((item) => item.id === active.id);
        const newIndex = playlist.items.findIndex((item) => item.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newItems = arrayMove(playlist.items, oldIndex, newIndex);

          // Optimistically update UI
          setPlaylist({ ...playlist, items: newItems });

          try {
            await apiClient.reorderPlaylistItems(playlist.id, newItems.map((item) => item.id));
            toast.success('Playlist reordered');
            // Reload to get updated data
            await loadPlaylist();
          } catch (error: any) {
            toast.error(error.message || 'Failed to reorder items');
            // Revert on error
            await loadPlaylist();
          }
        }
      }
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!playlist) return;

    try {
      await apiClient.removePlaylistItem(playlist.id, itemId);
      toast.success('Item removed from playlist');
      await loadPlaylist();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove item');
    }
  };

  const handleUpdateDuration = async (itemId: string, duration: number) => {
    if (!playlist) return;

    try {
      await apiClient.updatePlaylistItem(playlist.id, itemId, { duration });
      toast.success('Duration updated');
      await loadPlaylist();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update duration');
    }
  };

  const handleReorder = async (itemIds: string[]) => {
    if (!playlist) return;

    try {
      await apiClient.reorderPlaylistItems(playlist.id, itemIds);
      toast.success('Playlist reordered');
      await loadPlaylist();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reorder items');
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
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Back to playlists"
          >
            <Icon name="chevronLeft" size="md" className="text-gray-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{playlist.name}</h1>
            {playlist.description && (
              <p className="text-sm text-gray-600 mt-1">{playlist.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2 disabled:opacity-50"
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
              items={playlist.items || []}
              onRemoveItem={handleRemoveItem}
              onUpdateDuration={handleUpdateDuration}
              onReorder={handleReorder}
            />
          </div>

          {/* Right Panel - Preview */}
          <div className="w-96 flex-shrink-0">
            <PlaylistPreviewPanel items={playlist.items || []} />
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
