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
      case 'html':
      case 'template':
        return 'document';
      default:
        return 'folder';
    }
  };

  /*
   * Status tints take the documented `--status-*-bg` pairs. The inks here were
   * already correct; what moved is the fill under them, from a channel tint of
   * the semantic colour to the warm badge fill the palette declares, each
   * measured ink-on-fill in globals.css: online 5.47:1, error 5.41:1,
   * offline 4.89:1.
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'active':
        return 'bg-[var(--status-online-bg)] text-[var(--success-ink)]';
      case 'processing':
        return 'bg-[var(--status-error-bg)] text-[var(--warning-ink)]';
      case 'error':
        return 'bg-[var(--status-offline-bg)] text-[var(--error-ink)]';
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
            className="h-48 bg-gradient-to-br from-[var(--primary)] to-[var(--accent-brass)] flex items-center justify-center relative overflow-hidden cursor-pointer"
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
            {/*
              * `text-white` STAYS, and it was measured rather than assumed. This
              * placeholder sits on a forest-to-brass gradient, so its ground runs
              * from `--primary` to `--accent-brass`. White measures 4.45:1 at the
              * gradient midpoint and 3.21:1 at the brass end; `--lw-on-forest`
              * measures 3.87:1 and 2.78:1 on the same two points, i.e. it drops
              * BELOW the 3:1 a meaningful graphic needs. globals.css already
              * names white as brass's companion for large text and icons, so the
              * tokenised-looking option is the worse one here.
              */}
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
                className="w-5 h-5 rounded border-[var(--border)] text-[var(--primary-ink)] focus:ring-[var(--primary-ink)] bg-[var(--surface)] shadow-sm"
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
                className="text-sm bg-success/10 text-[var(--success-ink)] py-2 rounded hover:bg-success/20 transition font-medium flex items-center justify-center gap-1"
              >
                <Icon name="push" size="sm" />
                Push
              </button>
              <button
                onClick={() => onAddToPlaylist(item)}
                className="text-sm bg-[var(--surface-secondary)] text-[var(--accent-brass-ink)] py-2 rounded hover:bg-[var(--surface-hover)] transition font-medium flex items-center justify-center gap-1"
              >
                <Icon name="add" size="sm" />
                Playlist
              </button>
              <button
                onClick={() => onEdit(item)}
                className="text-sm bg-brand/5 text-[var(--primary-ink)] py-2 rounded hover:bg-brand/10 transition font-medium flex items-center justify-center gap-1"
              >
                <Icon name="edit" size="sm" />
                Edit
              </button>
              <button
                onClick={() => onDelete(item)}
                className="text-sm bg-error/10 text-[var(--error-ink)] py-2 rounded hover:bg-error/20 transition font-medium flex items-center justify-center gap-1"
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
