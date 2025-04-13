import { EventEmitter } from '../utils/EventEmitter';
import { Content } from '../types';

export interface PlaybackOptions {
  autoAdvance?: boolean;
  prefetchCount?: number;
  transitionEffect?: 'none' | 'fade' | 'crossfade';
  transitionDuration?: number;
  retryInterval?: number;
  maxRetries?: number;
}

export type PlaybackStatus = 
  | 'idle'
  | 'loading'
  | 'playing' 
  | 'paused'
  | 'error'
  | 'transitioning';

export interface PlaybackState {
  status: PlaybackStatus;
  currentContent: Content | null;
  nextContent: Content | null;
  playlist: Content[];
  currentIndex: number;
  error: Error | null;
  isLoading: boolean;
  isEmpty: boolean;
}

/**
 * PlaybackEngine handles content playback timing, transitions, and error handling
 */
export class PlaybackEngine extends EventEmitter {
  private playlist: Content[] = [];
  private currentIndex: number = -1;
  private currentContent: Content | null = null;
  private nextContent: Content | null = null;
  private status: PlaybackStatus = 'idle';
  private error: Error | null = null;
  private playbackTimer: number | null = null;
  private retryTimer: number | null = null;
  private retryCount: number = 0;
  private options: Required<PlaybackOptions>;
  private preloadedContent: Set<string> = new Set();

  constructor(options: PlaybackOptions = {}) {
    super();
    
    // Set default options
    this.options = {
      autoAdvance: options.autoAdvance ?? true,
      prefetchCount: options.prefetchCount ?? 2,
      transitionEffect: options.transitionEffect ?? 'fade',
      transitionDuration: options.transitionDuration ?? 300,
      retryInterval: options.retryInterval ?? 5000,
      maxRetries: options.maxRetries ?? 3
    };
    
    // Bind methods
    this.advance = this.advance.bind(this);
    this.handleContentError = this.handleContentError.bind(this);
    
    // Setup listeners
    this.on('contentLoaded', this.handleContentLoaded.bind(this));
    this.on('contentError', this.handleContentError);
    this.on('contentEnd', this.handleContentEnd.bind(this));
  }

  /**
   * Load a playlist of content items
   * @param playlist Array of content items
   * @param startIndex Optional index to start playback from
   */
  loadPlaylist(playlist: Content[], startIndex: number = 0): void {
    this.clearTimers();
    
    if (!playlist || playlist.length === 0) {
      this.playlist = [];
      this.currentIndex = -1;
      this.currentContent = null;
      this.nextContent = null;
      this.status = 'idle';
      this.error = null;
      this.emit('playlistEmpty');
      this.emitStateChange();
      return;
    }
    
    this.playlist = [...playlist];
    this.currentIndex = Math.min(startIndex, this.playlist.length - 1);
    this.status = 'loading';
    this.error = null;
    
    // Set current and next content
    this.currentContent = this.playlist[this.currentIndex];
    this.nextContent = this.getNextContentFromPlaylist();
    
    // Preload next content items
    this.preloadUpcomingContent();
    
    this.emit('playlistLoaded', { 
      playlist: this.playlist,
      currentIndex: this.currentIndex
    });
    
    this.emitStateChange();
  }

  /**
   * Update the current playlist without interrupting playback
   * @param playlist New playlist of content items
   */
  updatePlaylist(playlist: Content[]): void {
    if (!playlist || playlist.length === 0) {
      // If new playlist is empty but we're currently playing something,
      // let the current content finish before stopping
      if (this.currentContent !== null) {
        this.playlist = [this.currentContent];
        this.currentIndex = 0;
        this.nextContent = null;
      } else {
        this.loadPlaylist([]);
      }
      return;
    }
    
    // Find the current content in the new playlist to maintain position
    let newIndex = -1;
    if (this.currentContent) {
      newIndex = playlist.findIndex(item => item.id === this.currentContent?.id);
    }
    
    // If current content is not in new playlist, start from beginning
    if (newIndex === -1) {
      this.loadPlaylist(playlist);
      return;
    }
    
    // Update playlist while preserving current position
    const oldStatus = this.status;
    this.playlist = [...playlist];
    this.currentIndex = newIndex;
    this.nextContent = this.getNextContentFromPlaylist();
    this.status = oldStatus;
    
    // Preload next content items
    this.preloadUpcomingContent();
    
    this.emit('playlistUpdated', { 
      playlist: this.playlist,
      currentIndex: this.currentIndex
    });
    
    this.emitStateChange();
  }

