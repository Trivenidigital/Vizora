'use client';

import { Content } from '@/lib/types';
import { Icon } from '@/theme/icons';
import { useDraggable } from '@dnd-kit/core';

interface DraggableContentItemProps {
  content: Content;
  isDragging?: boolean;
}

export default function DraggableContentItem({ content, isDragging }: DraggableContentItemProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `content-${content.id}`,
    data: { content },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const getTypeIcon = (type: string) => {
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg cursor-grab active:cursor-grabbing
        hover:shadow-md transition-all
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        {/* Thumbnail or Icon */}
        {content.thumbnailUrl ? (
          <img
            src={content.thumbnailUrl}
            alt={content.title}
            className="w-12 h-12 object-cover rounded flex-shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-12 h-12 bg-[var(--background-secondary)] rounded flex items-center justify-center flex-shrink-0">
            <Icon name={getTypeIcon(content.type)} size="lg" className="text-[var(--foreground-tertiary)]" />
          </div>
        )}

        {/* Content Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--foreground)] truncate">
            {content.title}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[var(--foreground-tertiary)] capitalize">{content.type}</span>
            {content.duration && (
              <>
                <span className="text-[var(--border)]">•</span>
                <span className="text-xs text-[var(--foreground-tertiary)]">{formatDuration(content.duration)}</span>
              </>
            )}
          </div>
        </div>

        {/* Drag Indicator */}
        <div className="flex-shrink-0 text-[var(--foreground-tertiary)]">
          <Icon name="list" size="sm" className="text-[var(--foreground-tertiary)]" />
        </div>
      </div>
    </div>
  );
}
