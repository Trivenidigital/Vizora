import React, { useEffect, useState, useRef } from 'react';
import { Content } from '../types';
import { PlaybackEngine, PlaybackState } from '../services/PlaybackEngine';
import { PreloadManager } from '../services/PreloadManager';
import { cacheStorage } from '../services/storage/CacheStorage';

import './DisplayRenderer.css';

interface DisplayRendererProps {
  playlist: Content[];
  autoAdvance?: boolean;
  transitionDuration?: number;
  transitionEffect?: 'none' | 'fade' | 'crossfade';
  onPlaybackStateChange?: (state: PlaybackState) => void;
  onError?: (error: Error) => void;
}

/**
 * DisplayRenderer handles rendering content with transitions and error handling
 */
const DisplayRenderer: React.FC<DisplayRendererProps> = ({
  playlist,
  autoAdvance = true,
  transitionDuration = 500,
  transitionEffect = 'fade',
  onPlaybackStateChange,
  onError
}) => {
  // Refs for player engine and preload manager
  const playbackEngineRef = useRef<PlaybackEngine | null>(null);
  const preloadManagerRef = useRef<PreloadManager | null>(null);
  
  // State for content and UI
  const [currentContent, setCurrentContent] = useState<Content | null>(null);
  const [nextContent, setNextContent] = useState<Content | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEmpty, setIsEmpty] = useState(playlist.length === 0);
  const [retryTimerId, setRetryTimerId] = useState<number | null>(null);
  
  // Refs for media elements
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentContainerRef = useRef<HTMLDivElement>(null);
  const nextContainerRef = useRef<HTMLDivElement>(null);
  
  // Initialize playback engine and preload manager
  useEffect(() => {
    // Create playback engine
    const playbackEngine = new PlaybackEngine({
      autoAdvance,
      transitionEffect,
      transitionDuration
    });
    playbackEngineRef.current = playbackEngine;
    
    // Create preload manager
    const preloadManager = new PreloadManager({
      maxConcurrent: 3
    });
    preloadManagerRef.current = preloadManager;
    
    // Setup event listeners
    playbackEngine.on('stateChange', handlePlaybackStateChange);
    playbackEngine.on('contentChanged', handleContentChanged);
    playbackEngine.on('playlistEmpty', handlePlaylistEmpty);
    playbackEngine.on('contentError', handleContentError);
    playbackEngine.on('preloadContent', handlePreloadContent);
    
    preloadManager.on('assetPreloaded', handleAssetPreloaded);
    preloadManager.on('assetPreloadError', handleAssetPreloadError);
    
    // Load playlist
    playbackEngine.loadPlaylist(playlist);
    
    // Cache playlist for offline use
    cacheStorage.cachePlaylist(playlist).catch(err => {
      console.warn('Failed to cache playlist:', err);
    });
    
    // Start playback
    if (autoAdvance) {
      playbackEngine.play();
    }
    
    // Cleanup on unmount
    return () => {
      // Remove event listeners
      playbackEngine.removeAllListeners();
      preloadManager.removeAllListeners();
      
      // Clear timers
      if (retryTimerId) {
        clearTimeout(retryTimerId);
      }
    };
  }, []);
  
  // Handle playlist changes
  useEffect(() => {
    if (playbackEngineRef.current) {
      playbackEngineRef.current.updatePlaylist(playlist);
      
      // Update empty state
      setIsEmpty(playlist.length === 0);
      
      // Cache playlist for offline use
      cacheStorage.cachePlaylist(playlist).catch(err => {
        console.warn('Failed to cache playlist:', err);
      });
    }
  }, [playlist]);
  
  // Handle playback state changes
  const handlePlaybackStateChange = (state: PlaybackState) => {
    // Update local state
    setCurrentContent(state.currentContent);
    setNextContent(state.nextContent);
    setIsEmpty(state.isEmpty);
    
    // Trigger transition animation if needed
    if (state.status === 'transitioning' && state.currentContent) {
      setIsTransitioning(true);
      setTimeout(() => {
        setIsTransitioning(false);
      }, transitionDuration);
    }
    
    // Propagate state change to parent
    if (onPlaybackStateChange) {
      onPlaybackStateChange(state);
    }
  };
  
  // Handle content changes
  const handleContentChanged = (content: Content) => {
    // Clear any error state
    setError(null);
    
    // Start loading the new content
    loadContent(content);
  };
  
  // Handle empty playlist
  const handlePlaylistEmpty = () => {
    setIsEmpty(true);
    setCurrentContent(null);
    setNextContent(null);
    
    // Schedule retry to check for content
    scheduleEmptyPlaylistRetry();
  };
  
  // Schedule retry for empty playlist
  const scheduleEmptyPlaylistRetry = () => {
    // Clear existing timer
    if (retryTimerId) {
      clearTimeout(retryTimerId);
    }
    
    // Schedule new retry
    const timerId = window.setTimeout(async () => {
      // Try to load cached playlist if available
      const cachedPlaylist = await cacheStorage.getCachedPlaylist();
      if (cachedPlaylist && cachedPlaylist.length > 0 && playbackEngineRef.current) {
        console.log('Loading cached playlist:', cachedPlaylist);
        playbackEngineRef.current.loadPlaylist(cachedPlaylist);
        playbackEngineRef.current.play();
        return;
      }
      
      // Schedule another retry
      scheduleEmptyPlaylistRetry();
    }, 30000); // Retry every 30 seconds
    
    setRetryTimerId(timerId);
  };
  
  // Handle content errors
  const handleContentError = ({ contentId, error }: { contentId: string; error: Error }) => {
    console.error(`Error loading content ${contentId}:`, error);
    setError(error);
    
    // Propagate error to parent
    if (onError) {
      onError(error);
    }
    
    // Try to load from cache
    tryLoadContentFromCache(contentId);
  };
  
  // Try to load content from cache
  const tryLoadContentFromCache = async (contentId: string) => {
    try {
      // Get content from cache
      const content = await cacheStorage.getContent(contentId);
      if (!content) {
        console.warn(`No cached content found for ${contentId}`);
        return;
      }
      
      // Get cached asset for the content
      const asset = await cacheStorage.getAssetForContent(contentId);
      if (!asset) {
        console.warn(`No cached asset found for ${contentId}`);
        return;
      }
      
      // Create content with cached asset URL
      const cachedContent = {
        ...content,
        url: asset.url
      };
      
      // Load the cached content
      loadContent(cachedContent);
      
      console.log(`Loaded cached content for ${contentId}`);
    } catch (err) {
      console.error(`Failed to load cached content for ${contentId}:`, err);
    }
  };
  
  // Handle content preloading
  const handlePreloadContent = (targets: Content[]) => {
    if (!preloadManagerRef.current) return;
    
    preloadManagerRef.current.preloadAssets(targets);
  };
  
  // Handle asset preloaded
  const handleAssetPreloaded = (status: any) => {
    console.log(`Asset preloaded for ${status.contentId}`);
    
    // Cache the asset for offline use if it's a blob
    if (status.element && (status.type === 'image' || status.type === 'video')) {
      const element = status.element as HTMLImageElement | HTMLVideoElement;
      
      // Fetch the asset and cache it
      fetch(status.url)
        .then(response => response.blob())
        .then(blob => {
          cacheStorage.cacheAsset(
            status.contentId,
            blob,
            status.url,
            status.type === 'image' ? 'image/jpeg' : 'video/mp4'
          ).catch(err => {
            console.warn(`Failed to cache asset for ${status.contentId}:`, err);
          });
        })
        .catch(err => {
          console.warn(`Failed to fetch asset for caching ${status.contentId}:`, err);
        });
    }
  };
  
  // Handle asset preload error
  const handleAssetPreloadError = (status: any) => {
    console.warn(`Failed to preload asset for ${status.contentId}:`, status.error);
  };
  
  // Load content
  const loadContent = (content: Content) => {
    // Mark content as loading
    if (playbackEngineRef.current) {
      // Use preloaded asset if available
      if (preloadManagerRef.current?.isPreloaded(content.id)) {
        const preloadedAsset = preloadManagerRef.current.getPreloadedAsset(content.id);
        if (preloadedAsset) {
          console.log(`Using preloaded asset for ${content.id}`);
          
          // Clone the element to avoid issues with the preloaded element
          if (content.type === 'image' && preloadedAsset instanceof HTMLImageElement) {
            const img = new Image();
            img.src = preloadedAsset.src;
            img.onload = () => {
              playbackEngineRef.current?.markContentLoaded(content.id);
            };
            img.onerror = (e) => {
              playbackEngineRef.current?.markContentError(content.id, new Error('Failed to load image'));
            };
          } else if (content.type === 'video' && preloadedAsset instanceof HTMLVideoElement) {
            const video = document.createElement('video');
            video.src = preloadedAsset.src;
            video.oncanplaythrough = () => {
              playbackEngineRef.current?.markContentLoaded(content.id);
            };
            video.onerror = () => {
              playbackEngineRef.current?.markContentError(content.id, new Error('Failed to load video'));
            };
            video.load();
          }
        }
      }
    }
  };
  
  // Handle content successfully loaded
  const handleContentLoaded = (contentId: string) => {
    if (playbackEngineRef.current) {
      playbackEngineRef.current.markContentLoaded(contentId);
    }
  };
  
  // Handle content load error
  const handleContentLoadError = (contentId: string, error: Error) => {
    if (playbackEngineRef.current) {
      playbackEngineRef.current.markContentError(contentId, error);
    }
  };
  
  // Render content based on type
  const renderContent = (content: Content | null, isNext: boolean = false) => {
    if (!content) {
      return null;
    }
    
    // Determine container class
    const containerClass = isNext
      ? 'content-item next-content'
      : 'content-item current-content';
    
    // Determine ref
    const containerRef = isNext ? nextContainerRef : currentContainerRef;
    
    // Render based on content type
    switch (content.type) {
      case 'image':
        return (
          <div className={containerClass} ref={containerRef}>
            <img
              ref={!isNext ? imageRef : undefined}
              src={content.url}
              alt={content.title || 'Image content'}
              onLoad={() => handleContentLoaded(content.id)}
              onError={() => handleContentLoadError(content.id, new Error('Failed to load image'))}
            />
          </div>
        );
        
      case 'video':
        return (
          <div className={containerClass} ref={containerRef}>
            <video
              ref={!isNext ? videoRef : undefined}
              src={content.url}
              autoPlay
              muted
              loop={false}
              playsInline
              onCanPlay={() => handleContentLoaded(content.id)}
              onError={() => handleContentLoadError(content.id, new Error('Failed to load video'))}
              onEnded={() => {
                if (playbackEngineRef.current) {
                  playbackEngineRef.current.emit('contentEnd');
                }
              }}
            />
          </div>
        );
        
      case 'webpage':
        return (
          <div className={containerClass} ref={containerRef}>
            <iframe
              ref={!isNext ? iframeRef : undefined}
              src={content.url}
              onLoad={() => handleContentLoaded(content.id)}
              onError={() => handleContentLoadError(content.id, new Error('Failed to load webpage'))}
              title={content.title || 'Web content'}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        );
        
      default:
        return (
          <div className={containerClass} ref={containerRef}>
            <div className="unsupported-content">
              <p>Unsupported content type: {content.type}</p>
            </div>
          </div>
        );
    }
  };
  
  // Render empty playlist state
  const renderEmptyState = () => {
    return (
      <div className="empty-playlist">
        <div className="empty-content">
          <h2>No Content Available</h2>
          <p>Waiting for content to be assigned to this display...</p>
          
          <div className="empty-animation">
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render error state
  const renderErrorState = () => {
    return (
      <div className="error-overlay">
        <div className="error-content">
          <h2>Content Error</h2>
          <p>{error?.message || 'Failed to load content'}</p>
          <button
            onClick={() => {
              setError(null);
              if (playbackEngineRef.current && currentContent) {
                // Try loading the content again
                loadContent(currentContent);
              } else if (playbackEngineRef.current) {
                // Advance to next content
                playbackEngineRef.current.advance();
              }
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  };
  
  // Main render method
  return (
    <div className={`display-renderer ${isTransitioning ? 'transitioning' : ''}`}>
      {isEmpty ? (
        renderEmptyState()
      ) : (
        <>
          {/* Current content */}
          {renderContent(currentContent)}
          
          {/* Next content (for transitions) */}
          {isTransitioning && renderContent(nextContent, true)}
          
          {/* Error overlay */}
          {error && renderErrorState()}
        </>
      )}
    </div>
  );
};

export default DisplayRenderer; 