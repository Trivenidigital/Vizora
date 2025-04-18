// import { EventEmitter } from 'events';
import { EventEmitter } from '../utils/EventEmitter';
import type { Content, ContentSchedule as Schedule } from '@vizora/common/types';
import { indexedDBStorage } from './storage/indexedDBStorage';
import { networkStatus } from './networkStatus';

const CACHE_PREFIX = 'vizora_content_';
const CACHE_VERSION = '2';
const DEFAULT_PREFETCH_COUNT = 5;

/**
 * Enhanced ContentService with robust offline support and binary content caching
 */
export class ContentService extends EventEmitter {
  private cache: Map<string, Content> = new Map();
  private currentContent: Content | null = null;
  private nextContent: Content | null = null;
  private schedule: Schedule | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;
  private preloadTimeout: NodeJS.Timeout | null = null;
  private isLoading: boolean = false;
  private useIndexedDB: boolean = true; // Set to false to force localStorage
  private networkStatus: typeof networkStatus;
  private prefetchQueue: string[] = [];
  private isPrefetching: boolean = false;
  private maxConcurrentDownloads: number = 2;
  private activeDownloads: number = 0;
  private offlineMode: boolean = false;
  private diagnosticMode: boolean = false;
  private lastError: Error | null = null;

  constructor() {
    super();
    
    // Use the imported instance
    this.networkStatus = networkStatus;
    this.networkStatus.on('statusChange', this.handleNetworkStatusChange.bind(this));
    
    // Initialize storage system
    this.initializeStorage();
    
    // Set up regular expired content cleanup
    setInterval(() => {
      this.cleanupExpiredContent();
    }, 60 * 60 * 1000); // Run once per hour
    
    // Listen for content request errors
    this.on('error', (error: Error) => {
      this.lastError = error;
      console.error('ContentService error:', error);
    });
  }

  /**
   * Enable or disable diagnostic mode for debugging
   */
  setDiagnosticMode(enabled: boolean): void {
    this.diagnosticMode = enabled;
    if (enabled) {
      console.log('ContentService: Diagnostic mode enabled');
    }
  }

  /**
   * Log diagnostic information if diagnostic mode is enabled
   */
  private logDiagnostic(...args: any[]): void {
    if (this.diagnosticMode) {
      console.log(`[ContentService] ${new Date().toISOString()}:`, ...args);
    }
  }

  /**
   * Handle network status changes
   */
  private handleNetworkStatusChange(status: { online: boolean; type?: string; downlink?: number }): void {
    this.logDiagnostic('Network status change:', status);
    
    const wasOffline = this.offlineMode;
    this.offlineMode = !status.online;
    
    // If transitioning from offline to online, attempt to sync
    if (wasOffline && status.online) {
      this.logDiagnostic('Reconnected to network, syncing content');
      this.emit('network:reconnected');
      
      // Restart content loading if we were waiting
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
        this.loadNextContent().catch(error => {
          this.emit('error', error);
        });
      }
    } 
    // If transitioning to offline mode
    else if (!wasOffline && !status.online) {
      this.logDiagnostic('Network connection lost, switching to offline mode');
      this.emit('network:disconnected');
    }
    
