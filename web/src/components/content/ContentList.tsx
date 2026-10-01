'use client';

import { Content } from '@/lib/types';
import { Icon } from '@/theme/icons';
import type { IconName } from '@/theme/icons';

interface ContentListProps {
  content: Content[];
  selectedItems: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onPreview: (item: Content) => void;
  onEdit: (item: Content) => void;
  onDelete: (item: Content) => void;
  onPushToDevice: (item: Content) => void;
  onAddToPlaylist: (item: Content) => void;
}

export function ContentList({
  content,
  selectedItems,
  onToggleSelect,
  onToggleSelectAll,
  onPreview,
  onEdit,
  onDelete,
  onPushToDevice,
  onAddToPlaylist,
}: ContentListProps) {
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
    <div className="bg-[var(--surface)] rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-[var(--border)]">
        <thead className="bg-[var(--background)]">
          <tr>
            <th className="px-6 py-3 text-left">
              <input
                type="checkbox"
                checked={selectedItems.size === content.length && content.length > 0}
                onChange={onToggleSelectAll}
                className="rounded border-[var(--border)] text-[var(--primary-ink)] focus:ring-[var(--primary-ink)]"
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase">
              Content
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase">
              Uploaded
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-[var(--foreground-tertiary)] uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
          {content.map((item) => (
            <tr key={item.id} className="hover:bg-[var(--surface-hover)] transition">
              <td className="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={() => onToggleSelect(item.id)}
                  className="rounded border-[var(--border)] text-[var(--primary-ink)] focus:ring-[var(--primary-ink)]"
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => onPreview(item)}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)] to-[var(--accent-brass)] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Icon
                        name={getTypeIcon(item.type)}
                        size="xl"
                        /* White, not the on-forest ink - see the measured note
                           in ContentGrid: on this forest-to-brass gradient the
                           ink drops to 2.78:1 at the brass end and white holds
                           3.21:1. */
                        className="text-white"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-sm font-medium text-[var(--foreground)] truncate"
                      title={item.title}
                    >
                      {item.title}
                    </div>
                    {item.duration && (
                      <div className="text-xs text-[var(--foreground-tertiary)]">{item.duration}s</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs font-medium uppercase text-[var(--foreground-secondary)] bg-[var(--background-secondary)] rounded">
                  {item.type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(
                    item.status
                  )}`}
                >
                  {item.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-tertiary)]">
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString()
                  : '—'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onPushToDevice(item)}
                    className="text-[var(--success-ink)] hover:bg-success/10 px-2 py-1 rounded transition"
                    title="Push to device"
                  >
                    <Icon name="push" size="md" />
                  </button>
                  <button
                    onClick={() => onAddToPlaylist(item)}
                    className="text-[var(--accent-brass-ink)] hover:bg-[var(--surface-hover)] px-2 py-1 rounded transition"
                    title="Add to playlist"
                  >
                    <Icon name="add" size="md" />
                  </button>
                  <button
                    onClick={() => onEdit(item)}
                    className="text-[var(--primary-ink)] hover:text-[var(--foreground)] hover:bg-brand/5 px-2 py-1 rounded transition"
                    title="Edit"
                  >
                    <Icon name="edit" size="md" />
                  </button>
                  <button
                    onClick={() => onDelete(item)}
                    className="text-[var(--error-ink)] hover:bg-error/10 px-2 py-1 rounded transition"
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
  );
}
