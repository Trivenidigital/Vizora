import React from 'react';

interface ContentOrganizationBadgesProps {
  folder?: string;
  tags?: string[];
  onClickFolder?: (folder: string) => void;
  onClickTag?: (tag: string) => void;
}

const ContentOrganizationBadges: React.FC<ContentOrganizationBadgesProps> = ({
  folder,
  tags,
  onClickFolder,
  onClickTag
}) => {
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
              key={tag} 
              className="tag-badge"
              onClick={() => onClickTag && onClickTag(tag)}
              style={{ backgroundColor: '#e5e7eb', color: '#4b5563' }}
            >
              <span className="icon">#</span>
              {tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContentOrganizationBadges; 