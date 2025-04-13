import React, { useEffect, useState, useCallback } from 'react';
import { Content, DisplayStatus } from '../types';
import DisplayRenderer from './DisplayRenderer';
import { PlaybackState } from '../services/PlaybackEngine';
import { cacheStorage } from '../services/storage/CacheStorage';
import { networkStatus } from '../services/networkStatus';

interface VizoraDisplayProps {
  deviceId?: string;
  apiUrl?: string;
  contentEndpoint?: string;
  autoAdvance?: boolean;
  transitionEffect?: 'none' | 'fade' | 'crossfade';
  transitionDuration?: number;
  retryInterval?: number;
  offlineMode?: boolean;
}

export const VizoraDisplay: React.FC<VizoraDisplayProps> = ({
  deviceId,
  apiUrl,
  contentEndpoint = '/api/displays/:id/content',
  autoAdvance = true,
  transitionEffect = 'fade',
  transitionDuration = 500,
  retryInterval = 30000,
  offlineMode = false
}) => {
  // State
  const [playlist, setPlaylist] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [displayStatus, setDisplayStatus] = useState<DisplayStatus | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [retryTimerId, setRetryTimerId] = useState<number | null>(null);
  
  // Store device ID in cache storage
  useEffect(() => {
    if (deviceId) {
      cacheStorage.setDeviceId(deviceId);
    }
  }, [deviceId]);
  
  // Handle network status changes
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network connection restored');
      setIsOnline(true);
      // Fetch latest content when connection is restored
      fetchContent();
    };
    
    const handleOffline = () => {
      console.log('Network connection lost');
      setIsOnline(false);
    };
    
    // Subscribe to network status events
    networkStatus.on('online', handleOnline);
    networkStatus.on('offline', handleOffline);
    
    // Initial fetch
    fetchContent();
    
    // Set up polling for content updates
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        fetchContent();
      }
    }, retryInterval);
    
    return () => {
      // Cleanup
      networkStatus.off('online', handleOnline);
      networkStatus.off('offline', handleOffline);
      clearInterval(intervalId);
      
      if (retryTimerId) {
        clearTimeout(retryTimerId);
      }
    };
  }, [deviceId, apiUrl, contentEndpoint, retryInterval]);
  
  // Fetch content from API
  const fetchContent = useCallback(async () => {
    if (!deviceId) {
      console.error('No device ID provided');
      setError(new Error('No device ID provided'));
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Construct API URL
      const url = `${apiUrl || ''}${contentEndpoint.replace(':id', deviceId)}`;
      console.log(`Fetching content from ${url}`);
      
      // Make the API request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch content');
      }
      
      // Update playlist
      const contentList = data.content || [];
      console.log(`Received ${contentList.length} content items`);
      
      // Cache the content for offline use
      cacheStorage.cachePlaylist(contentList).catch(err => {
        console.warn('Failed to cache playlist:', err);
      });
      
      setPlaylist(contentList);
      setError(null);
    } catch (err) {
      console.error('Error fetching content:', err);
      
      // Try to load cached content if online fetch fails
      if (!offlineMode) {
        tryLoadCachedContent();
      }
      
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, apiUrl, contentEndpoint, offlineMode]);
  
  // Try to load cached content
  const tryLoadCachedContent = useCallback(async () => {
    try {
      console.log('Trying to load cached content');
      
      const cachedPlaylist = await cacheStorage.getCachedPlaylist();
      
      if (cachedPlaylist && cachedPlaylist.length > 0) {
        console.log(`Loaded ${cachedPlaylist.length} items from cache`);
        setPlaylist(cachedPlaylist);
        setError(new Error('Using cached content (offline mode)'));
      } else {
        console.warn('No cached content available');
      }
    } catch (err) {
      console.error('Error loading cached content:', err);
    }
  }, []);
  
  // Handle playback state changes
  const handlePlaybackStateChange = (state: PlaybackState) => {
    setPlaybackState(state);
    
    // Schedule retry if playlist is empty
    if (state.isEmpty && !retryTimerId) {
      const timerId = window.setTimeout(() => {
        fetchContent();
      }, retryInterval);
      
      setRetryTimerId(timerId);
    }
  };
  
  // Handle playback errors
  const handlePlaybackError = (error: Error) => {
    console.error('Playback error:', error);
    setError(error);
  };
  
  // Force offline mode if specified
  useEffect(() => {
    if (offlineMode) {
      tryLoadCachedContent();
    }
  }, [offlineMode, tryLoadCachedContent]);
  
  // Render empty state (initial loading)
  if (isLoading && playlist.length === 0) {
    return (
      <div className="vizora-display loading">
        <div className="loading-spinner"></div>
        <p>Loading content...</p>
      </div>
    );
  }
  
  // Render display renderer
  return (
    <div className={`vizora-display ${!isOnline ? 'offline' : ''}`} data-testid="vizora-display">
      <DisplayRenderer
        playlist={playlist}
        autoAdvance={autoAdvance}
        transitionEffect={transitionEffect}
        transitionDuration={transitionDuration}
        onPlaybackStateChange={handlePlaybackStateChange}
        onError={handlePlaybackError}
      />
      
      {!isOnline && (
        <div className="offline-indicator">
          <span>Offline Mode</span>
        </div>
      )}
      
      {/* Display error toast if there's an error */}
      {error && (
        <div className="error-toast">
          <p>{error.message}</p>
        </div>
      )}
    </div>
  );
}; 