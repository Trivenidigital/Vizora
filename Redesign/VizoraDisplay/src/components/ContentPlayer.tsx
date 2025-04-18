import React, { useState, useEffect, useRef } from 'react';
import { Content } from '@vizora/common/types';
import { ContentService } from '../services/contentService';
import { ScheduleService } from '../services/scheduleService';
import { PlaybackEngine, PlaybackState } from '../services/PlaybackEngine';
import { DisplayStatus } from '@vizora/common/types';

interface ContentPlayerProps {
  contentItem: Content | null;
  scheduleService: ScheduleService;
  contentService: ContentService;
  displayStatus: DisplayStatus | null;
  onComplete?: () => void;
  autoAdvance?: boolean;
}

/**
 * Enhanced Content Player with offline support and fallbacks
 */
const ContentPlayer: React.FC<ContentPlayerProps> = ({
  contentItem,
  scheduleService,
  contentService,
  displayStatus,
  onComplete,
  autoAdvance = true
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [binaryAssetUrl, setBinaryAssetUrl] = useState<string | null>(null);
  const [contentReady, setContentReady] = useState<boolean>(false);
  const [fallbackMode, setFallbackMode] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle content changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    setContentReady(false);
    setFallbackMode(false);
    
    if (contentItem) {
      loadContent(contentItem);
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      // Clean up binary asset URL if one was created
      if (binaryAssetUrl) {
        URL.revokeObjectURL(binaryAssetUrl);
        setBinaryAssetUrl(null);
      }
    };
  }, [contentItem?.id]);

  /**
   * Load content with offline fallbacks
   */
  const loadContent = async (contentItem: Content) => {
    try {
      if (!contentItem) {
        throw new Error('No content provided');
      }
      
      // For images and videos, try to get cached binary asset
      if ((contentItem.type === 'image' || contentItem.type === 'video') && 
          contentItem.url.startsWith('http')) {
        try {
          const assetUrl = await contentService.getBinaryAssetUrl(contentItem.id);
          if (assetUrl) {
            console.log(`Using cached binary asset for ${contentItem.id}`);
            setBinaryAssetUrl(assetUrl);
          }
        } catch (err) {
          console.warn(`Could not load cached binary asset for ${contentItem.id}:`, err);
        }
      }
      
      // Setup timeout for auto-advance based on content duration
      if (autoAdvance && contentItem.duration) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        
        // Add 500ms buffer to ensure smooth transitions
        timerRef.current = setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
        }, contentItem.duration + 500);
      }
      
      setLoading(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Error loading content:', error);
      setError(`Failed to load content: ${error.message}`);
      setLoading(false);
      
      if (onComplete) {
        onComplete();
      }
    }
  };

  /**
   * Handle load success
   */
  const handleContentLoaded = () => {
    setContentReady(true);
    setLoading(false);
  };

  /**
   * Handle load error with fallback
   */
  const handleContentError = async (e: React.SyntheticEvent<HTMLElement, Event>) => {
    console.error('Content load error:', e);
    
    // If using binary asset and it failed, try falling back to original URL
    if (binaryAssetUrl && !fallbackMode && contentItem) {
      console.log('Falling back to original content URL');
      URL.revokeObjectURL(binaryAssetUrl);
      setBinaryAssetUrl(null);
      setFallbackMode(true);
      return;
    }
    
    // Otherwise, report the error
    setError('Failed to load content');
    
    if (onComplete) {
      onComplete();
    }
  };

  /**
   * Render content based on type
   */
  const renderContent = () => {
    if (!contentItem) {
      return <div className="no-content">No content available</div>;
    }
    
    // Show loading indicator if content is still loading
    if (loading) {
      return (
        <div className="content-loading">
          <div className="spinner"></div>
          <p>Loading content...</p>
        </div>
      );
    }
    
    // Show error message if there was an error
    if (error) {
      return (
        <div className="content-error">
          <p>{error}</p>
          <button onClick={() => loadContent(contentItem)}>Retry</button>
        </div>
      );
    }
    
    // Get effective URL (either cached binary or original)
    const effectiveUrl = binaryAssetUrl || contentItem.url;
    
    switch (contentItem.type) {
      case 'image':
        return (
          <img
            ref={imageRef}
            src={effectiveUrl}
            alt={contentItem.title || 'Image content'}
            className={`content-image ${contentReady ? 'ready' : 'loading'}`}
            onLoad={handleContentLoaded}
            onError={handleContentError}
            style={{
              objectFit: contentItem.settings?.fit || 'contain',
              objectPosition: contentItem.settings?.position || 'center'
            }}
          />
        );
        
      case 'video':
        return (
          <video
            ref={videoRef}
            src={effectiveUrl}
            className={`content-video ${contentReady ? 'ready' : 'loading'}`}
            autoPlay
            muted={!contentItem.settings?.sound?.enabled}
            loop={contentItem.settings?.loop || false}
            playsInline
            controls={false}
            onCanPlay={handleContentLoaded}
            onError={handleContentError}
            style={{
              objectFit: contentItem.settings?.fit || 'contain',
              objectPosition: contentItem.settings?.position || 'center'
            }}
          />
        );
        
      case 'webpage':
        return (
          <div className="iframe-container">
            <iframe
              ref={iframeRef}
              src={contentItem.url}
              className={`content-iframe ${contentReady ? 'ready' : 'loading'}`}
              onLoad={handleContentLoaded}
              onError={handleContentError}
              sandbox="allow-scripts allow-same-origin"
              title={contentItem.title || 'Web content'}
            />
            {!contentReady && (
              <div className="iframe-loading">
                <div className="spinner"></div>
                <p>Loading web content...</p>
              </div>
            )}
          </div>
        );
        
      case 'stream':
        return (
          <div className="stream-container">
            <video
              ref={videoRef}
              src={contentItem.url}
              className={`content-stream ${contentReady ? 'ready' : 'loading'}`}
              autoPlay
              muted={!contentItem.settings?.sound?.enabled}
              playsInline
              controls={false}
              onCanPlay={handleContentLoaded}
              onError={handleContentError}
            />
            {!contentReady && (
              <div className="stream-loading">
                <div className="spinner"></div>
                <p>Connecting to stream...</p>
              </div>
            )}
          </div>
        );
        
      case 'widget':
        // Custom widget rendering
        return (
          <div 
            className="widget-container"
            dangerouslySetInnerHTML={{ __html: contentItem.url }}
          />
        );
        
      default:
        return (
          <div className="unsupported-content">
            <p>Unsupported content type: {contentItem.type}</p>
          </div>
        );
    }
  };

  return (
    <div className="content-player" ref={contentRef}>
      {renderContent()}
    </div>
  );
};

export default ContentPlayer; 