  /**
   * Start or resume playback
   */
  play(): void {
    if (this.playlist.length === 0) {
      this.emit('playlistEmpty');
      return;
    }
    
    if (this.status === 'paused' || this.status === 'idle') {
      this.status = 'playing';
      this.scheduleContentAdvance();
      this.emit('playbackStarted', this.currentContent);
      this.emitStateChange();
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.status === 'playing') {
      this.clearTimers();
      this.status = 'paused';
      this.emit('playbackPaused');
      this.emitStateChange();
    }
  }

  /**
   * Stop playback and reset
   */
  stop(): void {
    this.clearTimers();
    this.currentIndex = -1;
    this.currentContent = null;
    this.nextContent = null;
    this.status = 'idle';
    this.error = null;
    this.emit('playbackStopped');
    this.emitStateChange();
  }

  /**
   * Advance to the next content
   */
  advance(): boolean {
    // Clear any existing timers
    this.clearTimers();
    
    // Reset retry count for next item
    this.retryCount = 0;
    
    // If playlist is empty, stop playback
    if (this.playlist.length === 0) {
      this.stop();
      this.emit('playlistEmpty');
      return false;
    }
    
    // Move to next index
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    this.currentContent = this.playlist[this.currentIndex];
    this.nextContent = this.getNextContentFromPlaylist();
    
    // Update status and emit events
    this.status = 'transitioning';
    
    // Schedule next content advance
    this.scheduleContentAdvance();
    
    // Preload upcoming content
    this.preloadUpcomingContent();
    
    // Emit events
    this.emit('contentChanged', this.currentContent);
    this.emitStateChange();
    
    return true;
  }

  /**
   * Skip to a specific content by index
   */
  skipTo(index: number): boolean {
    if (index < 0 || index >= this.playlist.length) {
      return false;
    }
    
    // Clear any existing timers
    this.clearTimers();
    
    // Reset retry count
    this.retryCount = 0;
    
    // Update current content
    this.currentIndex = index;
    this.currentContent = this.playlist[this.currentIndex];
    this.nextContent = this.getNextContentFromPlaylist();
    
    // Update status and schedule advance
    this.status = 'transitioning';
    this.scheduleContentAdvance();
    
    // Preload upcoming content
    this.preloadUpcomingContent();
    
    // Emit events
    this.emit('contentChanged', this.currentContent);
    this.emitStateChange();
    
    return true;
  }

  /**
   * Set content as loaded successfully
   * @param contentId ID of the content
   */
  markContentLoaded(contentId: string): void {
    // Only care if it's the current content
    if (this.currentContent && this.currentContent.id === contentId) {
      this.status = 'playing';
      this.error = null;
      this.emit('contentLoaded', contentId);
      this.emitStateChange();
    }
    
    // Keep track of preloaded content for optimization
    this.preloadedContent.add(contentId);
  }

  /**
   * Report a content loading error
   * @param contentId ID of the content
   * @param error Error that occurred
   */
  markContentError(contentId: string, error: Error): void {
    // Only care if it's the current content
    if (this.currentContent && this.currentContent.id === contentId) {
      this.error = error;
      this.emit('contentError', { contentId, error });
      this.handleContentError({ contentId, error });
    }
  }

  /**
   * Get the current playback state
   */
  getState(): PlaybackState {
    return {
      status: this.status,
      currentContent: this.currentContent,
      nextContent: this.nextContent,
      playlist: this.playlist,
      currentIndex: this.currentIndex,
      error: this.error,
      isLoading: this.status === 'loading' || this.status === 'transitioning',
      isEmpty: this.playlist.length === 0
    };
  }

