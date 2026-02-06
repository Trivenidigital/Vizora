'use client';

import { useState, useEffect } from 'react';
import { PlaylistItem, Content } from '@/lib/types';
import { Icon } from '@/theme/icons';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PlaylistEditorPanelProps {
  items: PlaylistItem[];
  onRemoveItem: (itemId: string) => void;
  onUpdateDuration: (itemId: string, duration: number) => void;
  onReorder: (itemIds: string[]) => void;
}

// Sortable playlist item
function SortablePlaylistItem({
  item,
  index,
  onRemove,
  onDurationChange,
}: {
  item: PlaylistItem;
  index: number;
  onRemove: () => void;
  onDurationChange: (duration: number) => void;
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

  const getTypeIcon = (type?: string) => {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:shadow-sm transition-all"
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)]"
      >
        <Icon name="list" size="sm" className="text-[var(--foreground-tertiary)]" />
      </button>

      {/* Index */}
      <span className="text-sm font-medium text-[var(--foreground-tertiary)] w-6">{index + 1}</span>

      {/* Thumbnail */}
      {item.content?.thumbnailUrl ? (
        <img
          src={item.content.thumbnailUrl}
          alt={item.content.title}
          className="w-12 h-12 object-cover rounded flex-shrink-0"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="w-12 h-12 bg-[var(--background-secondary)] rounded flex items-center justify-center flex-shrink-0">
          <Icon name={getTypeIcon(item.content?.type)} size="lg" className="text-[var(--foreground-tertiary)]" />
        </div>
      )}

      {/* Content Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--foreground)] truncate">
          {item.content?.title || `Content ${item.contentId}`}
        </div>
        <div className="text-xs text-[var(--foreground-tertiary)] capitalize">
          {item.content?.type || 'unknown'}
        </div>
      </div>

      {/* Duration Input */}
      <div className="flex items-center gap-2">
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
          className="w-16 px-2 py-1 text-sm border border-[var(--border)] rounded focus:ring-1 focus:ring-[#00E5A0] focus:border-[#00E5A0]"
        />
        <span className="text-sm text-[var(--foreground-tertiary)]">s</span>
      </div>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition"
      >
        <Icon name="delete" size="sm" className="text-red-600" />
      </button>
    </div>
  );
}

export default function PlaylistEditorPanel({
  items,
  onRemoveItem,
  onUpdateDuration,
  onReorder,
}: PlaylistEditorPanelProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'playlist-drop-zone',
  });

  const totalDuration = items.reduce((sum, item) => sum + (item.duration || 30), 0);

  const formatTotalDuration = (seconds: number) => {
    if (seconds === 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Playlist Items</h3>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">
          Drag content from the library or reorder items below
        </p>
      </div>

      {/* Drop Zone / Items List */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 overflow-y-auto p-4 space-y-2
          ${isOver ? 'bg-[#00E5A0]/5 border-2 border-[#00E5A0] border-dashed' : ''}
        `}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-20 h-20 bg-[var(--background-secondary)] rounded-full flex items-center justify-center mb-4">
              <Icon name="playlists" size="2xl" className="text-[var(--foreground-tertiary)]" />
            </div>
            <h4 className="text-lg font-medium text-[var(--foreground)] mb-2">
              Empty Playlist
            </h4>
            <p className="text-sm text-[var(--foreground-tertiary)] max-w-xs">
              Drag content from the library to build your playlist
            </p>
          </div>
        ) : (
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            {items.map((item, index) => (
              <SortablePlaylistItem
                key={item.id}
                item={item}
                index={index}
                onRemove={() => onRemoveItem(item.id)}
                onDurationChange={(duration) => onUpdateDuration(item.id, duration)}
              />
            ))}
          </SortableContext>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-[var(--border)] bg-[var(--background)]">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Icon name="playlists" size="sm" className="text-[var(--foreground-tertiary)]" />
              <span className="font-medium text-[var(--foreground)]">{items.length}</span>
              <span className="text-[var(--foreground-secondary)]">
                {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="clock" size="sm" className="text-[var(--foreground-tertiary)]" />
              <span className="font-medium text-[var(--foreground)]">
                {formatTotalDuration(totalDuration)}
              </span>
              <span className="text-[var(--foreground-secondary)]">total</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
