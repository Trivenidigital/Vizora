/**
 * IndexedDB Storage Service
 * Provides a robust, offline-first storage solution with TTL support
 */

import { Content } from '@vizora/common/types';

// Constants
const DB_NAME = 'vizora_content_cache';
const DB_VERSION = 2; // Increasing version for binary content support
const CONTENT_STORE = 'content';
const BINARY_STORE = 'binary_assets'; // New store for binary assets
const META_STORE = 'metadata'; // Store for metadata
const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const MAX_BINARY_SIZE = 100 * 1024 * 1024; // 100MB limit

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
    this.connectionId = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
   * @param ttl Time to live in milliseconds (default 30 days)
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
        hasBinaryAssets: false // Will be updated if binary assets are added
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
   * Retrieve content from IndexedDB
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

        request.onerror = () => {
          console.error('Failed to get content from IndexedDB:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          const cachedContent = request.result as CachedContent | undefined;
          
          if (!cachedContent) {
            resolve(null);
            return;
          }

          const now = Date.now();
          
          // Check if content is expired
          if (cachedContent.expiresAt < now) {
            // Delete expired content
            const deleteRequest = store.delete(contentId);
            deleteRequest.onerror = () => {
              console.error('Failed to delete expired content:', deleteRequest.error);
            };
            
            // Also delete any related binary assets
            if (cachedContent.hasBinaryAssets) {
              this.deleteBinaryAssetsByContentId(contentId).catch(err => {
                console.error('Failed to clean up binary assets:', err);
              });
            }
            
            resolve(null);
            return;
          }

          // Update access time
          cachedContent.accessed = now;
          const updateRequest = store.put(cachedContent);
          updateRequest.onerror = () => {
            console.error('Failed to update content access time:', updateRequest.error);
          };

          resolve(cachedContent.content);
        };
      });
    } catch (error) {
      console.error('Error retrieving content from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Retrieve a binary asset related to content
   * @param assetId Binary asset identifier
   * @returns Binary asset data or null if not found
   */
  async getBinaryAsset(assetId: string): Promise<{ data: ArrayBuffer; mimeType: string } | null> {
    try {
      const db = await this.dbPromise;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(BINARY_STORE, 'readonly');
        const store = transaction.objectStore(BINARY_STORE);
        const request = store.get(assetId);

        request.onerror = () => {
          console.error('Failed to get binary asset from IndexedDB:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          const asset = request.result as BinaryAsset | undefined;
          
          if (!asset) {
            resolve(null);
            return;
          }

          // Check if asset is expired
          if (asset.expiresAt < Date.now()) {
            const deleteRequest = store.delete(assetId);
            deleteRequest.onerror = () => {
              console.error('Failed to delete expired binary asset:', deleteRequest.error);
            };
            resolve(null);
            return;
          }

          resolve({
            data: asset.data,
            mimeType: asset.mimeType
          });
        };
      });
    } catch (error) {
      console.error('Error retrieving binary asset from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Get all binary assets related to a content item
   * @param contentId Content identifier
   * @returns Array of asset IDs
   */
  async getBinaryAssetIds(contentId: string): Promise<string[]> {
    try {
      const db = await this.dbPromise;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(BINARY_STORE, 'readonly');
        const store = transaction.objectStore(BINARY_STORE);
        const index = store.index('contentId');
        const request = index.getAllKeys(IDBKeyRange.only(contentId));

        request.onerror = () => {
          console.error('Failed to get binary asset IDs from IndexedDB:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          const assetIds = request.result as string[];
          resolve(assetIds);
        };
      });
    } catch (error) {
      console.error('Error retrieving binary asset IDs from IndexedDB:', error);
      return [];
    }
  }

  /**
   * Store metadata in the database
   * @param key Metadata key
   * @param value Metadata value (must be serializable)
   */
  async setMetadata(key: string, value: any): Promise<void> {
    try {
      const db = await this.dbPromise;
      const timestamp = Date.now();

      const entry: MetadataEntry = {
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
        
        store.put(entry);
      });
    } catch (error) {
      console.error('Error storing metadata in IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Retrieve metadata from the database
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

        request.onerror = () => {
          console.error('Failed to get metadata from IndexedDB:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          const entry = request.result as MetadataEntry | undefined;
          
          if (!entry) {
            resolve(null);
            return;
          }

          resolve(entry.value);
        };
      });
    } catch (error) {
      console.error('Error retrieving metadata from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Delete content from IndexedDB
   * @param contentId Content identifier
   */
  async deleteContent(contentId: string): Promise<void> {
    try {
      const db = await this.dbPromise;

      // First check if content has binary assets
      const content = await this.getContent(contentId);
      if (content) {
        // Delete any binary assets first
        await this.deleteBinaryAssetsByContentId(contentId);
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CONTENT_STORE, 'readwrite');
        const store = transaction.objectStore(CONTENT_STORE);
        const request = store.delete(contentId);

        request.onerror = () => {
          console.error('Failed to delete content from IndexedDB:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve();
        };
      });
    } catch (error) {
      console.error('Error deleting content from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Delete binary assets by content ID
   * @param contentId Content identifier
   */
  private async deleteBinaryAssetsByContentId(contentId: string): Promise<void> {
    try {
      const db = await this.dbPromise;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(BINARY_STORE, 'readwrite');
        const store = transaction.objectStore(BINARY_STORE);
        const index = store.index('contentId');
        const request = index.openCursor(IDBKeyRange.only(contentId));
        
        request.onerror = () => {
          console.error('Failed to delete binary assets:', request.error);
          reject(request.error);
        };
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
    } catch (error) {
      console.error('Error deleting binary assets from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Clear all expired content
   */
  async clearExpiredContent(): Promise<void> {
    try {
      const db = await this.dbPromise;
      const now = Date.now();
      const deletedContentIds: string[] = [];

      // First, find and delete expired content
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(CONTENT_STORE, 'readwrite');
        const store = transaction.objectStore(CONTENT_STORE);
        const index = store.index('expiresAt');
        const range = IDBKeyRange.upperBound(now);
        
        const request = index.openCursor(range);
        
        request.onerror = () => {
          console.error('Failed to clear expired content:', request.error);
          reject(request.error);
        };
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          
          if (cursor) {
            const content = cursor.value as CachedContent;
            deletedContentIds.push(content.id);
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
      });

      // Then, delete all binary assets related to expired content
      if (deletedContentIds.length > 0) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(BINARY_STORE, 'readwrite');
          const store = transaction.objectStore(BINARY_STORE);
          const index = store.index('contentId');
          
          let processed = 0;
          
          deletedContentIds.forEach(contentId => {
            const range = IDBKeyRange.only(contentId);
            const cursorRequest = index.openCursor(range);
            
            cursorRequest.onerror = () => {
              console.error(`Failed to delete binary assets for content ${contentId}:`, cursorRequest.error);
              processed++;
              if (processed === deletedContentIds.length) {
                resolve();
              }
            };
            
            cursorRequest.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
              
              if (cursor) {
                cursor.delete();
                cursor.continue();
              } else {
                processed++;
                if (processed === deletedContentIds.length) {
                  resolve();
                }
              }
            };
          });
          
          // Handle empty case
          if (deletedContentIds.length === 0) {
            resolve();
          }
        });
      }
      
      // Also delete expired binary assets that might not be linked to content records
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(BINARY_STORE, 'readwrite');
        const store = transaction.objectStore(BINARY_STORE);
        const index = store.index('expiresAt');
        const range = IDBKeyRange.upperBound(now);
        
        const request = index.openCursor(range);
        
        request.onerror = () => {
          console.error('Failed to clear expired binary assets:', request.error);
          reject(request.error);
        };
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
      });

      console.log(`Cleaned up ${deletedContentIds.length} expired content items`);
    } catch (error) {
      console.error('Error clearing expired content from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Clear all content, regardless of expiration
   */
  async clearAllContent(): Promise<void> {
    try {
      const db = await this.dbPromise;

      // Clear content store
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(CONTENT_STORE, 'readwrite');
        const store = transaction.objectStore(CONTENT_STORE);
        const request = store.clear();

        request.onerror = () => {
          console.error('Failed to clear content store:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve();
        };
      });
      
      // Clear binary store
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(BINARY_STORE, 'readwrite');
        const store = transaction.objectStore(BINARY_STORE);
        const request = store.clear();

        request.onerror = () => {
          console.error('Failed to clear binary store:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve();
        };
      });
      
      console.log('Cleared all content from IndexedDB');
    } catch (error) {
      console.error('Error clearing all content from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Check if the database is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the total count of cached content items
   */
  async getContentCount(): Promise<number> {
    try {
      const db = await this.dbPromise;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CONTENT_STORE, 'readonly');
        const store = transaction.objectStore(CONTENT_STORE);
        const countRequest = store.count();

        countRequest.onerror = () => {
          console.error('Failed to count content items:', countRequest.error);
          reject(countRequest.error);
        };

        countRequest.onsuccess = () => {
          resolve(countRequest.result);
        };
      });
    } catch (error) {
      console.error('Error counting content items:', error);
      return 0;
    }
  }

  /**
   * Get storage usage stats
   */
  async getStorageStats(): Promise<{
    contentCount: number;
    binaryCount: number;
    totalSize: number;
    avgSize: number;
  }> {
    try {
      const db = await this.dbPromise;
      
      const contentCount = await this.getContentCount();
      
      // Count binary assets and get size
      const binaryStats = await new Promise<{ count: number; totalSize: number }>((resolve, reject) => {
        const transaction = db.transaction(BINARY_STORE, 'readonly');
        const store = transaction.objectStore(BINARY_STORE);
        const countRequest = store.count();
        let totalSize = 0;
        
        countRequest.onerror = () => {
          reject(countRequest.error);
        };
        
        countRequest.onsuccess = () => {
          const count = countRequest.result;
          
          // If no binary assets, return zeros
          if (count === 0) {
            resolve({ count: 0, totalSize: 0 });
            return;
          }
          
          // Calculate total size by iterating through assets
          const sizeIndex = store.index('size');
          const cursor = sizeIndex.openCursor();
          
          cursor.onerror = () => {
            reject(cursor.error);
          };
          
          cursor.onsuccess = (event) => {
            const cursorResult = (event.target as IDBRequest).result as IDBCursorWithValue;
            
            if (cursorResult) {
              const asset = cursorResult.value as BinaryAsset;
              totalSize += asset.size;
              cursorResult.continue();
            } else {
              resolve({ count, totalSize });
            }
          };
        };
      });
      
      return {
        contentCount,
        binaryCount: binaryStats.count,
        totalSize: binaryStats.totalSize,
        avgSize: binaryStats.count > 0 ? Math.round(binaryStats.totalSize / binaryStats.count) : 0
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        contentCount: 0,
        binaryCount: 0,
        totalSize: 0,
        avgSize: 0
      };
    }
  }
}

// Export singleton instance
export const indexedDBStorage = new IndexedDBStorage(); 