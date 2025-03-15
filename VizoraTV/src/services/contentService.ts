import { DisplayContent } from '../types';
import { websocketService } from './websocketService';

class ContentService {
  private currentContent: DisplayContent | null = null;
  private contentQueue: DisplayContent[] = [];
  private isPlaying: boolean = false;
  private currentTimeout: NodeJS.Timeout | null = null;
  private contentCache: Map<string, HTMLImageElement | HTMLVideoElement> = new Map();
  private preloadQueue: DisplayContent[] = [];
  private maxPreloadItems = 5;

  constructor() {
    // Listen for content updates from the server
    websocketService.onContentUpdate(this.handleContentUpdate.bind(this));
  }

  private async preloadContent(content: DisplayContent) {
    if (this.contentCache.has(content.id)) {
      return;
    }

    try {
      if (content.type === 'image') {
        const img = new Image();
        img.src = content.content.url;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        this.contentCache.set(content.id, img);
      } else if (content.type === 'video') {
        const video = document.createElement('video');
        video.src = content.content.url;
        await new Promise((resolve, reject) => {
          video.onloadeddata = resolve;
          video.onerror = reject;
        });
        this.contentCache.set(content.id, video);
      }
    } catch (error) {
      console.error(`Failed to preload content ${content.id}:`, error);
    }
  }

  private async preloadNextItems() {
    const itemsToPreload = this.contentQueue.slice(0, this.maxPreloadItems);
    await Promise.all(itemsToPreload.map(content => this.preloadContent(content)));
  }

  private handleContentUpdate(content: DisplayContent) {
    // Add new content to the queue
    this.contentQueue.push(content);
    
    // If nothing is currently playing, start playing the queue
    if (!this.isPlaying) {
      this.playNextContent();
    } else {
      // Preload new content in the background
      this.preloadNextItems();
    }
  }

  private async playNextContent() {
    if (this.contentQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const nextContent = this.contentQueue[0];

    // Ensure content is preloaded before playing
    if (!this.contentCache.has(nextContent.id)) {
      await this.preloadContent(nextContent);
    }

    this.currentContent = this.contentQueue.shift() || null;

    if (this.currentContent) {
      // Preload next items in the background
      this.preloadNextItems();

      // If content has a duration, set up timeout for next content
      if (this.currentContent.duration) {
        this.currentTimeout = setTimeout(() => {
          this.playNextContent();
        }, this.currentContent!.duration * 1000);
      }
    }
  }

  getCurrentContent(): DisplayContent | null {
    return this.currentContent;
  }

  getContentQueue(): DisplayContent[] {
    return this.contentQueue;
  }

  clearQueue() {
    this.contentQueue = [];
    this.preloadQueue = [];
    this.contentCache.clear();
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    this.currentContent = null;
    this.isPlaying = false;
  }

  pause() {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    this.isPlaying = false;
  }

  resume() {
    if (this.currentContent && this.currentContent.duration) {
      this.currentTimeout = setTimeout(() => {
        this.playNextContent();
      }, this.currentContent!.duration * 1000);
    }
    this.isPlaying = true;
  }

  // Get cached element for content
  getCachedElement(contentId: string): HTMLImageElement | HTMLVideoElement | undefined {
    return this.contentCache.get(contentId);
  }
}

export const contentService = new ContentService(); 