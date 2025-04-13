import React from 'react';
import { FiFolder, FiTag } from 'react-icons/fi';

interface ContentOrganizationBadgesProps {
  folder?: string;
  tags?: string[];
}

/**
 * Content Organization Badges Component
 * Displays folder and tag badges for content items
 */
const ContentOrganizationBadges: React.FC<ContentOrganizationBadgesProps> = ({ folder, tags }) => {
  return (
    <div className="content-organization-badges">
      {folder && (
        <div className="folder-badge">
          <FiFolder size={14} />
          <span>{folder}</span>
        </div>
      )}
      
      {tags && tags.length > 0 && (
        <div className="tags-container">
          {tags.map((tag, index) => (
            <div key={index} className="tag-badge">
              <FiTag size={14} />
              <span>{tag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContentOrganizationBadges; 