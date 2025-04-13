/**
 * Content Caching Service
 * Provides intelligent caching of content and assets using IndexedDB
 */

import { v4 as uuidv4 } from 'uuid';
import { Content } from '@/services/contentService';
import { indexedDBStorage } from './indexedDBStorage';

// Constants
const LAST_SYNC_KEY = 'content_last_sync';
const CACHE_STATUS_KEY = 'cache_status';
const RECENTLY_VIEWED_KEY = 'recently_viewed_content';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const THUMBNAIL_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days for thumbnails
const MAX_RECENTLY_VIEWED = 50;

// Types
export interface CacheStatus {
  enabled: boolean;
  lastCleanup: number;
  totalSize: number;
  contentCount: number;
  binaryCount: number;
}

export interface CachingOptions {
  ttl?: number;
  priority?: 'high' | 'normal' | 'low';
  force?: boolean;
}

class CachingService {
  private enabled: boolean = true;
  private initialized: boolean = false;
  private initPromise: Promise<void>;
  private recentlyViewed: string[] = [];

  constructor() {
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the caching service
   */
  async initialize(): Promise<void> {
    try {
      // Get cache status
      const status = await indexedDBStorage.getMetadata<CacheStatus>(CACHE_STATUS_KEY);
      if (status) {
        this.enabled = status.enabled;
      } else {
        // Initialize cache status
        const stats = await indexedDBStorage.getStorageStats();
        const initialStatus: CacheStatus = {
          enabled: true,
          lastCleanup: Date.now(),
          totalSize: stats.totalSize,
          contentCount: stats.contentCount,
          binaryCount: stats.binaryCount
        };
        await indexedDBStorage.setMetadata(CACHE_STATUS_KEY, initialStatus);
      }

      // Get recently viewed content
      const recent = await indexedDBStorage.getMetadata<string[]>(RECENTLY_VIEWED_KEY);
      if (recent) {
        this.recentlyViewed = recent;
      }

      // Clean up expired content
      await indexedDBStorage.clearExpiredContent();

      this.initialized = true;
      console.log('Caching service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize caching service:', error);
      this.enabled = false;
    }
  }

  /**
   * Ensure the service is initialized before performing operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initPromise;
    }
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable caching
   */
  async setEnabled(enabled: boolean): Promise<void> {
    await this.ensureInitialized();
    this.enabled = enabled;

    // Update cache status
    const status = await indexedDBStorage.getMetadata<CacheStatus>(CACHE_STATUS_KEY) || {
      enabled: enabled,
      lastCleanup: Date.now(),
      totalSize: 0,
      contentCount: 0,
      binaryCount: 0
    };

    status.enabled = enabled;
    await indexedDBStorage.setMetadata(CACHE_STATUS_KEY, status);
  }

  /**
   * Get the cache status
   */
  async getCacheStatus(): Promise<CacheStatus> {
    await this.ensureInitialized();
    
    // Get current status
    const status = await indexedDBStorage.getMetadata<CacheStatus>(CACHE_STATUS_KEY);
    if (!status) {
      const stats = await indexedDBStorage.getStorageStats();
      const newStatus: CacheStatus = {
        enabled: this.enabled,
        lastCleanup: Date.now(),
        totalSize: stats.totalSize,
        contentCount: stats.contentCount,
        binaryCount: stats.binaryCount
      };
      await indexedDBStorage.setMetadata(CACHE_STATUS_KEY, newStatus);
      return newStatus;
    }

    // Update with latest stats
    const stats = await indexedDBStorage.getStorageStats();
    status.totalSize = stats.totalSize;
    status.contentCount = stats.contentCount;
    status.binaryCount = stats.binaryCount;
    
    await indexedDBStorage.setMetadata(CACHE_STATUS_KEY, status);
    return status;
  }

  /**
   * Set the last sync timestamp
   * @param timestamp Sync timestamp
   */
  async setLastSync(timestamp: number = Date.now()): Promise<void> {
    await this.ensureInitialized();
    await indexedDBStorage.setMetadata(LAST_SYNC_KEY, timestamp);
  }

  /**
   * Get the last sync timestamp
   * @returns Last sync timestamp or null if never synced
   */
  async getLastSync(): Promise<number | null> {
    await this.ensureInitialized();
    return indexedDBStorage.getMetadata<number>(LAST_SYNC_KEY);
  }

  /**
   * Cache content
   * @param content Content to cache
   * @param options Caching options
   */
  async cacheContent(content: Content, options: CachingOptions = {}): Promise<void> {
    await this.ensureInitialized();

    if (!this.enabled && !options.force) {
      return;
    }

    try {
      const ttl = options.ttl || DEFAULT_TTL;
      await indexedDBStorage.setContent(content.id, content, ttl);

      // Track as recently viewed
      this.trackRecentlyViewed(content.id);
    } catch (error) {
      console.error(`Failed to cache content ${content.id}:`, error);
    }
  }

  /**
   * Cache multiple content items
   * @param contentItems Array of content items to cache
   * @param options Caching options
   */
  async cacheMultipleContent(contentItems: Content[], options: CachingOptions = {}): Promise<void> {
    await this.ensureInitialized();

    if (!this.enabled && !options.force) {
      return;
    }

    try {
      const cachePromises = contentItems.map(content => 
        indexedDBStorage.setContent(content.id, content, options.ttl || DEFAULT_TTL)
      );
      await Promise.all(cachePromises);
    } catch (error) {
      console.error('Failed to cache multiple content items:', error);
    }
  }

  /**
   * Get content from cache
   * @param contentId Content ID
   * @returns Cached content or null if not found
   */
  async getContent(contentId: string): Promise<Content | null> {
    await this.ensureInitialized();

    if (!this.enabled) {
      return null;
    }

    try {
      const content = await indexedDBStorage.getContent(contentId);
      
      if (content) {
        // Update recently viewed
        this.trackRecentlyViewed(contentId);
      }
      
      return content;
    } catch (error) {
      console.error(`Failed to get content ${contentId} from cache:`, error);
      return null;
    }
  }

  /**
   * Check if content exists in cache
   * @param contentId Content ID
   * @returns True if content exists in cache
   */
  async hasContent(contentId: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.enabled) {
      return false;
    }

    try {
      return await indexedDBStorage.hasContent(contentId);
    } catch (error) {
      console.error(`Failed to check if content ${contentId} exists in cache:`, error);
      return false;
    }
  }

