import React from 'react';
import { FiImage, FiVideo, FiFile, FiGlobe } from 'react-icons/fi';

interface ContentCardProps {
  id: string;
  title: string;
  type: 'image' | 'video' | 'document' | 'website';
  thumbnail?: string;
  description?: string;
  onClick?: (id: string) => void;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  id,
  title,
  type,
  thumbnail,
  description,
  onClick
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick(id);
    }
  };

  // Get appropriate icon based on content type
  const getTypeIcon = () => {
    switch (type) {
      case 'image':
        return <FiImage className="content-type-icon" />;
      case 'video':
        return <FiVideo className="content-type-icon" />;
      case 'document':
        return <FiFile className="content-type-icon" />;
      case 'website':
        return <FiGlobe className="content-type-icon" />;
      default:
        return <FiFile className="content-type-icon" />;
    }
  };

  return (
    <div className="content-card" onClick={handleClick}>
      <div className="content-card-thumbnail">
        {thumbnail ? (
          <img src={thumbnail} alt={title} />
        ) : (
          <div className="content-type-icon-container">
            {getTypeIcon()}
          </div>
        )}
      </div>
      <div className="content-card-info">
        <h3 className="content-card-title">{title}</h3>
        {description && (
          <p className="content-card-description">
            {description.length > 100
              ? `${description.substring(0, 100)}...`
              : description}
          </p>
        )}
        <div className="content-card-type">{type}</div>
      </div>
    </div>
  );
};

export default ContentCard; 