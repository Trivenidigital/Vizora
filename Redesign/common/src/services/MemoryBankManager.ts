// import { EventEmitter } from 'events';

/**
 * Simple EventEmitter implementation compatible with both browser and Node.js environments
 */
class EventEmitter {
  private events: Record<string, Function[]> = {};

  /**
   * Register an event listener
   */
  on(event: string, listener: Function): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  /**
   * Remove an event listener
   */
  off(event: string, listener: Function): this {
    if (!this.events[event]) return this;
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  /**
   * Emit an event with data
   */
  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) return false;
    this.events[event].forEach(listener => listener(...args));
    return true;
  }

  /**
   * Register a one-time event listener
   */
  once(event: string, listener: Function): this {
    const onceListener = (...args: any[]) => {
      this.off(event, onceListener);
      listener(...args);
    };
    return this.on(event, onceListener);
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): this {
    if (event) {
      this.events[event] = [];
    } else {
      this.events = {};
    }
    return this;
  }
}

/**
 * Memory item metadata
 */
export interface MemoryItemMetadata {
  /**
   * When the item was created
   */
  createdAt: number;
  
  /**
   * When the item expires (unix timestamp)
   */
  expiresAt: number | null;
  
  /**
   * Whether this item is persistent across reloads
   */
  persistent: boolean;
  
  /**
   * Item category for grouping and bulk operations
   */
  category?: string;
  
  /**
   * Optional tags for filtering
   */
  tags?: string[];
}

/**
 * Stored memory item with value and metadata
 */
export interface MemoryItem<T = any> {
  /**
   * The stored value
   */
  value: T;
  
  /**
   * Item metadata
   */
  metadata: MemoryItemMetadata;
}

/**
 * Options for storing an item in memory
 */
export interface StoreOptions {
  /**
   * Time-to-live in milliseconds, after which the item expires
   * Set to null for no expiration
   */
  ttl?: number | null;
  
  /**
   * Whether to persist this item in storage
   */
  persistent?: boolean;
  
  /**
   * Item category for grouping and bulk operations
   */
  category?: string;
  
  /**
   * Optional tags for filtering
   */
  tags?: string[];
}

/**
 * Options for retrieving items from memory
 */
export interface RetrieveOptions {
  /**
   * Whether to return expired items
   */
  includeExpired?: boolean;
  
  /**
   * Automatically refresh TTL if accessed
   */
  refreshTtl?: boolean;
  
  /**
   * New TTL value when refreshing
   */
  newTtl?: number;
}

/**
 * Options for the MemoryBankManager
 */
export interface MemoryBankOptions {
  /**
   * Prefix for storage keys
   */
  storageKeyPrefix?: string;
  
  /**
   * How often to run garbage collection (in ms)
   */
  gcInterval?: number;
  
  /**
   * Default TTL if not specified (null = no expiry)
   */
  defaultTtl?: number | null;
  
  /**
   * Whether items are persistent by default
   */
  defaultPersistent?: boolean;
  
  /**
   * Maximum number of items to store in memory
   */
  maxItems?: number;
  
  /**
   * Storage implementation to use for persistence
   * Defaults to localStorage in browser or in-memory in Node
   */
  storage?: Storage;
  
  /**
   * Whether to enable debug logs
   */
  debug?: boolean;
}

/**
 * Memory bank statistics
 */
export interface MemoryStats {
  /**
   * Total number of items in memory
   */
  totalItems: number;
  
  /**
   * Number of persistent items
   */
  persistentItems: number;
  
  /**
   * Number of expired items not yet garbage collected
   */
  expiredItems: number;
  
  /**
   * Items grouped by category
   */
  categoryCounts: Record<string, number>;
  
  /**
   * Estimated memory usage in bytes (approximate)
   */
  estimatedMemoryUsage: number;
}

/**
 * MemoryBankManager for storing and retrieving application state
 * with persistence, expiry, and throttling capability
 */
