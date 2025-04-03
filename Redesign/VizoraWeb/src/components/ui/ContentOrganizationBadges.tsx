import React from 'react';

interface ContentOrganizationBadgesProps {
  folder?: string;
  tags?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

export const ContentOrganizationBadges: React.FC<ContentOrganizationBadgesProps> = ({
  folder,
  tags = []
}) => {
  if (!folder && tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {folder && (
        <span className="folder-badge inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
          {folder}
        </span>
      )}
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="tag-badge inline-flex items-center px-2 py-1 rounded-md text-sm font-medium"
          style={{
            backgroundColor: tag.color,
            color: '#ffffff'
          }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}; 