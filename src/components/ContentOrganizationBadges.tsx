import React from 'react';
import { Folder, Tag } from '../types/organization';
import { FolderIcon, TagIcon } from '@heroicons/react/24/outline';

interface ContentOrganizationBadgesProps {
  folder?: string | Folder;
  tags?: Tag[];
  onFolderClick?: (folderId: string) => void;
  onTagClick?: (tagId: string) => void;
}

const ContentOrganizationBadges: React.FC<ContentOrganizationBadgesProps> = ({
  folder,
  tags = [],
  onFolderClick,
  onTagClick
}) => {
  const folderName = typeof folder === 'string' ? folder : folder?.name;
  const folderId = typeof folder === 'string' ? folder : folder?.id;

  return (
    <div className="flex flex-wrap gap-2">
      {folderName && (
        <button
          onClick={() => onFolderClick?.(folderId || '')}
          className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
          data-testid={`folder-badge-${folderId}`}
        >
          <FolderIcon className="h-4 w-4 mr-1" />
          {folderName}
        </button>
      )}
      {tags.map(tag => (
        <button
          key={tag.id}
          onClick={() => onTagClick?.(tag.id)}
          className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium hover:opacity-80"
          style={tag.color ? { backgroundColor: tag.color, color: tag.color } : undefined}
          data-testid={`tag-badge-${tag.id}`}
        >
          <TagIcon className="h-4 w-4 mr-1" />
          {tag.name}
        </button>
      ))}
    </div>
  );
};

export default ContentOrganizationBadges; 