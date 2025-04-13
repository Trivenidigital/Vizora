/**
 * IndexedDB Storage Service for VizoraWeb
 * Provides a robust, offline-first storage solution with TTL support
 * Adapted from the VizoraDisplay implementation
 */

import { Content } from '@vizora/common';

// Constants
const DB_NAME = 'vizora_web_cache';
const DB_VERSION = 1;
const CONTENT_STORE = 'content';
const BINARY_STORE = 'binary_assets';
const META_STORE = 'metadata';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const MAX_BINARY_SIZE = 50 * 1024 * 1024; // 50MB limit for web

// Interface for cached content
interface CachedContent {
  id: string;
  content: Content;
  timestamp: number;
  expiresAt: number;
  accessed: number;
  hasBinaryAssets?: boolean;
}

// Interface for binary assets
interface BinaryAsset {
  id: string;
  contentId: string;
  data: ArrayBuffer;
  mimeType: string;
  size: number;
  timestamp: number;
  expiresAt: number;
}

// Interface for metadata
interface MetadataEntry {
  key: string;
  value: any;
  timestamp: number;
}

class IndexedDBStorage {
  private dbPromise: Promise<IDBDatabase>;
  private initialized: boolean = false;
  private connectionId: string;
  private retryAttempts: number = 0;
  private maxRetries: number = 3;

  constructor() {
    this.connectionId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.dbPromise = this.initDB();
  }

  /**
   * Initialize the IndexedDB database
   */
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Failed to open IndexedDB:', request.error);
        
        // Try with a clean database if version conflict
        if (request.error && request.error.name === 'VersionError' && this.retryAttempts < this.maxRetries) {
          this.retryAttempts++;
          console.warn(`Version conflict, attempting to delete and recreate database (attempt ${this.retryAttempts})`);
          this.deleteDatabase().then(() => {
            this.dbPromise = this.initDB();
            resolve(this.dbPromise);
          }).catch(error => {
            console.error('Failed to delete database:', error);
            reject(error);
          });
          return;
        }
        
