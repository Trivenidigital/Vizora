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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'active':
        return 'bg-success-500/10 text-success-700 dark:text-success-400';
      case 'processing':
        return 'bg-warning-500/10 text-warning-700 dark:text-warning-400';
      case 'error':
        return 'bg-error-500/10 text-error-700 dark:text-error-400';
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
                className="rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0]"
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
                  className="rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0]"
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => onPreview(item)}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-[#00E5A0] to-[#00B4D8] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                    className="text-success-600 dark:text-success-400 hover:text-success-700 dark:hover:text-success-300 hover:bg-success-500/10 px-2 py-1 rounded transition"
                    title="Push to device"
                  >
                    <Icon name="push" size="md" />
                  </button>
                  <button
                    onClick={() => onAddToPlaylist(item)}
                    className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-500/10 px-2 py-1 rounded transition"
                    title="Add to playlist"
                  >
                    <Icon name="add" size="md" />
                  </button>
                  <button
                    onClick={() => onEdit(item)}
                    className="text-[#00E5A0] hover:text-[#00CC8E] hover:bg-[#00E5A0]/5 px-2 py-1 rounded transition"
                    title="Edit"
                  >
                    <Icon name="edit" size="md" />
                  </button>
                  <button
                    onClick={() => onDelete(item)}
                    className="text-error-600 dark:text-error-400 hover:text-error-700 dark:hover:text-error-300 hover:bg-error-500/10 px-2 py-1 rounded transition"
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
