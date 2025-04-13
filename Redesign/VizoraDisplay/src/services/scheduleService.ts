import { Content, Schedule } from '@vizora/common/types';
import { ContentService } from './contentService';

export class ScheduleService {
  private currentSchedule: Schedule | null = null;
  private currentContent: Content | null = null;
  private playbackTimer: NodeJS.Timeout | null = null;
  private preloadTimer: NodeJS.Timeout | null = null;

  constructor(private contentService: ContentService) {}

  async initialize(displayId: string): Promise<void> {
    // Listen for schedule updates
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  async updateSchedule(schedule: Schedule): Promise<void> {
    this.currentSchedule = schedule;
    await this.startPlayback();
  }

  private async startPlayback(): Promise<void> {
    if (!this.currentSchedule) return;

    const now = new Date();
    const currentItem = this.currentSchedule.items.find(
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

      const currentItem = this.currentSchedule?.items.find(
        (item) => item.contentId === contentId
      );

      if (currentItem) {
        const duration = new Date(currentItem.endTime).getTime() - Date.now();
        this.playbackTimer = setTimeout(() => this.scheduleNextPlayback(), duration);
      }
    } catch (error) {
      console.error('Failed to play content:', error);
      this.scheduleNextPlayback();
    }
  }

  private scheduleNextPlayback(): void {
    if (!this.currentSchedule) return;

    const now = new Date();
    const nextItem = this.currentSchedule.items.find(
      (item) => item.startTime > now
    );

    if (nextItem) {
      const delay = new Date(nextItem.startTime).getTime() - now;
      this.playbackTimer = setTimeout(() => this.startPlayback(), delay);
      
      // Preload content 30 seconds before it's due to play
      const preloadDelay = Math.max(0, delay - 30000);
      this.preloadTimer = setTimeout(() => {
        this.contentService.preloadContent([nextItem.contentId]);
      }, preloadDelay);
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
    if (this.preloadTimer) {
      clearTimeout(this.preloadTimer);
      this.preloadTimer = null;
    }
  }

  onContentChange?: (content: Content) => void;
} 