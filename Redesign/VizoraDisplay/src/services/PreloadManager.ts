import { EventEmitter } from '../utils/EventEmitter';
import { Content } from '../types';
import { indexedDBStorage } from './storage/indexedDBStorage';
import React from 'react'; // Import React for RefObject

export interface AssetLoadStatus {
  contentId: string;
  status: 'loading' | 'loaded' | 'error';
  error?: Error;
  url: string;
  element?: HTMLImageElement | HTMLVideoElement;
  type: 'image' | 'video' | 'other';
}

export interface PreloadOptions {
  maxConcurrent?: number;
  timeout?: number;
  imagePreload?: boolean;
  videoPreload?: boolean;
}

/**
 * PreloadManager handles asset preloading for images and videos
 */
export class PreloadManager extends EventEmitter {
  private preloadCache: Map<string, AssetLoadStatus> = new Map();
  private preloadQueue: Content[] = [];
  private activePreloads: number = 0;
  private abortControllers: Map<string, AbortController> = new Map();
  private options: Required<PreloadOptions>;
  private videoContainerRef: React.RefObject<HTMLDivElement>;
  
  constructor(options: PreloadOptions = {}) {
    super();
    
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 3,
      timeout: options.timeout ?? 30000, // 30 seconds
      imagePreload: options.imagePreload ?? true,
      videoPreload: options.videoPreload ?? true
    };
    
