import React, { useState, useEffect } from 'react';

export interface Content {
  id: string;
  title: string;
  type: 'image' | 'video';
  url: string;
  duration?: number;
}

export interface ContentPlayerProps {
  content?: Content;
  onPlayComplete?: () => void;
  autoPlay?: boolean;
}

const ContentPlayer: React.FC<ContentPlayerProps> = ({ 
  content, 
  onPlayComplete, 
  autoPlay = true 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset states when content changes
    setIsLoading(true);
    setError(null);
    setIsPlaying(autoPlay);
  }, [content, autoPlay]);

  const handleLoadComplete = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setError('Failed to load content');
  };

  const handlePlayComplete = () => {
    if (onPlayComplete) {
      onPlayComplete();
    }
  };

  if (!content) {
    return <div data-testid="no-content">No content available</div>;
  }

  return (
    <div className="content-player" data-testid="content-player">
      {isLoading && <div data-testid="loading-indicator">Loading...</div>}
      
      {error && <div className="error-message" data-testid="error-content">Error: {error}</div>}
      
      {!error && content.type === 'image' && (
        <img 
          src={content.url} 
          alt={content.title}
          className="content-image"
          onLoad={handleLoadComplete}
          onError={handleError}
          data-testid="image-content"
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      )}
      
      {!error && content.type === 'video' && (
        <video
          src={content.url}
          className="content-video"
          autoPlay={isPlaying}
          controls={false}
          onLoadedData={handleLoadComplete}
          onError={handleError}
          onEnded={handlePlayComplete}
          data-testid="video-content"
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      )}
    </div>
  );
};

export default ContentPlayer; 