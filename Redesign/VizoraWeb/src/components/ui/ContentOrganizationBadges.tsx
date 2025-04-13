import React from 'react';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ContentOrganizationBadgesProps {
  folder?: string;
  tags?: Tag[];
  onClickFolder?: (folder: string) => void;
  onClickTag?: (tag: Tag) => void;
}

export const ContentOrganizationBadges: React.FC<ContentOrganizationBadgesProps> = ({
  folder,
  tags,
  onClickFolder,
  onClickTag
}) => {
  if (!folder && (!tags || tags.length === 0)) {
    return null;
  }

  return (
    <div className="organization-badges">
      {folder && (
        <div 
          className="folder-badge"
          style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
          onClick={() => onClickFolder && onClickFolder(folder)}
        >
          <span className="icon">📁</span>
          {folder}
        </div>
      )}
      
      {tags && tags.length > 0 && (
        <div className="tag-badges">
          {tags.map(tag => (
            <div 
              key={tag.id} 
              className="tag-badge"
              onClick={() => onClickTag && onClickTag(tag)}
              style={{ backgroundColor: tag.color, color: '#ffffff' }}
            >
              <span className="icon">#</span>
              {tag.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 