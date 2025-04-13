import { isBefore, isAfter } from 'date-fns';
import { ScheduledContent } from '../types/display';
import type { ContentSchedule } from '../types/content';

export class ContentScheduler {
  private schedule: ContentSchedule;
  private currentContent: ScheduledContent | null = null;
  private nextContent: ScheduledContent | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(schedule: ContentSchedule) {
    this.schedule = schedule;
    this.start();
  }

  public updateSchedule(schedule: ContentSchedule): void {
    this.schedule = schedule;
    this.updateContent();
  }

  private updateContent(): void {
    const now = new Date();
    const items = this.schedule.items;

    // Find current content
    const currentItem = items.find((item: any) => {
      const startTime = item.startTime instanceof Date ? item.startTime : new Date(item.startTime);
      const endTime = item.endTime instanceof Date ? item.endTime : new Date(item.endTime);
      return isBefore(startTime, now) && isAfter(endTime, now);
    });

    if (currentItem) {
      // Convert to ScheduledContent
      this.currentContent = {
        ...currentItem,
        startTime: currentItem.startTime instanceof Date ? currentItem.startTime : new Date(currentItem.startTime),
        endTime: currentItem.endTime instanceof Date ? currentItem.endTime : new Date(currentItem.endTime),
        content: {} as any // This would need to be fetched or provided
      };
    } else {
      this.currentContent = null;
    }

    // Find next content
    const nextItem = items.find((item: any) => {
      const startTime = item.startTime instanceof Date ? item.startTime : new Date(item.startTime);
      return isAfter(startTime, now);
    });

    if (nextItem) {
      // Convert to ScheduledContent
      this.nextContent = {
        ...nextItem,
        startTime: nextItem.startTime instanceof Date ? nextItem.startTime : new Date(nextItem.startTime),
        endTime: nextItem.endTime instanceof Date ? nextItem.endTime : new Date(nextItem.endTime),
        content: {} as any // This would need to be fetched or provided
      };
    } else {
      this.nextContent = null;
    }
  }

  public getCurrentContent(): ScheduledContent | null {
    return this.currentContent;
  }

  public getNextContent(): ScheduledContent | null {
    return this.nextContent;
  }

  public start(): void {
    this.updateContent();
    this.updateInterval = setInterval(() => this.updateContent(), 1000);
  }

  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  getTimeUntilNext(): number | null {
    if (!this.nextContent) return null;
    // Ensure we have a Date object before calling getTime()
    const startTime = this.nextContent.startTime instanceof Date 
      ? this.nextContent.startTime 
      : new Date(this.nextContent.startTime);
    return startTime.getTime() - new Date().getTime();
  }

  getRemainingTime(): number | null {
    if (!this.currentContent) return null;
    // Ensure we have a Date object before calling getTime()
    const endTime = this.currentContent.endTime instanceof Date 
      ? this.currentContent.endTime 
      : new Date(this.currentContent.endTime);
    return endTime.getTime() - new Date().getTime();
  }

  isContentScheduled(contentId: string): boolean {
    return this.schedule.items.some((item: any) => item.contentId === contentId);
  }

  getContentSchedule(contentId: string): ScheduledContent | null {
    const item = this.schedule.items.find((item: any) => item.contentId === contentId);
    if (!item) return null;

    return {
      ...item,
      startTime: item.startTime instanceof Date ? item.startTime : new Date(item.startTime),
      endTime: item.endTime instanceof Date ? item.endTime : new Date(item.endTime),
      content: {} as any // This would need to be fetched or provided
    };
  }
} 