export class MemoryBankManager extends EventEmitter {
  private items: Map<string, MemoryItem> = new Map();
  private options: Required<MemoryBankOptions>;
  private storage: Storage;
  private gcTimer: number | null = null;
  private memoryEstimate: number = 0;
  
  /**
   * Create a new MemoryBankManager
   */
  constructor(options: MemoryBankOptions = {}) {
    super();
    
    // --- ADDED: Early log
    console.log('[MemoryBankManager] Constructor started.');

    // Set default options
    this.options = {
      storageKeyPrefix: 'vizora_memory_',
      gcInterval: 60000, // Run GC every minute
      defaultTtl: null, // No expiry by default
      defaultPersistent: false,
      maxItems: 10000,
      storage: undefined as any,
      debug: false,
      ...options
    };
    
    // --- Determine storage implementation ---
    console.log('[MemoryBankManager] Determining storage...');
    if (options.storage) {
      this.storage = options.storage;
      this.log('Using provided storage implementation');
    } else if (typeof localStorage !== 'undefined') {
      this.log('localStorage seems defined, attempting test...');
      try {
        const testKey = `${this.options.storageKeyPrefix}__test`;
        localStorage.setItem(testKey, '__test__');
        localStorage.removeItem(testKey);
        this.storage = localStorage;
        this.log('Using localStorage for persistence');
      } catch (e) {
        // --- ADDED: Explicit catch log
        console.error('[MemoryBankManager] !!! Error testing/using localStorage:', e);
        this.log('localStorage is not available or usable, using memory fallback', e);
        // Memory-only storage fallback
        this.storage = {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0
        };
      }
    } else {
      this.log('localStorage not defined, using memory fallback');
      // Memory-only storage fallback
      this.storage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0
      };
    }
    console.log(`[MemoryBankManager] Storage determined. Using: ${this.storage === localStorage ? 'localStorage' : 'memory fallback'}`);
    // --- End storage determination ---

    // --- Load existing items from determined storage ---
    console.log('[MemoryBankManager] Attempting initFromStorage...');
    try {
      this.initFromStorage();
      console.log('[MemoryBankManager] initFromStorage completed successfully.');
    } catch(e) {
        // --- ADDED: Explicit catch log
        console.error('[MemoryBankManager] !!! CRITICAL ERROR during initFromStorage:', e);
        this.log('CRITICAL ERROR during initFromStorage', e);
        this.items.clear();
    }
    console.log('[MemoryBankManager] Finished initFromStorage block.');
    // --- End loading ---

    // Start garbage collection
    this.startGarbageCollection();
    
