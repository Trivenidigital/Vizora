import { Content } from '../../types';

// Constants
const CONTENT_STORE_NAME = 'vizora-content';
const ASSET_STORE_NAME = 'vizora-assets';
const PLAYLIST_KEY = 'current-playlist';
const DB_VERSION = 1;
const DB_NAME = 'vizora-display-cache';

interface CachedAsset {
  id: string;
  contentId: string;
  data: Blob;
  url: string;
  type: string;
  timestamp: number;
  size: number;
}

interface CacheMetadata {
  lastUpdated: number;
  version: string;
  deviceId?: string;
}

/**
 * CacheStorage provides persistent caching of content and binary assets
 * using IndexedDB for offline support.
 */
export class CacheStorage {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<boolean> | null = null;
  private metadata: CacheMetadata = {
    lastUpdated: 0,
    version: '1.0'
  };

  /**
   * Initialize the cache storage
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    // If initialization already in progress, return the promise
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      try {
        // Check for IndexedDB support
        if (!window.indexedDB) {
          console.warn('IndexedDB is not supported in this browser');
          resolve(false);
          return;
        }
        
        // Open database
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        // Handle database upgrades/creation
        request.onupgradeneeded = (event) => {
          const db = request.result;
          
          // Create content store
          if (!db.objectStoreNames.contains(CONTENT_STORE_NAME)) {
            const contentStore = db.createObjectStore(CONTENT_STORE_NAME, { keyPath: 'id' });
            contentStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
          
          // Create asset store
          if (!db.objectStoreNames.contains(ASSET_STORE_NAME)) {
            const assetStore = db.createObjectStore(ASSET_STORE_NAME, { keyPath: 'id' });
            assetStore.createIndex('contentId', 'contentId', { unique: false });
            assetStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
          
          console.log('Cache database created/upgraded to version', DB_VERSION);
        };
        
        // Handle success
        request.onsuccess = (event) => {
          this.db = request.result;
          this.isInitialized = true;
          console.log('Cache database initialized successfully');
          
          // Load metadata
          this.loadMetadata().then(() => {
            resolve(true);
          }).catch(error => {
            console.warn('Failed to load cache metadata:', error);
            resolve(true);
          });
        };
        
        // Handle errors
        request.onerror = (event) => {
          console.error('Failed to initialize cache database:', request.error);
          resolve(false);
        };
      } catch (error) {
        console.error('Error initializing cache:', error);
        resolve(false);
      }
    });
    
    return this.initPromise;
  }
  
  /**
   * Load metadata from the cache
   */
  private async loadMetadata(): Promise<void> {
    try {
      const tx = this.getTransaction(CONTENT_STORE_NAME, 'readonly');
      if (!tx) throw new Error('Failed to create transaction');
      
      const store = tx.objectStore(CONTENT_STORE_NAME);
      const request = store.get('metadata');
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result) {
            this.metadata = request.result;
          }
          resolve();
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.warn('Failed to load cache metadata:', error);
      return Promise.resolve();
    }
  }
  
  /**
   * Save metadata to the cache
   */
  private async saveMetadata(): Promise<void> {
    try {
      const tx = this.getTransaction(CONTENT_STORE_NAME, 'readwrite');
      if (!tx) throw new Error('Failed to create transaction');
      
      const store = tx.objectStore(CONTENT_STORE_NAME);
      this.metadata.lastUpdated = Date.now();
      store.put({ id: 'metadata', ...this.metadata });
      
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.warn('Failed to save cache metadata:', error);
      return Promise.resolve();
    }
  }
  
  /**
   * Set device ID in metadata
   */
  async setDeviceId(deviceId: string): Promise<void> {
    if (!this.isInitialized && !(await this.initialize())) {
      return;
    }
    
    this.metadata.deviceId = deviceId;
    await this.saveMetadata();
  }
  
  /**
   * Get a transaction for a store
   */
  private getTransaction(storeName: string, mode: IDBTransactionMode): IDBTransaction | null {
    if (!this.db) return null;
    
    try {
      return this.db.transaction(storeName, mode);
    } catch (error) {
      console.error(`Failed to create transaction for store ${storeName}:`, error);
      return null;
    }
  }
  
  /**
   * Cache a playlist of content
   * @param playlist Array of content items
   */
  async cachePlaylist(playlist: Content[]): Promise<void> {
    if (!this.isInitialized && !(await this.initialize())) {
      return;
    }
    
    try {
      const tx = this.getTransaction(CONTENT_STORE_NAME, 'readwrite');
      if (!tx) throw new Error('Failed to create transaction');
      
      const store = tx.objectStore(CONTENT_STORE_NAME);
      
      // Save each content item
      for (const content of playlist) {
        // Add timestamp for cache management
        const contentWithTimestamp = {
          ...content,
          timestamp: Date.now()
        };
        
        store.put(contentWithTimestamp);
      }
      
      // Save the playlist itself
      store.put({
        id: PLAYLIST_KEY,
        items: playlist.map(item => item.id),
        timestamp: Date.now()
      });
      
      // Update metadata
      this.metadata.lastUpdated = Date.now();
      await this.saveMetadata();
      
      console.log(`Cached playlist with ${playlist.length} items`);
    } catch (error) {
      console.error('Failed to cache playlist:', error);
    }
  }
  
  /**
   * Get cached playlist
   */
  async getCachedPlaylist(): Promise<Content[] | null> {
    if (!this.isInitialized && !(await this.initialize())) {
      return null;
    }
    
    try {
      const tx = this.getTransaction(CONTENT_STORE_NAME, 'readonly');
      if (!tx) throw new Error('Failed to create transaction');
      
      const store = tx.objectStore(CONTENT_STORE_NAME);
      
      // Get playlist
      const playlistRequest = store.get(PLAYLIST_KEY);
      const playlist = await new Promise<{ items: string[] } | undefined>((resolve, reject) => {
        playlistRequest.onsuccess = () => resolve(playlistRequest.result);
        playlistRequest.onerror = () => reject(playlistRequest.error);
      });
      
      if (!playlist || !playlist.items || playlist.items.length === 0) {
        return null;
      }
      
      // Get content items
      const contentItems: Content[] = [];
      
      for (const contentId of playlist.items) {
        const contentRequest = store.get(contentId);
        const content = await new Promise<Content | undefined>((resolve, reject) => {
          contentRequest.onsuccess = () => resolve(contentRequest.result);
          contentRequest.onerror = () => reject(contentRequest.error);
        });
        
        if (content) {
          contentItems.push(content);
        }
      }
      
      if (contentItems.length === 0) {
        return null;
      }
      
      console.log(`Retrieved cached playlist with ${contentItems.length} items`);
      return contentItems;
    } catch (error) {
      console.error('Failed to get cached playlist:', error);
      return null;
    }
  }
  
  /**
   * Cache a binary asset
   * @param contentId ID of the content the asset belongs to
   * @param data Blob of the asset data
   * @param url Original URL of the asset
   * @param type MIME type of the asset
   */
  async cacheAsset(contentId: string, data: Blob, url: string, type: string): Promise<string | null> {
    if (!this.isInitialized && !(await this.initialize())) {
      return null;
    }
    
    try {
      const tx = this.getTransaction(ASSET_STORE_NAME, 'readwrite');
      if (!tx) throw new Error('Failed to create transaction');
      
      const store = tx.objectStore(ASSET_STORE_NAME);
      
      // Create unique ID for the asset
      const assetId = `asset-${contentId}-${Date.now()}`;
      
      // Create cached asset object
      const asset: CachedAsset = {
        id: assetId,
        contentId,
        data,
        url,
        type,
        timestamp: Date.now(),
        size: data.size
      };
      
      // Save asset
      const request = store.put(asset);
      
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      console.log(`Cached asset for content ${contentId} (${data.size} bytes)`);
      return assetId;
    } catch (error) {
      console.error('Failed to cache asset:', error);
      return null;
    }
  }
  
  /**
   * Get a cached asset by content ID
   * @param contentId ID of the content
   */
  async getAssetForContent(contentId: string): Promise<{ url: string, blob: Blob } | null> {
    if (!this.isInitialized && !(await this.initialize())) {
      return null;
    }
    
    try {
      const tx = this.getTransaction(ASSET_STORE_NAME, 'readonly');
      if (!tx) throw new Error('Failed to create transaction');
      
      const store = tx.objectStore(ASSET_STORE_NAME);
      const index = store.index('contentId');
      
      // Get all assets for this content (there could be multiple versions)
      const request = index.getAll(contentId);
      
      const assets = await new Promise<CachedAsset[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      
      if (assets.length === 0) {
        return null;
      }
      
      // Use the most recent one
      const asset = assets.sort((a, b) => b.timestamp - a.timestamp)[0];
      
      // Create object URL for the blob
      const url = URL.createObjectURL(asset.data);
      
      return { url, blob: asset.data };
    } catch (error) {
      console.error('Failed to get cached asset:', error);
      return null;
    }
  }
  
  /**
   * Get a cached content item
   * @param contentId ID of the content
   */
  async getContent(contentId: string): Promise<Content | null> {
    if (!this.isInitialized && !(await this.initialize())) {
      return null;
    }
    
    try {
      const tx = this.getTransaction(CONTENT_STORE_NAME, 'readonly');
      if (!tx) throw new Error('Failed to create transaction');
      
      const store = tx.objectStore(CONTENT_STORE_NAME);
      const request = store.get(contentId);
      
      const content = await new Promise<Content | undefined>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      return content || null;
    } catch (error) {
      console.error('Failed to get cached content:', error);
      return null;
    }
  }
  
  /**
   * Clear expired assets (older than maxAge milliseconds)
   * @param maxAge Maximum age in milliseconds, defaults to 7 days
   */
  async clearExpiredAssets(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    if (!this.isInitialized && !(await this.initialize())) {
      return 0;
    }
    
    try {
      const tx = this.getTransaction(ASSET_STORE_NAME, 'readwrite');
      if (!tx) throw new Error('Failed to create transaction');
      
      const store = tx.objectStore(ASSET_STORE_NAME);
      const index = store.index('timestamp');
      
      // Get all assets
      const request = index.openCursor();
      let deletedCount = 0;
      
      const now = Date.now();
      const cutoff = now - maxAge;
      
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = request.result;
          if (cursor) {
            const asset = cursor.value as CachedAsset;
            if (asset.timestamp < cutoff) {
              // Delete expired asset
              store.delete(asset.id);
              deletedCount++;
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        
        request.onerror = () => reject(request.error);
      });
      
      if (deletedCount > 0) {
        console.log(`Cleared ${deletedCount} expired assets`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Failed to clear expired assets:', error);
      return 0;
    }
  }
  
  /**
   * Get cache stats
   */
  async getCacheStats(): Promise<{
    contentItems: number;
    assets: number;
    totalSize: number;
    lastUpdated: number;
  }> {
    if (!this.isInitialized && !(await this.initialize())) {
      return {
        contentItems: 0,
        assets: 0,
        totalSize: 0,
        lastUpdated: 0
      };
    }
    
    try {
      // Get content count
      const contentTx = this.getTransaction(CONTENT_STORE_NAME, 'readonly');
      if (!contentTx) throw new Error('Failed to create transaction');
      
      const contentStore = contentTx.objectStore(CONTENT_STORE_NAME);
      const contentRequest = contentStore.count();
      
      const contentCount = await new Promise<number>((resolve, reject) => {
        contentRequest.onsuccess = () => resolve(contentRequest.result);
        contentRequest.onerror = () => reject(contentRequest.error);
      });
      
      // Get asset count and total size
      const assetTx = this.getTransaction(ASSET_STORE_NAME, 'readonly');
      if (!assetTx) throw new Error('Failed to create transaction');
      
      const assetStore = assetTx.objectStore(ASSET_STORE_NAME);
      const assetRequest = assetStore.getAll();
      
      const assets = await new Promise<CachedAsset[]>((resolve, reject) => {
        assetRequest.onsuccess = () => resolve(assetRequest.result || []);
        assetRequest.onerror = () => reject(assetRequest.error);
      });
      
      const assetCount = assets.length;
      const totalSize = assets.reduce((size, asset) => size + asset.size, 0);
      
      return {
        contentItems: contentCount,
        assets: assetCount,
        totalSize,
        lastUpdated: this.metadata.lastUpdated
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        contentItems: 0,
        assets: 0,
        totalSize: 0,
        lastUpdated: 0
      };
    }
  }
  
  /**
   * Clear entire cache
   */
  async clearCache(): Promise<void> {
    if (!this.isInitialized && !(await this.initialize())) {
      return;
    }
    
    try {
      // Clear content store
      const contentTx = this.getTransaction(CONTENT_STORE_NAME, 'readwrite');
      if (!contentTx) throw new Error('Failed to create transaction');
      
      const contentStore = contentTx.objectStore(CONTENT_STORE_NAME);
      contentStore.clear();
      
      // Clear asset store
      const assetTx = this.getTransaction(ASSET_STORE_NAME, 'readwrite');
      if (!assetTx) throw new Error('Failed to create transaction');
      
      const assetStore = assetTx.objectStore(ASSET_STORE_NAME);
      assetStore.clear();
      
      // Reset metadata
      this.metadata = {
        lastUpdated: Date.now(),
        version: this.metadata.version,
        deviceId: this.metadata.deviceId
      };
      
      await this.saveMetadata();
      
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      this.initPromise = null;
      console.log('Cache database connection closed');
    }
  }
}

// Export singleton instance
export const cacheStorage = new CacheStorage(); 