  /**
   * Check if a content item has been preloaded
   */
  isContentPreloaded(contentId: string): boolean {
    return this.preloadedContent.has(contentId);
  }

  /**
   * Get upcoming content items that should be preloaded
   */
  getPreloadTargets(): Content[] {
    if (this.playlist.length === 0) return [];
    
    const targets: Content[] = [];
    const prefetchCount = this.options.prefetchCount;
    let nextIndex = this.currentIndex;
    
    for (let i = 0; i < prefetchCount; i++) {
      nextIndex = (nextIndex + 1) % this.playlist.length;
      
      // Avoid duplicates
      if (nextIndex !== this.currentIndex) {
        targets.push(this.playlist[nextIndex]);
      }
      
      // Stop if we've looped through the entire playlist
      if (nextIndex === this.currentIndex) break;
    }
    
    return targets;
  }

  /**
   * Handle content successfully loading
   */
  private handleContentLoaded(contentId: string): void {
    // Content loaded successfully, reset error state and continue playback
    if (this.currentContent && this.currentContent.id === contentId) {
      this.status = 'playing';
      this.error = null;
      this.retryCount = 0;
      this.scheduleContentAdvance();
      this.emitStateChange();
    }
  }

  /**
   * Handle content loading error
   */
  private handleContentError({ contentId, error }: { contentId: string; error: Error }): void {
    // Only handle errors for current content
    if (!this.currentContent || this.currentContent.id !== contentId) return;
    
    this.error = error;
    this.status = 'error';
    
    // If we've exceeded retry limit, skip to next content
    if (this.retryCount >= this.options.maxRetries) {
      console.error(`Failed to load content after ${this.retryCount} attempts, skipping:`, error);
      
      // Move to next content if auto-advance is enabled
      if (this.options.autoAdvance) {
        setTimeout(() => this.advance(), 1000); // Add slight delay before advancing
      }
      
      return;
    }
    
    // Increment retry count and schedule retry
    this.retryCount++;
    console.warn(`Content loading error (attempt ${this.retryCount}/${this.options.maxRetries}):`, error);
    
    // Schedule a retry
    this.retryTimer = window.setTimeout(() => {
      this.emit('contentRetry', { 
        contentId, 
        attempt: this.retryCount, 
        maxAttempts: this.options.maxRetries 
      });
      
      this.status = 'loading';
      this.emitStateChange();
    }, this.options.retryInterval);
  }

  /**
   * Handle content playback ending
   */
  private handleContentEnd(): void {
    if (this.options.autoAdvance) {
      this.advance();
    } else {
      this.status = 'paused';
      this.emitStateChange();
    }
  }

  /**
   * Schedule the next content advance
   */
  private scheduleContentAdvance(): void {
    this.clearTimers();
    
    if (!this.currentContent || !this.options.autoAdvance) return;
    
    // Use the content's duration to schedule the next advance
    const duration = this.currentContent.duration;
    if (duration && duration > 0) {
      this.playbackTimer = window.setTimeout(() => {
        this.advance();
      }, duration);
    }
  }

  /**
   * Get the next content item from the playlist
   */
  private getNextContentFromPlaylist(): Content | null {
    if (this.playlist.length <= 1) return null;
    
    const nextIndex = (this.currentIndex + 1) % this.playlist.length;
    return this.playlist[nextIndex];
  }

  /**
   * Preload upcoming content items
   */
  private preloadUpcomingContent(): void {
    if (this.playlist.length <= 1) return;
    
    const targets = this.getPreloadTargets();
    if (targets.length > 0) {
      this.emit('preloadContent', targets);
    }
  }

  /**
   * Clear all active timers
   */
  private clearTimers(): void {
    if (this.playbackTimer !== null) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Emit state change event
   */
  private emitStateChange(): void {
    this.emit('stateChange', this.getState());
  }
} 