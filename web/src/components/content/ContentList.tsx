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
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left">
              <input
                type="checkbox"
                checked={selectedItems.size === content.length && content.length > 0}
                onChange={onToggleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Content
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Uploaded
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {content.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50 transition">
              <td className="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={() => onToggleSelect(item.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => onPreview(item)}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                      className="text-sm font-medium text-gray-900 truncate"
                      title={item.title}
                    >
                      {item.title}
                    </div>
                    {item.duration && (
                      <div className="text-xs text-gray-500">{item.duration}s</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs font-medium uppercase text-gray-600 bg-gray-100 rounded">
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
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString()
                  : '—'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onPushToDevice(item)}
                    className="text-green-600 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded transition"
                    title="Push to device"
                  >
                    <Icon name="push" size="md" />
                  </button>
                  <button
                    onClick={() => onAddToPlaylist(item)}
                    className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition"
                    title="Add to playlist"
                  >
                    <Icon name="add" size="md" />
                  </button>
                  <button
                    onClick={() => onEdit(item)}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition"
                    title="Edit"
                  >
                    <Icon name="edit" size="md" />
                  </button>
                  <button
                    onClick={() => onDelete(item)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition"
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