    this.log('MemoryBankManager initialized');
  }
  
  /**
   * Store an item in memory
   */
  public store<T>(key: string, value: T, options: StoreOptions = {}): void {
    // Prepare options
    const ttl = options.ttl ?? this.options.defaultTtl;
    const persistent = options.persistent ?? this.options.defaultPersistent;
    
    // Create metadata
    const now = Date.now();
    const metadata: MemoryItemMetadata = {
      createdAt: now,
      expiresAt: ttl ? now + ttl : null,
      persistent,
      category: options.category,
      tags: options.tags
    };
    
    // Store item
    const item: MemoryItem<T> = { value, metadata };
    this.items.set(key, item);
    
    // Update memory estimate
    this.updateMemoryEstimate();
    
    // Persist if needed
    if (persistent) {
      this.persistItem(key, item);
    }
    
    // Enforce max items limit
    this.enforceItemLimit();
    
    this.log(`Stored item: ${key}`, options);
    this.emit('item:stored', { key, metadata });
  }
  
  /**
   * Retrieve an item from memory
   */
  public retrieve<T>(key: string, options: RetrieveOptions = {}): T | null {
    const item = this.items.get(key) as MemoryItem<T> | undefined;
    
    // Return null if item doesn't exist
    if (!item) return null;
    
    // Check if expired
    const now = Date.now();
    const isExpired = item.metadata.expiresAt !== null && now > item.metadata.expiresAt;
    
    // Return null if expired and not including expired items
    if (isExpired && !options.includeExpired) {
      this.log(`Item expired: ${key}`);
      return null;
    }
    
    // Refresh TTL if needed
    if (options.refreshTtl && item.metadata.expiresAt !== null) {
      const newTtl = options.newTtl ?? (item.metadata.expiresAt - item.metadata.createdAt);
      item.metadata.expiresAt = now + newTtl;
      
      // Update persistence if needed
      if (item.metadata.persistent) {
        this.persistItem(key, item);
      }
      
      this.log(`Refreshed TTL for item: ${key}`, { newExpiresAt: item.metadata.expiresAt });
    }
    
    this.emit('item:accessed', { key, metadata: item.metadata });
    return item.value;
  }
  
  /**
   * Check if an item exists in memory
   */
  public has(key: string, includeExpired: boolean = false): boolean {
    const item = this.items.get(key);
    if (!item) return false;
    
    // Check if expired
    if (!includeExpired) {
      const now = Date.now();
      return item.metadata.expiresAt === null || now <= item.metadata.expiresAt;
    }
    
    return true;
  }
  
  /**
   * Remove an item from memory
   */
  public remove(key: string): boolean {
    const existed = this.items.has(key);
    
    if (existed) {
      // Remove from memory
      this.items.delete(key);
      
      // Remove from storage
      const storageKey = this.getStorageKey(key);
      try {
        this.storage.removeItem(storageKey);
      } catch (error) {
        this.log(`Error removing item from storage: ${key}`, error);
      }
      
      // Update memory estimate
      this.updateMemoryEstimate();
      
      this.log(`Removed item: ${key}`);
      this.emit('item:removed', { key });
    }
    
    return existed;
  }
  
  /**
   * Clear all items
   */
  public clear(options: { persistentOnly?: boolean; category?: string } = {}): void {
    const { persistentOnly, category } = options;
    const removedKeys: string[] = [];
    
    // Collect keys to remove
    for (const [key, item] of this.items.entries()) {
      if (persistentOnly && !item.metadata.persistent) continue;
      if (category && item.metadata.category !== category) continue;
      
      removedKeys.push(key);
    }
    
    // Remove collected items
    for (const key of removedKeys) {
      this.remove(key);
    }
    
    this.log(`Cleared items: ${removedKeys.length}`, options);
    this.emit('cleared', { count: removedKeys.length, options });
  }
  
  /**
   * Get all keys matching optional filter
   */
  public keys(filter?: { category?: string; tags?: string[]; persistentOnly?: boolean }): string[] {
    const keys: string[] = [];
    
    for (const [key, item] of this.items.entries()) {
      // Skip if not matching category
      if (filter?.category && item.metadata.category !== filter.category) continue;
      
      // Skip if not matching tags
      if (filter?.tags && filter.tags.length > 0) {
        if (!item.metadata.tags) continue;
        if (!filter.tags.every(tag => item.metadata.tags?.includes(tag))) continue;
      }
      
      // Skip if not persistent but persistentOnly is true
      if (filter?.persistentOnly && !item.metadata.persistent) continue;
      
      // Skip if expired
      const now = Date.now();
      if (item.metadata.expiresAt !== null && now > item.metadata.expiresAt) continue;
      
      keys.push(key);
    }
    
    return keys;
  }
  
  /**
   * Get memory stats
   */
  public getStats(): MemoryStats {
    const now = Date.now();
    let persistentItems = 0;
    let expiredItems = 0;
    const categoryCounts: Record<string, number> = {};
    
    // Count items by type
    for (const item of this.items.values()) {
      // Count persistent items
      if (item.metadata.persistent) {
        persistentItems++;
      }
      
      // Count expired items
      if (item.metadata.expiresAt !== null && now > item.metadata.expiresAt) {
        expiredItems++;
      }
      
      // Count by category
      const category = item.metadata.category || 'uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
    
    return {
      totalItems: this.items.size,
      persistentItems,
      expiredItems,
      categoryCounts,
      estimatedMemoryUsage: this.memoryEstimate
    };
  }
  
  /**
   * Update item TTL
   */
  public updateTtl(key: string, newTtl: number | null): boolean {
    const item = this.items.get(key);
    if (!item) return false;
    
    const now = Date.now();
    item.metadata.expiresAt = newTtl === null ? null : now + newTtl;
    
    // Update persistence if needed
    if (item.metadata.persistent) {
      this.persistItem(key, item);
    }
    
    this.log(`Updated TTL for item: ${key}`, { newExpiresAt: item.metadata.expiresAt });
    this.emit('item:updated', { key, metadata: item.metadata });
    
    return true;
  }
  
  /**
   * Run garbage collection
   */
  public runGarbageCollection(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    // Find expired items
    for (const [key, item] of this.items.entries()) {
      if (item.metadata.expiresAt !== null && now > item.metadata.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    // Remove expired items
    for (const key of expiredKeys) {
      this.remove(key);
    }
    
    if (expiredKeys.length > 0) {
      this.log(`Garbage collected ${expiredKeys.length} expired items`);
      this.emit('gc:run', { removedCount: expiredKeys.length });
    }
  }
  
  /**
   * Set persistence for an item
   */
  public setPersistent(key: string, persistent: boolean): boolean {
    const item = this.items.get(key);
    if (!item) return false;
    
    // Update persistence
    item.metadata.persistent = persistent;
    
    // Persist or remove from storage
    if (persistent) {
      this.persistItem(key, item);
    } else {
      const storageKey = this.getStorageKey(key);
      try {
        this.storage.removeItem(storageKey);
      } catch (error) {
        this.log(`Error removing item from storage: ${key}`, error);
      }
    }
    
    this.log(`Set persistence for item: ${key}`, { persistent });
    this.emit('item:updated', { key, metadata: item.metadata });
    
    return true;
  }
  
  /**
   * Dispose and clean up resources
   */
  public dispose(): void {
    // Stop garbage collection
    if (this.gcTimer !== null) {
      window.clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    
    // Clear memory
    this.items.clear();
    this.memoryEstimate = 0;
    
    this.log('MemoryBankManager disposed');
    this.emit('disposed');
  }
  
  /**
   * Initialize from storage
   */
  private initFromStorage(): void {
    try {
      // Get all storage keys
      const keys = this.getAllStorageKeys();
      
      // Load items from storage
      let loadedCount = 0;
      for (const storageKey of keys) {
        const key = this.getKeyFromStorageKey(storageKey);
        const json = this.storage.getItem(storageKey);
        
        if (json) {
          try {
            const item: MemoryItem = JSON.parse(json);
            
            // Skip if expired
            const now = Date.now();
            if (item.metadata.expiresAt !== null && now > item.metadata.expiresAt) {
              // Remove expired item from storage
              this.storage.removeItem(storageKey);
              continue;
            }
            
            // Store in memory
            this.items.set(key, item);
            loadedCount++;
          } catch (parseError) {
            this.log(`Error parsing item from storage: ${key}`, parseError);
          }
        }
      }
      
      // Update memory estimate
      this.updateMemoryEstimate();
      
      this.log(`Loaded ${loadedCount} items from storage`);
      this.emit('storage:loaded', { count: loadedCount });
    } catch (error) {
      this.log('Error initializing from storage', error);
    }
  }
  
  /**
   * Start garbage collection interval
   */
  private startGarbageCollection(): void {
    // Clear any existing timer
    if (this.gcTimer !== null) {
      window.clearInterval(this.gcTimer);
    }
    
    // Start new timer
    this.gcTimer = window.setInterval(() => {
      this.runGarbageCollection();
    }, this.options.gcInterval);
    
    this.log(`Started garbage collection (interval: ${this.options.gcInterval}ms)`);
  }
  
  /**
   * Persist an item to storage
   */
  private persistItem(key: string, item: MemoryItem): void {
    const storageKey = this.getStorageKey(key);
    
    try {
      const json = JSON.stringify(item);
      this.storage.setItem(storageKey, json);
    } catch (error) {
      this.log(`Error persisting item: ${key}`, error);
    }
  }
  
  /**
   * Get storage key for an item
   */
  private getStorageKey(key: string): string {
    return `${this.options.storageKeyPrefix}${key}`;
  }
  
  /**
   * Get original key from storage key
   */
  private getKeyFromStorageKey(storageKey: string): string {
    return storageKey.substring(this.options.storageKeyPrefix.length);
  }
  
  /**
   * Get all storage keys for this memory bank
   */
  private getAllStorageKeys(): string[] {
    const keys: string[] = [];
    const prefix = this.options.storageKeyPrefix;
    
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
    } catch (error) {
      this.log('Error getting storage keys', error);
    }
    
    return keys;
  }
  
  /**
   * Update estimated memory usage
   */
  private updateMemoryEstimate(): void {
    let estimate = 0;
    
    for (const [key, item] of this.items.entries()) {
      // Estimate key size
      estimate += key.length * 2; // UTF-16 characters = 2 bytes each
      
      // Estimate value size (very rough approximation)
      const valueSize = this.estimateObjectSize(item.value);
      estimate += valueSize;
      
      // Estimate metadata size
      estimate += 100; // Fixed overhead for metadata
    }
    
    this.memoryEstimate = estimate;
  }
  
  /**
   * Roughly estimate object size in bytes
   */
  private estimateObjectSize(obj: any): number {
    if (obj === null || obj === undefined) return 0;
    
    // Basic types
    if (typeof obj === 'boolean') return 4;
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'string') return obj.length * 2;
    
    // Arrays
    if (Array.isArray(obj)) {
      return obj.reduce((size, item) => size + this.estimateObjectSize(item), 0);
    }
    
    // Objects
    if (typeof obj === 'object') {
      let size = 0;
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          size += key.length * 2; // Key size
          size += this.estimateObjectSize(obj[key]); // Value size
        }
      }
      return size;
    }
    
    // Default
    return 8;
  }
  
  /**
   * Enforce maximum item limit
   */
  private enforceItemLimit(): void {
    if (this.items.size <= this.options.maxItems) return;
    
    // Sort items by priority (non-persistent, expired, oldest)
    const itemsToEvict: { key: string; priority: number }[] = [];
    const now = Date.now();
    
    for (const [key, item] of this.items.entries()) {
      let priority = 0;
      
      // Non-persistent items are first to go
      if (!item.metadata.persistent) priority += 100;
      
      // Expired items are next
      if (item.metadata.expiresAt !== null && now > item.metadata.expiresAt) priority += 50;
      
      // Older items go before newer ones
      priority += (now - item.metadata.createdAt) / (24 * 60 * 60 * 1000); // Age in days
      
      itemsToEvict.push({ key, priority });
    }
    
    // Sort by priority (highest first)
    itemsToEvict.sort((a, b) => b.priority - a.priority);
    
    // Remove excess items
    const excess = this.items.size - this.options.maxItems;
    const evicted = itemsToEvict.slice(0, excess).map(item => item.key);
    
    for (const key of evicted) {
      this.remove(key);
    }
    
    this.log(`Evicted ${evicted.length} items due to max limit`);
    this.emit('items:evicted', { count: evicted.length });
  }
  
  /**
   * Log message if debug is enabled
   */
  private log(message: string, data?: any): void {
    if (this.options.debug) {
      console.log(`[MemoryBank] ${message}`, data);
    }
  }
} 