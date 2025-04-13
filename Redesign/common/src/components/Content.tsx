import React from 'react';

interface ContentProps {
  title: string;
  type: 'image' | 'video' | 'document' | 'website';
  url: string;
  _thumbnail?: string;
  description?: string;
}

export const Content: React.FC<ContentProps> = ({
  title,
  type,
  url,
  description
}) => {
  // Render appropriate content based on type
  const renderContent = () => {
    switch (type) {
      case 'image':
        return (
          <div className="content-image">
            <img src={url} alt={title} />
          </div>
        );
      case 'video':
        return (
          <div className="content-video">
            <video controls>
              <source src={url} />
              Your browser does not support the video tag.
            </video>
          </div>
        );
      case 'document':
        return (
          <div className="content-document">
            <iframe src={url} title={title} />
          </div>
        );
      case 'website':
        return (
          <div className="content-website">
            <iframe src={url} title={title} />
          </div>
        );
      default:
        return <div>Unsupported content type</div>;
    }
  };

  return (
    <div className="content-container">
      <h2 className="content-title">{title}</h2>
      {description && <p className="content-description">{description}</p>}
      <div className="content-display">{renderContent()}</div>
    </div>
  );
};

export default Content; 