    this.videoContainerRef = React.createRef();
  }
  
  /**
   * Queue assets for preloading
   * @param content Array of content items to preload
   */
  preloadAssets(content: Content[]): void {
    if (!content || content.length === 0) return;
    
    // Add new items to queue
    content.forEach(item => {
      // Skip if already preloaded or in queue
      if (this.preloadCache.has(item.id) || this.preloadQueue.some(c => c.id === item.id)) {
        return;
      }
      
      // Determine if this content type should be preloaded
      if (this.shouldPreloadContentType(item)) {
        this.preloadQueue.push(item);
      }
    });
    
    // Start preloading process if not already at max concurrent
    this.processQueue();
  }
  
  /**
   * Determine if a content item should be preloaded
   */
  private shouldPreloadContentType(content: Content): boolean {
    // Only preload certain content types
    switch (content.type) {
      case 'image':
        return this.options.imagePreload;
      case 'video':
        return this.options.videoPreload;
      default:
        return false;
    }
  }
  
  /**
   * Process items in the preload queue
   */
  private processQueue(): void {
    if (this.preloadQueue.length === 0 || this.activePreloads >= this.options.maxConcurrent) {
      return;
    }
    
    // Get the next item from queue
    const nextItem = this.preloadQueue.shift();
    if (!nextItem) return;
    
    // Increment active preloads counter
    this.activePreloads++;
    
    // Start preloading
    this.preloadAsset(nextItem)
      .then(status => {
        // Preload complete
        this.preloadCache.set(nextItem.id, status);
        this.emit('assetPreloaded', status);
      })
      .catch(error => {
        // Preload failed
        const errorStatus: AssetLoadStatus = {
          contentId: nextItem.id,
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
          url: nextItem.url,
          type: this.getAssetType(nextItem)
        };
        
        this.preloadCache.set(nextItem.id, errorStatus);
        this.emit('assetPreloadError', errorStatus);
      })
      .finally(() => {
        // Decrement active preloads counter
        this.activePreloads--;
        
        // Remove abort controller
        this.abortControllers.delete(nextItem.id);
        
        // Continue processing queue
        this.processQueue();
      });
    
    // Process more items if we're still under the concurrency limit
    if (this.activePreloads < this.options.maxConcurrent) {
      this.processQueue();
    }
  }
  
  /**
   * Preload a specific asset
   */
  private async preloadAsset(content: Content): Promise<AssetLoadStatus> {
    const contentType = this.getAssetType(content);
    const url = content.url;
    
    // Create abort controller for this preload
    const abortController = new AbortController();
    this.abortControllers.set(content.id, abortController);
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.options.timeout);
    
    try {
      // Create loading status
      const loadingStatus: AssetLoadStatus = {
        contentId: content.id,
        status: 'loading',
        url,
        type: contentType
      };
      
      // Notify that preload has started
      this.emit('assetPreloadStarted', loadingStatus);
      
      switch (contentType) {
        case 'image':
          // Preload image
          const imageStatus = await this.preloadImage(url, abortController.signal);
          clearTimeout(timeoutId);
          
          return {
            contentId: content.id,
            status: 'loaded',
            url,
            element: imageStatus.element,
            type: 'image'
          };
          
        case 'video':
          // Preload video
          const videoStatus = await this.preloadVideo(url, abortController.signal);
          clearTimeout(timeoutId);
          
          return {
            contentId: content.id,
            status: 'loaded',
            url,
            element: videoStatus.element,
            type: 'video'
          };
          
        default:
          // Skip preloading for other types
          clearTimeout(timeoutId);
          return {
            contentId: content.id,
            status: 'loaded',
            url,
            type: 'other'
          };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  /**
   * Preload an image
   */
  private preloadImage(url: string, signal: AbortSignal): Promise<{ element: HTMLImageElement }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // Set up load and error handlers
      img.onload = () => {
        if (signal.aborted) return;
        resolve({ element: img });
      };
      
      img.onerror = (event) => {
        if (signal.aborted) return;
        reject(new Error(`Failed to load image: ${url}`));
      };
      
      // Handle abort signal
      signal.addEventListener('abort', () => {
        img.src = '';
        reject(new Error('Image preload aborted'));
      });
      
      // Start loading the image
      img.src = url;
      
      // If image is already cached and loaded, resolve immediately
      if (img.complete) {
        resolve({ element: img });
      }
    });
  }
  
  /**
   * Preload a video
   */
  private preloadVideo(url: string, signal: AbortSignal): Promise<{ element: HTMLVideoElement }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      
      // Configure video element for preloading
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      
      // Set up event handlers
      video.oncanplaythrough = () => {
        if (signal.aborted) return;
        
        // Pause the video if it's playing
        if (!video.paused) {
          video.pause();
        }
        
        resolve({ element: video });
      };
      
      video.onerror = () => {
        if (signal.aborted) return;
        reject(new Error(`Failed to load video: ${url}`));
      };
      
      // Handle abort signal
      signal.addEventListener('abort', () => {
        video.src = '';
        video.removeAttribute('src');
        video.load(); // Reset the video element
        reject(new Error('Video preload aborted'));
      });
      
      // Start loading the video
      video.src = url;
      video.load();
      
      // Try playing a small part of the video to force buffer loading
      // This helps with some video formats that don't buffer well with just .load()
      video.currentTime = 0;
      
      // Add to DOM and start playing
      if (this.videoContainerRef.current && video.parentNode !== this.videoContainerRef.current) {
        this.videoContainerRef.current.appendChild(video);
      }
      video.play();
      
      // Cleanup logic
      if (this.videoContainerRef.current && video && video.parentNode === this.videoContainerRef.current) {
        // Pause and remove video
        video.pause();
        if (this.videoContainerRef.current) {
          this.videoContainerRef.current.removeChild(video);
        }
      }
      resolve({ element: video });
    });
  }
  
  /**
   * Determine the asset type from content type
   */
  private getAssetType(content: Content): 'image' | 'video' | 'other' {
    switch (content.type) {
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      default:
        return 'other';
    }
  }
  
  /**
   * Check if an asset is preloaded
   * @param contentId ID of the content to check
   */
  isPreloaded(contentId: string): boolean {
    const status = this.preloadCache.get(contentId);
    return status?.status === 'loaded';
  }
  
  /**
   * Get a preloaded asset element
   * @param contentId ID of the content to get
   */
  getPreloadedAsset(contentId: string): HTMLElement | undefined {
    const status = this.preloadCache.get(contentId);
    return status?.element;
  }
  
  /**
   * Get all preloaded assets
   */
  getAllPreloadedAssets(): Map<string, AssetLoadStatus> {
    return new Map(this.preloadCache);
  }
  
  /**
   * Clear the preload cache
   */
  clearCache(): void {
    // Abort all ongoing preloads
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
    
    // Clear preload queue
    this.preloadQueue = [];
    
    // Clear cache
    this.preloadCache.clear();
    this.activePreloads = 0;
  }
  
  /**
   * Cancel preloading for a specific asset
   * @param contentId ID of the content to cancel
   */
  cancelPreload(contentId: string): boolean {
    // Check if item is in queue
    const queueIndex = this.preloadQueue.findIndex(item => item.id === contentId);
    if (queueIndex !== -1) {
      // Remove from queue
      this.preloadQueue.splice(queueIndex, 1);
      return true;
    }
    
    // Check if item is currently loading
    const controller = this.abortControllers.get(contentId);
    if (controller) {
      // Abort loading
      controller.abort();
      this.abortControllers.delete(contentId);
      return true;
    }
    
    return false;
  }
  
  /**
   * Get in-progress preload queue status
   */
  getQueueStatus(): { queued: number; active: number; completed: number } {
    return {
      queued: this.preloadQueue.length,
      active: this.activePreloads,
      completed: this.preloadCache.size
    };
  }
} 