  /**
   * Remove content from cache
   * @param contentId Content ID
   */
  async removeContent(contentId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await indexedDBStorage.removeContent(contentId);
      
      // Remove from recently viewed if present
      this.recentlyViewed = this.recentlyViewed.filter(id => id !== contentId);
      await indexedDBStorage.setMetadata(RECENTLY_VIEWED_KEY, this.recentlyViewed);
    } catch (error) {
      console.error(`Failed to remove content ${contentId} from cache:`, error);
    }
  }

  /**
   * Cache binary asset (like thumbnails, preview images)
   * @param assetId Unique asset ID
   * @param contentId Related content ID
   * @param data Binary data
   * @param mimeType MIME type
   */
  async cacheBinaryAsset(
    assetId: string,
    contentId: string,
    data: ArrayBuffer,
    mimeType: string,
    ttl?: number
  ): Promise<void> {
    await this.ensureInitialized();

    if (!this.enabled) {
      return;
    }

    try {
      // Use longer TTL for thumbnails
      const effectiveTtl = ttl || 
        (mimeType.startsWith('image/') ? THUMBNAIL_TTL : DEFAULT_TTL);
      
      await indexedDBStorage.setBinaryAsset(assetId, contentId, data, mimeType, effectiveTtl);
    } catch (error) {
      console.error(`Failed to cache binary asset ${assetId}:`, error);
    }
  }

  /**
   * Get binary asset from cache
   * @param assetId Asset ID
   * @returns Binary asset data and MIME type, or null if not found
   */
  async getBinaryAsset(assetId: string): Promise<{ data: ArrayBuffer, mimeType: string } | null> {
    await this.ensureInitialized();

    if (!this.enabled) {
      return null;
    }

    try {
      return await indexedDBStorage.getBinaryAsset(assetId);
    } catch (error) {
      console.error(`Failed to get binary asset ${assetId} from cache:`, error);
      return null;
    }
  }

  /**
   * Cache a thumbnail for content
   * @param contentId Content ID
   * @param thumbnailUrl URL of the thumbnail
   */
  async cacheThumbnail(contentId: string, thumbnailUrl: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.enabled || !thumbnailUrl) {
      return;
    }

    try {
      // Generate asset ID for thumbnail
      const assetId = `thumbnail-${contentId}`;
      
      // Fetch the thumbnail
      const response = await fetch(thumbnailUrl);
      if (!response.ok) {
        console.error(`Failed to fetch thumbnail at ${thumbnailUrl}`);
        return;
      }
      
      const data = await response.arrayBuffer();
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      
      // Cache the thumbnail
      await this.cacheBinaryAsset(assetId, contentId, data, mimeType, THUMBNAIL_TTL);
    } catch (error) {
      console.error(`Failed to cache thumbnail for content ${contentId}:`, error);
    }
  }

  /**
   * Get a cached thumbnail
   * @param contentId Content ID
   * @returns Thumbnail data URL or null if not cached
   */
  async getCachedThumbnail(contentId: string): Promise<string | null> {
    await this.ensureInitialized();

    if (!this.enabled) {
      return null;
    }

    try {
      const assetId = `thumbnail-${contentId}`;
      const thumbnail = await this.getBinaryAsset(assetId);
      
      if (!thumbnail) {
        return null;
      }
      
      // Convert to data URL
      const blob = new Blob([thumbnail.data], { type: thumbnail.mimeType });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error(`Failed to get cached thumbnail for content ${contentId}:`, error);
      return null;
    }
  }

  /**
   * Track content as recently viewed
   * @param contentId Content ID
   */
  private async trackRecentlyViewed(contentId: string): Promise<void> {
    // Remove existing entry if present
    this.recentlyViewed = this.recentlyViewed.filter(id => id !== contentId);
    
    // Add to front of array
    this.recentlyViewed.unshift(contentId);
    
    // Trim if needed
    if (this.recentlyViewed.length > MAX_RECENTLY_VIEWED) {
      this.recentlyViewed = this.recentlyViewed.slice(0, MAX_RECENTLY_VIEWED);
    }
    
    // Update in storage
    await indexedDBStorage.setMetadata(RECENTLY_VIEWED_KEY, this.recentlyViewed);
  }

  /**
   * Get recently viewed content IDs
   * @returns Array of recently viewed content IDs
   */
  async getRecentlyViewedIds(): Promise<string[]> {
    await this.ensureInitialized();
    return [...this.recentlyViewed];
  }

  /**
   * Clear all cached content
   */
  async clearCache(): Promise<void> {
    await this.ensureInitialized();

    try {
      // Delete and recreate the database
      await indexedDBStorage.deleteDatabase();
      
      // Reset status
      const newStatus: CacheStatus = {
        enabled: this.enabled,
        lastCleanup: Date.now(),
        totalSize: 0,
        contentCount: 0,
        binaryCount: 0
      };
      
      await indexedDBStorage.setMetadata(CACHE_STATUS_KEY, newStatus);
      this.recentlyViewed = [];
      await indexedDBStorage.setMetadata(RECENTLY_VIEWED_KEY, this.recentlyViewed);
      
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const cachingService = new CachingService(); 