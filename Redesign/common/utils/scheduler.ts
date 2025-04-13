import { ContentSchedule, ContentItem } from '../types/content';
import { addSeconds, isBefore, isAfter, parseISO } from 'date-fns';

export interface ScheduledContent {
  content: ContentItem;
  startTime: Date;
  endTime: Date;
  priority: number;
}

export class ContentScheduler {
  private schedule: ContentSchedule;
  private currentContent: ScheduledContent | null = null;
  private nextContent: ScheduledContent | null = null;

  constructor(schedule: ContentSchedule) {
    this.schedule = schedule;
    this.updateSchedule();
  }

  updateSchedule(schedule: ContentSchedule): void {
    this.schedule = schedule;
    this.updateSchedule();
  }

  getCurrentContent(): ScheduledContent | null {
    return this.currentContent;
  }

  getNextContent(): ScheduledContent | null {
    return this.nextContent;
  }

  private updateSchedule(): void {
    const now = new Date();
    const items = this.schedule.items
      .map(item => ({
        ...item,
        startTime: parseISO(item.startTime.toString()),
        endTime: parseISO(item.endTime.toString())
      }))
      .sort((a, b) => a.priority - b.priority);

    // Find current content
    this.currentContent = items.find(item => 
      isBefore(item.startTime, now) && isAfter(item.endTime, now)
    ) || null;

    // Find next content
    this.nextContent = items.find(item => 
      isAfter(item.startTime, now)
    ) || null;
  }

  getTimeUntilNext(): number | null {
    if (!this.nextContent) return null;
    return this.nextContent.startTime.getTime() - new Date().getTime();
  }

  getRemainingTime(): number | null {
    if (!this.currentContent) return null;
    return this.currentContent.endTime.getTime() - new Date().getTime();
  }

  isContentScheduled(contentId: string): boolean {
    return this.schedule.items.some(item => item.contentId === contentId);
  }

  getContentSchedule(contentId: string): ScheduledContent | null {
    const item = this.schedule.items.find(item => item.contentId === contentId);
    if (!item) return null;

    return {
      ...item,
      startTime: parseISO(item.startTime.toString()),
      endTime: parseISO(item.endTime.toString())
    };
  }
} 