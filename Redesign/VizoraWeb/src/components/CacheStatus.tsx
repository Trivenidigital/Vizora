import React, { useState, useEffect } from 'react';
import { contentService } from '@vizora/common';
import { CacheStatus as CacheStatusType } from '@/services/storage';

interface CacheStatusProps {
  showControls?: boolean;
  className?: string;
}

const CacheStatus: React.FC<CacheStatusProps> = ({ showControls = true, className = '' }) => {
  const [cacheStatus, setCacheStatus] = useState<CacheStatusType | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load cache status
  const loadCacheStatus = async () => {
    try {
      const status = await contentService.getCacheStatus();
      setCacheStatus(status);
      
      const syncTime = await contentService.getLastSync?.() || null;
      setLastSync(syncTime);
    } catch (error) {
      console.error('Failed to load cache status:', error);
    }
  };

  // Toggle caching
  const toggleCaching = async () => {
    if (!cacheStatus) return;
    
    setIsLoading(true);
    try {
      await contentService.setCachingEnabled(!cacheStatus.enabled);
      await loadCacheStatus();
    } catch (error) {
      console.error('Failed to toggle caching:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear cache
  const clearCache = async () => {
    if (!confirm('Are you sure you want to clear the content cache? This will remove all cached content.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      await contentService.clearCache();
      await loadCacheStatus();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Load status on mount
  useEffect(() => {
    loadCacheStatus();
    
    // Reload status every minute
    const interval = setInterval(loadCacheStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!cacheStatus) {
    return (
      <div className={`bg-gray-100 rounded-md p-4 ${className}`}>
        <p className="text-gray-500">Loading cache status...</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-100 rounded-md p-4 ${className}`}>
      <h3 className="text-lg font-medium mb-2">Content Cache Status</h3>
      
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <p className="text-sm text-gray-500">Status:</p>
          <p className="font-medium">
            {cacheStatus.enabled ? (
              <span className="text-green-600">Enabled</span>
            ) : (
              <span className="text-red-600">Disabled</span>
            )}
          </p>
        </div>
        
        <div>
          <p className="text-sm text-gray-500">Last Cleanup:</p>
          <p className="font-medium">
            {formatDate(cacheStatus.lastCleanup)}
          </p>
        </div>
        
        <div>
          <p className="text-sm text-gray-500">Cached Items:</p>
          <p className="font-medium">{cacheStatus.contentCount}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-500">Binary Assets:</p>
          <p className="font-medium">{cacheStatus.binaryCount}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-500">Total Size:</p>
          <p className="font-medium">{formatSize(cacheStatus.totalSize)}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-500">Last Sync:</p>
          <p className="font-medium">
            {lastSync ? formatDate(lastSync) : 'Never'}
          </p>
        </div>
      </div>
      
      {showControls && (
        <div className="flex space-x-2">
          <button
            onClick={toggleCaching}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md text-white text-sm ${
              cacheStatus.enabled 
                ? 'bg-yellow-500 hover:bg-yellow-600' 
                : 'bg-green-500 hover:bg-green-600'
            } disabled:opacity-50`}
          >
            {cacheStatus.enabled ? 'Disable Caching' : 'Enable Caching'}
          </button>
          
          <button
            onClick={clearCache}
            disabled={isLoading || !cacheStatus.enabled}
            className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm disabled:opacity-50"
          >
            Clear Cache
          </button>
          
          <button
            onClick={loadCacheStatus}
            disabled={isLoading}
            className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};

export default CacheStatus; 