        reject(request.error);
      };

      request.onsuccess = () => {
        const db = request.result;
        this.initialized = true;
        console.log(`IndexedDB connection established (${this.connectionId})`);
        
        // Handle connection errors
        db.onerror = (event) => {
          console.error('IndexedDB error:', (event.target as any).error);
        };
        
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create content store with indexes
        if (!db.objectStoreNames.contains(CONTENT_STORE)) {
          const store = db.createObjectStore(CONTENT_STORE, { keyPath: 'id' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('accessed', 'accessed', { unique: false });
          store.createIndex('hasBinaryAssets', 'hasBinaryAssets', { unique: false });
          console.log('Created content store in IndexedDB');
        }
        
        // Create binary assets store
        if (!db.objectStoreNames.contains(BINARY_STORE)) {
          const binaryStore = db.createObjectStore(BINARY_STORE, { keyPath: 'id' });
          binaryStore.createIndex('contentId', 'contentId', { unique: false });
          binaryStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          binaryStore.createIndex('size', 'size', { unique: false });
          console.log('Created binary assets store in IndexedDB');
        }
        
        // Create metadata store
        if (!db.objectStoreNames.contains(META_STORE)) {
          const metaStore = db.createObjectStore(META_STORE, { keyPath: 'key' });
          metaStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('Created metadata store in IndexedDB');
        }
      };
    });
  }

  /**
   * Delete the entire database (for troubleshooting and reset)
   */
  async deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      
      request.onerror = () => {
        reject(request.error);
      };
      
      request.onsuccess = () => {
        console.log('Database deleted successfully');
        this.initialized = false;
        resolve();
      };
    });
  }

  /**
   * Store content in IndexedDB with TTL
   * @param contentId Content identifier
   * @param content Content object to store
   * @param ttl Time to live in milliseconds (default 7 days)
   */
  async setContent(contentId: string, content: Content, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const db = await this.dbPromise;
      const timestamp = Date.now();
      const expiresAt = timestamp + ttl;

      const cachedContent: CachedContent = {
        id: contentId,
        content,
        timestamp,
        expiresAt,
        accessed: timestamp,
        hasBinaryAssets: false
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CONTENT_STORE, 'readwrite');
        const store = transaction.objectStore(CONTENT_STORE);

        transaction.oncomplete = () => {
          resolve();
        };
        
        transaction.onerror = () => {
          console.error('Failed to store content in IndexedDB:', transaction.error);
          reject(transaction.error);
        };
        
        store.put(cachedContent);
      });
    } catch (error) {
      console.error('Error storing content in IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Store a binary asset related to a content item
   * @param assetId Unique asset identifier
   * @param contentId Related content identifier
   * @param data Binary data as ArrayBuffer
   * @param mimeType MIME type of the asset
   * @param ttl Time to live in milliseconds (default to content TTL)
   */
  async setBinaryAsset(
    assetId: string,
    contentId: string,
    data: ArrayBuffer,
    mimeType: string,
    ttl: number = DEFAULT_TTL
  ): Promise<void> {
    try {
      if (data.byteLength > MAX_BINARY_SIZE) {
        throw new Error(`Binary asset exceeds maximum size (${data.byteLength} > ${MAX_BINARY_SIZE})`);
      }
      
      const db = await this.dbPromise;
      const timestamp = Date.now();
      const expiresAt = timestamp + ttl;

      const asset: BinaryAsset = {
        id: assetId,
        contentId,
        data,
        mimeType,
        size: data.byteLength,
        timestamp,
        expiresAt
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([BINARY_STORE, CONTENT_STORE], 'readwrite');
        
        transaction.oncomplete = () => {
          resolve();
        };
        
        transaction.onerror = () => {
          console.error('Failed to store binary asset in IndexedDB:', transaction.error);
          reject(transaction.error);
        };
        
        // Store the binary asset
        const binaryStore = transaction.objectStore(BINARY_STORE);
        binaryStore.put(asset);
        
        // Update the content record to indicate it has binary assets
        const contentStore = transaction.objectStore(CONTENT_STORE);
        const contentRequest = contentStore.get(contentId);
        
        contentRequest.onsuccess = () => {
          const content = contentRequest.result as CachedContent | undefined;
          if (content) {
            content.hasBinaryAssets = true;
            contentStore.put(content);
          }
        };
      });
    } catch (error) {
      console.error('Error storing binary asset in IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Get content from IndexedDB
   * @param contentId Content identifier
   * @returns Content object or null if not found
   */
  async getContent(contentId: string): Promise<Content | null> {
    try {
      const db = await this.dbPromise;
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CONTENT_STORE, 'readwrite');
        const store = transaction.objectStore(CONTENT_STORE);
        const request = store.get(contentId);
        
        request.onsuccess = () => {
          const cachedContent = request.result as CachedContent | undefined;
          
          if (!cachedContent) {
            resolve(null);
            return;
          }
          
          // Check if content has expired
          if (cachedContent.expiresAt < Date.now()) {
            // Schedule cleanup of expired content (but still return it for now)
            this.clearExpiredContent().catch(err => console.error('Failed to clear expired content:', err));
          }
          
          // Update the accessed timestamp
          cachedContent.accessed = Date.now();
          store.put(cachedContent);
          
          resolve(cachedContent.content);
        };
        
        request.onerror = () => {
          console.error('Failed to retrieve content from IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error retrieving content from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Get binary asset from IndexedDB
   * @param assetId Asset identifier
   * @returns Binary asset data or null if not found
   */
  async getBinaryAsset(assetId: string): Promise<{ data: ArrayBuffer, mimeType: string } | null> {
    try {
      const db = await this.dbPromise;
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(BINARY_STORE, 'readonly');
        const store = transaction.objectStore(BINARY_STORE);
        const request = store.get(assetId);
        
        request.onsuccess = () => {
          const asset = request.result as BinaryAsset | undefined;
          
          if (!asset) {
            resolve(null);
            return;
          }
          
          // Check if asset has expired
          if (asset.expiresAt < Date.now()) {
            // We'll return it anyway but schedule cleanup
            this.clearExpiredContent().catch(err => console.error('Failed to clear expired content:', err));
          }
          
          resolve({ data: asset.data, mimeType: asset.mimeType });
        };
        
        request.onerror = () => {
          console.error('Failed to retrieve binary asset from IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error retrieving binary asset from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Check if content exists in the cache
   * @param contentId Content identifier
   * @returns True if content exists and has not expired
   */
  async hasContent(contentId: string): Promise<boolean> {
    try {
      const db = await this.dbPromise;
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CONTENT_STORE, 'readonly');
        const store = transaction.objectStore(CONTENT_STORE);
        const request = store.get(contentId);
        
        request.onsuccess = () => {
          const cachedContent = request.result as CachedContent | undefined;
          
          if (!cachedContent) {
            resolve(false);
            return;
          }
          
          // Check if content has expired
          if (cachedContent.expiresAt < Date.now()) {
            resolve(false);
            return;
          }
          
          resolve(true);
        };
        
        request.onerror = () => {
          console.error('Failed to check content existence in IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error checking content existence in IndexedDB:', error);
      return false;
    }
  }

  /**
   * Remove content from IndexedDB
   * @param contentId Content identifier
   */
  async removeContent(contentId: string): Promise<void> {
    try {
      const db = await this.dbPromise;
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONTENT_STORE, BINARY_STORE], 'readwrite');
        
        transaction.oncomplete = () => {
          resolve();
        };
        
        transaction.onerror = () => {
          console.error('Failed to remove content from IndexedDB:', transaction.error);
          reject(transaction.error);
        };
        
        // First, get the content record to check if it has binary assets
        const contentStore = transaction.objectStore(CONTENT_STORE);
        const request = contentStore.get(contentId);
        
        request.onsuccess = () => {
          const cachedContent = request.result as CachedContent | undefined;
          
          // Delete the content record
          contentStore.delete(contentId);
          
          // If it has binary assets, need to find and delete them too
          if (cachedContent?.hasBinaryAssets) {
            const binaryStore = transaction.objectStore(BINARY_STORE);
            const binaryIndex = binaryStore.index('contentId');
            const binaryRequest = binaryIndex.getAll(contentId);
            
            binaryRequest.onsuccess = () => {
              const assets = binaryRequest.result as BinaryAsset[];
              
              assets.forEach(asset => {
                binaryStore.delete(asset.id);
              });
            };
          }
        };
      });
    } catch (error) {
      console.error('Error removing content from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Set metadata value
   * @param key Metadata key
   * @param value Metadata value
   */
  async setMetadata(key: string, value: any): Promise<void> {
    try {
      const db = await this.dbPromise;
      const timestamp = Date.now();
      
      const metadata: MetadataEntry = {
        key,
        value,
        timestamp
      };
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(META_STORE, 'readwrite');
        const store = transaction.objectStore(META_STORE);
        
        transaction.oncomplete = () => {
          resolve();
        };
        
        transaction.onerror = () => {
          console.error('Failed to store metadata in IndexedDB:', transaction.error);
          reject(transaction.error);
        };
        
        store.put(metadata);
      });
    } catch (error) {
      console.error('Error storing metadata in IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Get metadata value
   * @param key Metadata key
   * @returns Metadata value or null if not found
   */
  async getMetadata<T>(key: string): Promise<T | null> {
    try {
      const db = await this.dbPromise;
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(META_STORE, 'readonly');
        const store = transaction.objectStore(META_STORE);
        const request = store.get(key);
        
        request.onsuccess = () => {
          const metadata = request.result as MetadataEntry | undefined;
          
          if (!metadata) {
            resolve(null);
            return;
          }
          
          resolve(metadata.value as T);
        };
        
        request.onerror = () => {
          console.error('Failed to retrieve metadata from IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error retrieving metadata from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Clear all expired content from storage
   */
  async clearExpiredContent(): Promise<void> {
    try {
      const db = await this.dbPromise;
      const now = Date.now();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONTENT_STORE, BINARY_STORE], 'readwrite');
        
        transaction.oncomplete = () => {
          resolve();
        };
        
        transaction.onerror = () => {
          console.error('Failed to clear expired content from IndexedDB:', transaction.error);
          reject(transaction.error);
        };
        
        // Clear expired content
        const contentStore = transaction.objectStore(CONTENT_STORE);
        const contentIndex = contentStore.index('expiresAt');
        const contentRequest = contentIndex.openCursor(IDBKeyRange.upperBound(now));
        
        contentRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          
          if (cursor) {
            const content = cursor.value as CachedContent;
            console.log(`Clearing expired content: ${content.id}`);
            contentStore.delete(content.id);
            cursor.continue();
          }
        };
        
        // Clear expired binary assets
        const binaryStore = transaction.objectStore(BINARY_STORE);
        const binaryIndex = binaryStore.index('expiresAt');
        const binaryRequest = binaryIndex.openCursor(IDBKeyRange.upperBound(now));
        
        binaryRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          
          if (cursor) {
            const asset = cursor.value as BinaryAsset;
            console.log(`Clearing expired binary asset: ${asset.id}`);
            binaryStore.delete(asset.id);
            cursor.continue();
          }
        };
      });
    } catch (error) {
      console.error('Error clearing expired content from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Get total storage usage statistics
   * @returns Object with storage statistics
   */
  async getStorageStats(): Promise<{ contentCount: number, binaryCount: number, totalSize: number }> {
    try {
      const db = await this.dbPromise;
      
      const contentCount = await this.getStoreCount(CONTENT_STORE);
      const binaryCount = await this.getStoreCount(BINARY_STORE);
      const totalSize = await this.getBinaryStoreSize();
      
      return { contentCount, binaryCount, totalSize };
    } catch (error) {
      console.error('Error getting storage statistics:', error);
      return { contentCount: 0, binaryCount: 0, totalSize: 0 };
    }
  }
  
  /**
   * Get count of items in a store
   * @param storeName Store name
   * @returns Count of items
   */
  private async getStoreCount(storeName: string): Promise<number> {
    const db = await this.dbPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const countRequest = store.count();
      
      countRequest.onsuccess = () => {
        resolve(countRequest.result);
      };
      
      countRequest.onerror = () => {
        reject(countRequest.error);
      };
    });
  }
  
  /**
   * Get total size of binary assets
   * @returns Total size in bytes
   */
  private async getBinaryStoreSize(): Promise<number> {
    const db = await this.dbPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(BINARY_STORE, 'readonly');
      const store = transaction.objectStore(BINARY_STORE);
      const request = store.openCursor();
      let totalSize = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        
        if (cursor) {
          const asset = cursor.value as BinaryAsset;
          totalSize += asset.size;
          cursor.continue();
        } else {
          resolve(totalSize);
        }
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// Export a singleton instance
export const indexedDBStorage = new IndexedDBStorage(); 