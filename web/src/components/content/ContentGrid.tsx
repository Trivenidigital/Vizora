'use client';

import Image from 'next/image';
import { Content } from '@/lib/types';
import { Icon } from '@/theme/icons';
import type { IconName } from '@/theme/icons';

interface ContentGridProps {
  content: Content[];
  selectedItems: Set<string>;
  onToggleSelect: (id: string) => void;
  onPreview: (item: Content) => void;
  onEdit: (item: Content) => void;
  onDelete: (item: Content) => void;
  onPushToDevice: (item: Content) => void;
  onAddToPlaylist: (item: Content) => void;
}

export function ContentGrid({
  content,
  selectedItems,
  onToggleSelect,
  onPreview,
  onEdit,
  onDelete,
  onPushToDevice,
  onAddToPlaylist,
}: ContentGridProps) {
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
        return 'bg-[var(--background-secondary)] text-[var(--foreground)]';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {content.map((item) => (
        <div
          key={item.id}
          className="bg-[var(--surface)] rounded-lg shadow overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-1"
        >
          <div
            className="h-48 bg-gradient-to-br from-[#00E5A0] to-[#00B4D8] flex items-center justify-center relative overflow-hidden cursor-pointer"
            onClick={() => onPreview(item)}
            title="Click to preview"
          >
            {item.thumbnailUrl ? (
              <Image
                src={item.thumbnailUrl}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <Icon
              name={getTypeIcon(item.type)}
              size="6xl"
              className={`text-white ${item.thumbnailUrl ? 'hidden' : ''}`}
            />
            <div className="absolute top-3 left-3">
              <input
                type="checkbox"
                checked={selectedItems.has(item.id)}
                onChange={() => onToggleSelect(item.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0] bg-[var(--surface)] shadow-sm"
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
            <h3
              className="font-semibold text-[var(--foreground)] mb-2 truncate"
              title={item.title}
            >
              {item.title}
            </h3>
            <div className="flex items-center justify-between text-sm text-[var(--foreground-tertiary)] mb-2">
              <span className="uppercase">{item.type}</span>
              {item.duration && <span>{item.duration}s</span>}
            </div>
            {item.createdAt && (
              <div className="text-xs text-[var(--foreground-tertiary)] mb-4">
                Uploaded {new Date(item.createdAt).toLocaleDateString()}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onPushToDevice(item)}
                className="text-sm bg-green-50 text-green-600 py-2 rounded hover:bg-green-100 transition font-medium flex items-center justify-center gap-1"
              >
                <Icon name="push" size="sm" />
                Push
              </button>
              <button
                onClick={() => onAddToPlaylist(item)}
                className="text-sm bg-purple-50 text-purple-600 py-2 rounded hover:bg-purple-100 transition font-medium flex items-center justify-center gap-1"
              >
                <Icon name="add" size="sm" />
                Playlist
              </button>
              <button
                onClick={() => onEdit(item)}
                className="text-sm bg-[#00E5A0]/5 text-[#00E5A0] py-2 rounded hover:bg-[#00E5A0]/10 transition font-medium flex items-center justify-center gap-1"
              >
                <Icon name="edit" size="sm" />
                Edit
              </button>
              <button
                onClick={() => onDelete(item)}
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
  );
}
