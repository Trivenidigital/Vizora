import React from 'react';
import { Content } from '../types/content';
import { CheckIcon, FolderIcon, TagIcon } from '@heroicons/react/24/outline';

interface ContentCardProps {
  content: Content;
  onClick?: (content: Content) => void;
  onSelect?: (id: string, selected: boolean) => void;
  isSelected?: boolean;
}

const ContentCard: React.FC<ContentCardProps> = ({
  content,
  onClick,
  onSelect,
  isSelected
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      onSelect?.(content.id, !isSelected);
    } else {
      onClick?.(content);
    }
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(content.id, !isSelected);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      role="button"
      className="relative bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer group"
      onClick={handleClick}
      data-testid={`content-card-${content.id}`}
    >
      {/* Selection Checkbox */}
      <div
        role="checkbox"
        aria-checked={isSelected}
        className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-opacity ${
          isSelected
            ? 'bg-blue-600 border-blue-600'
            : 'bg-white border-gray-300 group-hover:opacity-100 opacity-0'
        }`}
        onClick={handleSelect}
        data-testid="content-checkbox"
      >
        {isSelected && (
          <CheckIcon className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Content Type Icon */}
      <div
        className="absolute top-2 left-10 z-10"
        data-testid="content-type-icon"
        data-type={content.type}
      >
        <TagIcon className="w-4 h-4 text-gray-500" />
      </div>

      {/* Thumbnail */}
      <div className="aspect-w-16 aspect-h-9 bg-gray-100">
        {content.thumbnailUrl ? (
          <img
            src={content.thumbnailUrl}
            alt={content.name}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <span className="text-gray-400 text-sm">
              {content.type.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Content Info */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {content.name}
        </h3>
        <div className="mt-1 flex items-center text-xs text-gray-500">
          <span>{new Date(content.createdAt).toLocaleDateString()}</span>
          <span className="mx-1">•</span>
          <span>{content.type}</span>
          <span className="mx-1">•</span>
          <span>{formatFileSize(content.size)}</span>
        </div>
        {content.folder && (
          <div className="mt-1 flex items-center text-xs text-gray-500">
            <FolderIcon className="w-3 h-3 mr-1" />
            <span>{content.folder.name}</span>
          </div>
        )}
        {content.tags && content.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {content.tags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color
                }}
              >
                <TagIcon className="w-3 h-3 mr-1" />
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div
        className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
          content.status === 'ready'
            ? 'bg-green-100 text-green-800'
            : content.status === 'processing'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800'
        }`}
        data-testid="content-status"
      >
        {content.status.charAt(0).toUpperCase() + content.status.slice(1)}
      </div>
    </div>
  );
};

export default ContentCard; 