    // Adjust prefetching behavior based on connection quality
    if (status.online && status.downlink) {
      // On slow connections, reduce concurrent downloads
      if (status.downlink < 1) { // Less than 1 Mbps
        this.maxConcurrentDownloads = 1;
      } else if (status.downlink < 5) { // Less than 5 Mbps
        this.maxConcurrentDownloads = 2;
      } else { // Good connection
        this.maxConcurrentDownloads = 3;
      }
      
      this.logDiagnostic(`Adjusted max concurrent downloads to ${this.maxConcurrentDownloads} based on downlink ${status.downlink} Mbps`);
    }
  }

  private async initializeStorage(): Promise<void> {
    try {
      // Feature detection for IndexedDB
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported by browser, falling back to localStorage');
        this.useIndexedDB = false;
        return;
      }
      
      // Wait for initialization and migrate if needed
      await this.migrateFromLocalStorageIfNeeded();
      
      // Store initial diagnostic data
      if (this.useIndexedDB) {
        try {
          const stats = await indexedDBStorage.getStorageStats();
          this.logDiagnostic('Storage initialized with stats:', stats);
          
          await indexedDBStorage.setMetadata('lastInitialized', {
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            version: CACHE_VERSION
          });
        } catch (err) {
          console.warn('Failed to store diagnostic data:', err);
        }
      }
    } catch (error) {
      console.error('Failed to initialize IndexedDB, falling back to localStorage:', error);
      this.useIndexedDB = false;
    }
  }
  
  private async migrateFromLocalStorageIfNeeded(): Promise<void> {
    try {
      if (!this.useIndexedDB) return;
      
      // Check for existing localStorage content
      const itemsToMigrate: { key: string; content: Content }[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const { version, data } = JSON.parse(cached);
              if (this.validateContent(data)) {
                const contentId = key.replace(CACHE_PREFIX, '');
                itemsToMigrate.push({ key, content: data });
              }
            }
          } catch (e) {
            console.error(`Failed to parse localStorage item ${key}:`, e);
          }
        }
      }
      
      if (itemsToMigrate.length > 0) {
        this.logDiagnostic(`Migrating ${itemsToMigrate.length} items from localStorage to IndexedDB`);
        
        // Migrate to IndexedDB
        for (const item of itemsToMigrate) {
          const contentId = item.key.replace(CACHE_PREFIX, '');
          await indexedDBStorage.setContent(contentId, item.content);
          
          // Remove from localStorage after successful migration
          localStorage.removeItem(item.key);
        }
        
        this.logDiagnostic('Migration from localStorage to IndexedDB complete');
      }
    } catch (error) {
      console.error('Failed to migrate content from localStorage:', error);
    }
  }
  
  private async cleanupExpiredContent(): Promise<void> {
    if (this.useIndexedDB) {
      try {
        await indexedDBStorage.clearExpiredContent();
        this.logDiagnostic('Expired content cleanup completed');
      } catch (error) {
        console.error('Failed to clean up expired content:', error);
      }
    }
  }

  /**
   * Start the content service with a schedule
   */
  public async start(schedule: Schedule): Promise<void> {
    this.schedule = schedule;
    this.logDiagnostic('ContentService started with schedule containing', schedule.items.length, 'items');
    
    // Prefetch upcoming content
    if (schedule.items.length > 1) {
      const upcomingContentIds = schedule.items
        .slice(0, Math.min(DEFAULT_PREFETCH_COUNT, schedule.items.length))
        .map((item: any) => item.contentId);
      
      this.queueContentForPrefetch(upcomingContentIds);
    }
    
    await this.loadNextContent();
  }

  /**
   * Stop the content service
   */
  public stop(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.preloadTimeout) {
      clearTimeout(this.preloadTimeout);
      this.preloadTimeout = null;
    }
    
    this.prefetchQueue = [];
    this.isPrefetching = false;
    this.logDiagnostic('ContentService stopped');
    
    this.removeAllListeners();
  }

  /**
   * Update the content schedule
   */
  public async updateSchedule(schedule: Schedule): Promise<void> {
    this.schedule = schedule;
    this.logDiagnostic('Schedule updated with', schedule.items.length, 'items');
    
    // Prefetch upcoming content
    if (schedule.items.length > 1) {
      const upcomingContentIds = schedule.items
        .slice(0, Math.min(DEFAULT_PREFETCH_COUNT, schedule.items.length))
        .map((item: any) => item.contentId);
      
      this.queueContentForPrefetch(upcomingContentIds);
    }
    
    await this.loadNextContent();
  }

  /**
   * Load the next content item from the schedule
   */
  private async loadNextContent(): Promise<void> {
    if (!this.schedule || this.schedule.items.length === 0 || this.isLoading) return;

    this.isLoading = true;
    const nextItem = this.schedule.items[0];
    
    try {
      let content: Content | null = null;
      this.logDiagnostic(`Loading content ${nextItem.contentId}, network status: ${this.networkStatus.isOnline() ? 'online' : 'offline'}`);

      // Try to get from cache first in offline mode
      if (!this.networkStatus.isOnline()) {
        content = await this.getCachedContent(nextItem.contentId);
        if (content) {
          this.logDiagnostic(`Loaded content ${nextItem.contentId} from cache in offline mode`);
          this.currentContent = content;
          this.emit('content:change', content);
          return;
        }
        
        const error = new Error(`No cached content available offline for ID: ${nextItem.contentId}`);
        this.emit('error', error);
        throw error;
      }

      // Try cache first even when online for faster loading
      content = await this.getCachedContent(nextItem.contentId);
      if (content) {
        this.logDiagnostic(`Using cached content ${nextItem.contentId} while fetching fresh copy`);
        this.currentContent = content;
        this.emit('content:change', content);
        
        // Fetch fresh copy in background
        this.refreshContentInBackground(nextItem.contentId).catch(err => {
          console.warn(`Background refresh failed for ${nextItem.contentId}:`, err);
        });
        
        return;
      }

      // Fetch from server if online and not in cache
      try {
      const response = await fetch(`/api/content/${nextItem.contentId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }
      content = await response.json();
      
      // Validate content
      if (!this.validateContent(content)) {
          throw new Error(`Invalid content data for ID: ${nextItem.contentId}`);
      }

      // Cache content for offline mode
        await this.cacheContent(content);
        
        // Fetch and cache binary assets if applicable
        if (content && (content.type === 'image' || content.type === 'video')) {
          this.fetchAndCacheBinaryAsset(content).catch(err => {
            const errorMsg = content ? `Failed to cache binary asset for ${content.id}:` : 'Failed to cache binary asset (content was null):';
            console.warn(errorMsg, err);
          });
        }

      // Update current content
      this.currentContent = content;
      this.emit('content:change', content);
        this.logDiagnostic(`Successfully loaded content ${nextItem.contentId} from server`);

      } catch (fetchError) {
        console.error(`Failed to fetch content ${nextItem.contentId}:`, fetchError);
        
        // Try cache as fallback if fetch fails
        content = await this.getCachedContent(nextItem.contentId);
        if (content) {
          this.logDiagnostic(`Falling back to cached content ${nextItem.contentId} after fetch failure`);
          this.currentContent = content;
          this.emit('content:change', content);
          return;
        }
        
        throw fetchError;
      }

      if (nextItem?.startTime) {
        try {
          const nextStart = new Date(nextItem.startTime); // Attempt date creation
          if (isNaN(nextStart.getTime())) { // Check if valid
            throw new Error("Invalid start date for next item"); 
          }
          // <<< Proceed only if date is valid >>>
          const now = Date.now(); 
          const delay = nextStart.getTime() - now;
          
          if (delay > 0) {
            this.playbackTimer = setTimeout(() => this.startPlayback(), delay); 
            const preloadDelay = Math.max(0, delay - 30000);
            this.clearPreloadTimeout(); 
            this.preloadTimeout = setTimeout(() => {
              if (nextItem?.contentId) { 
                this.preloadContent([nextItem.contentId]);
              }
            }, preloadDelay);
          } else {
            if (nextItem?.contentId) {
              this.preloadContent([nextItem.contentId]);
            }
          }
        } catch (e) {
           console.error('Error processing nextItem.startTime:', nextItem.startTime, e);
        }
      }
    } catch (error) {
      console.error('Failed to load content:', error);
      this.emit('error', error as Error);
      this.handleError(error as Error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Validate content object
   */
  private validateContent(content: any): content is Content {
    return (
      content &&
      typeof content.id === 'string' &&
      typeof content.type === 'string' &&
      typeof content.url === 'string' &&
      typeof content.duration === 'number'
    );
  }

  /**
   * Refresh content in the background
   */
  private async refreshContentInBackground(contentId: string): Promise<void> {
    try {
      this.logDiagnostic(`Background refresh for content ${contentId}`);
      const response = await fetch(`/api/content/${contentId}?_t=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`Background refresh failed: ${response.statusText}`);
      }
      
      const freshContent = await response.json();
      
      if (!this.validateContent(freshContent)) {
        throw new Error('Invalid content data from refresh');
      }
      
      // Check if content has changed
      const cachedContent = await this.getCachedContent(contentId);
      const hasChanged = !cachedContent || 
        JSON.stringify(cachedContent) !== JSON.stringify(freshContent);
        
      if (hasChanged) {
        this.logDiagnostic(`Content ${contentId} has changed, updating cache`);
        await this.cacheContent(freshContent);
        
        // If this is the current content, update it
        if (this.currentContent && this.currentContent.id === contentId) {
          this.currentContent = freshContent;
          this.emit('content:updated', freshContent);
        }
      } else {
        this.logDiagnostic(`Content ${contentId} unchanged`);
      }
    } catch (error) {
      console.warn(`Background refresh error for ${contentId}:`, error);
    }
  }

  /**
   * Fetch and cache binary asset (like image or video) for a content item
   */
  private async fetchAndCacheBinaryAsset(content: Content): Promise<void> {
    if (!this.useIndexedDB) return; // Only available with IndexedDB
    
    try {
      // Skip if URL is not absolute or is a data URL
      if (!content.url.startsWith('http') || content.url.startsWith('data:')) {
        return;
      }
      
      // Generate asset ID
      const assetId = `asset-${content.id}`;
      
      // Skip if we already have this asset cached
      const existingAsset = await indexedDBStorage.getBinaryAsset(assetId);
      if (existingAsset) {
        this.logDiagnostic(`Binary asset for ${content.id} already cached`);
        return;
      }
      
      this.logDiagnostic(`Fetching binary asset for ${content.id}: ${content.url}`);
      
      // Fetch the binary data
      const response = await fetch(content.url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch asset: ${response.statusText}`);
      }
      
      // Get the binary data as ArrayBuffer
      const data = await response.arrayBuffer();
      const mimeType = response.headers.get('content-type') || this.guessMimeType(content.url, content.type);
      
      // Store in IndexedDB
      await indexedDBStorage.setBinaryAsset(assetId, content.id, data, mimeType);
      
      this.logDiagnostic(`Cached binary asset for ${content.id} (${data.byteLength} bytes)`);
    } catch (error) {
      console.warn(`Failed to cache binary asset for ${content.id}:`, error);
    }
  }

  /**
   * Guess MIME type from URL and content type
   */
  private guessMimeType(url: string, contentType: string): string {
    // Extract extension from URL
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (extension) {
      const extensionMimeMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'm4a': 'audio/x-m4a',
        'pdf': 'application/pdf'
      };
      
      if (extension in extensionMimeMap) {
        return extensionMimeMap[extension];
      }
    }
    
    // Fallback based on content type
    const contentTypeMimeMap: Record<string, string> = {
      'image': 'image/jpeg',
      'video': 'video/mp4',
      'audio': 'audio/mpeg',
      'document': 'application/pdf'
    };
    
    return contentTypeMimeMap[contentType] || 'application/octet-stream';
  }

  /**
   * Get binary asset URL for content
   * This creates an object URL from a cached binary asset
   */
  public async getBinaryAssetUrl(contentId: string): Promise<string | null> {
    if (!this.useIndexedDB) return null;
    
    try {
      const assetId = `asset-${contentId}`;
      const asset = await indexedDBStorage.getBinaryAsset(assetId);
      
      if (!asset) {
        return null;
      }
      
      // Create a blob from the array buffer
      const blob = new Blob([asset.data], { type: asset.mimeType });
      
      // Create and return an object URL
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error(`Failed to get binary asset URL for ${contentId}:`, error);
      return null;
    }
  }

  /**
   * Cache content for offline mode
   */
  private async cacheContent(content: Content): Promise<void> {
    try {
      // First update memory cache
      this.cache.set(content.id, content);
      
      // Then persist to storage
      if (this.useIndexedDB) {
        await indexedDBStorage.setContent(content.id, content);
      } else {
        // Fallback to localStorage
      localStorage.setItem(
        `${CACHE_PREFIX}${content.id}`,
        JSON.stringify({
          version: CACHE_VERSION,
          data: content,
          timestamp: Date.now(),
        })
      );
      }
      
      this.logDiagnostic(`Cached content ${content.id}`);
    } catch (error) {
      console.error('Failed to cache content:', error);
    }
  }

  private async getCachedContent(contentId: string): Promise<Content | null> {
    try {
      // Check memory cache first
      if (this.cache.has(contentId)) {
        return this.cache.get(contentId)!;
      }

      // Check persistent cache
      if (this.useIndexedDB) {
        const content = await indexedDBStorage.getContent(contentId);
        if (content) {
          this.cache.set(contentId, content);
          return content;
        }
      } else {
        // Fallback to localStorage
      const cached = localStorage.getItem(`${CACHE_PREFIX}${contentId}`);
      if (cached) {
          try {
        const { version, data } = JSON.parse(cached);
            if (this.validateContent(data)) {
          this.cache.set(contentId, data);
          return data;
            }
          } catch (e) {
            console.error(`Failed to parse cached content ${contentId}:`, e);
          }
        }
      }
    } catch (error) {
      console.error('Failed to get cached content:', error);
    }
    return null;
  }

  private handleError(error: Error): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    // Determine retry delay based on network status
    const retryDelay = this.networkStatus.isOnline() ? 5000 : 15000;
    
    this.logDiagnostic(`Scheduling retry in ${retryDelay}ms after error: ${error.message}`);
    
    // Schedule retry
    this.retryTimeout = setTimeout(() => {
      this.loadNextContent().catch(err => {
        this.emit('error', err);
      });
    }, retryDelay);
  }

  /**
   * Get the current content
   */
  getCurrentContent(): Content | null {
    return this.currentContent;
  }

  /**
   * Get the next scheduled content
   */
  getNextContent(): Content | null {
    return this.nextContent;
  }

  /**
   * Get the last error that occurred
   */
  getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Get content by ID
   */
  async getContent(contentId: string): Promise<Content> {
    // Check memory cache first
    if (this.cache.has(contentId)) {
      return this.cache.get(contentId)!;
    }

    // Check persistent cache
    const cachedContent = await this.getCachedContent(contentId);
    if (cachedContent) {
      return cachedContent;
    }

    // Fetch from server if online
    if (this.networkStatus.isOnline()) {
      try {
      const response = await fetch(`/api/content/${contentId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }
      const content = await response.json();
      if (!this.validateContent(content)) {
        throw new Error('Invalid content data');
      }
        
      this.cache.set(contentId, content);
        await this.cacheContent(content);
        
        // Fetch and cache binary assets if applicable
        if (content && (content.type === 'image' || content.type === 'video')) {
          this.fetchAndCacheBinaryAsset(content).catch(err => {
            const errorMsg = content ? `Failed to cache binary asset for ${content.id}:` : 'Failed to cache binary asset (content was null):';
            console.warn(errorMsg, err);
          });
        }
        
      return content;
      } catch (error) {
        console.error(`Failed to fetch content ${contentId}:`, error);
        throw error;
      }
    }

    // If offline and no cache, throw error
    throw new Error(`Content ${contentId} not available offline`);
  }

  /**
   * Queue content for prefetching
   */
  async queueContentForPrefetch(contentIds: string[]): Promise<void> {
    // Add unique content IDs to the prefetch queue
    const newIds = contentIds.filter(id => 
      !this.prefetchQueue.includes(id) && 
      !this.cache.has(id)
    );
    
    if (newIds.length === 0) return;
    
    this.logDiagnostic(`Queueing ${newIds.length} items for prefetch`);
    this.prefetchQueue.push(...newIds);
    
    // Start prefetching if not already in progress
    if (!this.isPrefetching) {
      this.startPrefetching();
    }
  }

  /**
   * Start the prefetching process
   */
  private async startPrefetching(): Promise<void> {
    if (this.isPrefetching || this.prefetchQueue.length === 0 || !this.networkStatus.isOnline()) {
      return;
    }
    
    this.isPrefetching = true;
    this.logDiagnostic(`Starting prefetch of ${this.prefetchQueue.length} items`);
    
    while (this.prefetchQueue.length > 0 && this.networkStatus.isOnline()) {
      // Only prefetch if we haven't reached the concurrent download limit
      if (this.activeDownloads >= this.maxConcurrentDownloads) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      
      const contentId = this.prefetchQueue.shift();
      if (!contentId) continue;
      
      // Skip if already in memory cache
      if (this.cache.has(contentId)) continue;
      
      this.activeDownloads++;
      
      // Prefetch in the background
      this.prefetchContent(contentId)
        .catch(error => {
          console.warn(`Prefetch failed for ${contentId}:`, error);
        })
        .finally(() => {
          this.activeDownloads--;
        });
    }
    
    this.isPrefetching = false;
    this.logDiagnostic('Prefetching complete or paused');
  }

  /**
   * Prefetch a specific content
   */
  private async prefetchContent(contentId: string): Promise<void> {
    try {
      this.logDiagnostic(`Prefetching content ${contentId}`);
      
      // Skip if already in cache
      const cachedContent = await this.getCachedContent(contentId);
      if (cachedContent) {
        this.logDiagnostic(`Content ${contentId} already in cache, skipping prefetch`);
        return;
      }
      
      // Fetch content
      const content = await this.getContent(contentId);
      
      // Emit prefetch success event
      this.emit('content:prefetched', {
        contentId,
        success: true
      });
    } catch (error) {
      this.logDiagnostic(`Prefetch failed for ${contentId}:`, error);
      
      // Emit prefetch error event
      this.emit('content:prefetched', {
        contentId,
        success: false,
        error
      });
      
      throw error;
    }
  }

  /**
   * Preload a batch of content
   */
  async preloadContent(contentIds: string[]): Promise<void> {
    // Add to prefetch queue with high priority
    await this.queueContentForPrefetch(contentIds);
  }

  /**
   * Clear all cached content
   */
  async clearCache(): Promise<void> {
    this.logDiagnostic('Clearing all cached content');
    this.cache.clear();
    
    if (this.useIndexedDB) {
      try {
        await indexedDBStorage.clearAllContent();
      } catch (error) {
        console.error('Failed to clear IndexedDB cache:', error);
      }
    }
    
    // Also clear localStorage for completeness
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
    
    this.emit('cache:cleared');
  }
  
  /**
   * Get statistics about cached content
   */
  async getCacheStats(): Promise<{ 
    memoryItems: number; 
    persistentItems: number;
    totalSize?: number;
    binaryAssets?: number;
  }> {
    const memoryItems = this.cache.size;
    let persistentItems = 0;
    let totalSize = undefined;
    let binaryAssets = undefined;
    
    if (this.useIndexedDB) {
      try {
        const stats = await indexedDBStorage.getStorageStats();
        persistentItems = stats.contentCount;
        totalSize = stats.totalSize;
        binaryAssets = stats.binaryCount;
      } catch (error) {
        console.error('Failed to get IndexedDB stats:', error);
      }
    } else {
      // Count localStorage items
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          persistentItems++;
        }
      }
    }
    
    return {
      memoryItems,
      persistentItems,
      totalSize,
      binaryAssets
    };
  }

  private clearPreloadTimeout(): void {
     if (this.preloadTimeout) {
        clearTimeout(this.preloadTimeout);
        this.preloadTimeout = null;
     }
  }
} 