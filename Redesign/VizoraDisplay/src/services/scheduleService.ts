import { Content, Schedule as ScheduleEntryData } from '@vizora/common/types';
import { ContentService } from './contentService';
import { ContentSchedule, ScheduleEntry } from '@vizora/common';

export class ScheduleService {
  private currentSchedule: ContentSchedule | null = null;
  private currentContent: Content | null = null;
  private playbackTimer: NodeJS.Timeout | null = null;
  private preloadTimeout: NodeJS.Timeout | null = null;
  private contentService: ContentService;

  constructor(contentService: ContentService) {
    this.contentService = contentService;
  }

  public getCurrentContent(): Content | null {
    return this.currentContent;
  }

  public async advanceToNextContent(): Promise<void> {
    console.log("Advancing to next content...");
    if (this.currentSchedule && this.currentSchedule.items.length > 0) {
      this.currentSchedule.items.shift();
      await this.startPlayback();
    } else {
      console.log("No more items in schedule or schedule not loaded.");
      this.currentContent = null;
    }
  }

  async initialize(displayId: string): Promise<void> {
    // Listen for schedule updates
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  async updateSchedule(schedule: ContentSchedule): Promise<void> {
    this.currentSchedule = schedule;
    await this.startPlayback();
  }

  private async startPlayback(): Promise<void> {
    if (!this.currentSchedule) return;

    const now = new Date().toISOString();
    const currentItem = this.currentSchedule.items?.find(
      (item) => item.startTime <= now && item.endTime > now
    );

    if (currentItem) {
      await this.playContent(currentItem.contentId);
    } else {
      this.scheduleNextPlayback();
    }
  }

  private async playContent(contentId: string): Promise<void> {
    try {
      const content = await this.contentService.getContent(contentId);
      this.currentContent = content;
      this.onContentChange?.(content);

      const currentItem = this.currentSchedule?.items?.find(
        (item) => item.contentId === contentId
      );

      if (currentItem?.endTime) {
        const endTime = new Date(currentItem.endTime).getTime();
        const duration = endTime - Date.now();
        if (duration > 0) {
          this.clearPlaybackTimer();
          this.playbackTimer = setTimeout(() => this.advanceToNextContent(), duration);
        } else {
          this.advanceToNextContent();
        }
      } else {
        console.warn(`Content item ${contentId} has no end time.`);
        this.advanceToNextContent();
      }
    } catch (error) {
      console.error('Failed to play content:', error);
      this.scheduleNextPlayback();
    }
  }

  private scheduleNextPlayback(): void {
    this.clearPlaybackTimer();
    const nextItem = this.getNextContentItem();

    if (nextItem?.startTime) {
      const now = Date.now();
      const startTime = new Date(nextItem.startTime).getTime();
      const delay = startTime - now;
      
      if (delay > 0) {
        this.playbackTimer = setTimeout(() => this.startPlayback(), delay);

        const preloadDelay = Math.max(0, delay - 30000);
        this.clearPreloadTimeout();
        this.preloadTimeout = setTimeout(() => {
           if (nextItem?.contentId) {
              this.contentService.preloadContent([nextItem.contentId]);
           }
        }, preloadDelay);
      } else {
        this.startPlayback();
      }
    }
  }

  private clearPlaybackTimer(): void {
     if (this.playbackTimer) {
        clearTimeout(this.playbackTimer);
        this.playbackTimer = null;
     }
  }

  private clearPreloadTimeout(): void {
     if (this.preloadTimeout) {
        clearTimeout(this.preloadTimeout);
        this.preloadTimeout = null;
     }
  }

  private handleOnline(): void {
    // Attempt to sync schedule when coming back online
    this.startPlayback();
  }

  private handleOffline(): void {
    // Continue playing current content if available
    if (this.currentContent) {
      this.onContentChange?.(this.currentContent);
    }
  }

  cleanup(): void {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    if (this.preloadTimeout) {
      clearTimeout(this.preloadTimeout);
      this.preloadTimeout = null;
    }
  }

  onContentChange?: (content: Content) => void;

  private determineCurrentContent(): ScheduleEntry | null {
    const nowTime = Date.now();
    if (!this.currentSchedule?.items) return null;
    const currentItem = this.currentSchedule.items.find(
      (item: any) => {
        try {
          const startTime = item.startTime ? new Date(item.startTime).getTime() : null;
          const endTime = item.endTime ? new Date(item.endTime).getTime() : null;
          return startTime !== null && endTime !== null && !isNaN(startTime) && !isNaN(endTime) && 
                 startTime <= nowTime && endTime > nowTime;
        } catch { return false; }
      }
    );
    return currentItem || null;
  }

  public getContentItemById(contentId: string): ScheduleEntry | null {
    if (!this.currentSchedule?.items) return null;
    const currentItem = this.currentSchedule.items.find(
      (item: any) => item.contentId === contentId
    );
    return currentItem || null;
  }

  private getNextContentItem(): ScheduleEntry | null {
    const nowTime = Date.now();
    if (!this.currentSchedule?.items) return null;
    const nextItem = this.currentSchedule.items.find(
      (item: any) => {
        if (!item) return false;
        try {
          const startTime = item.startTime ? new Date(item.startTime).getTime() : null;
          return startTime !== null && !isNaN(startTime) && startTime > nowTime;
        } catch { return false; }
      }
    );
    return nextItem || null;
  }
} 