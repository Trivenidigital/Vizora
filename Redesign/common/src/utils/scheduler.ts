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

  private createScheduledContent(item: any): ScheduledContent | null {
    if (!item?.startTime || !item.endTime) return null;
    try {
        const startTime = new Date(item.startTime);
        const endTime = new Date(item.endTime);
        // Check if dates are valid after creation
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return null; 
        return {
          ...item, 
          startTime: startTime, 
          endTime: endTime, 
          content: {} as any 
        };
    } catch { return null; }
  }

  private updateContent(): void {
    const now = new Date();
    const nowTime = now.getTime();
    const items = this.schedule?.items || [];

    const findItemLogic = (item: any): boolean => {
      if (!item) return false;
      try {
        let startTime: number | null = null;
        let endTime: number | null = null;
        if (item.startTime instanceof Date) startTime = item.startTime.getTime();
        else if (typeof item.startTime === 'string' && item.startTime) startTime = new Date(item.startTime).getTime();
        
        if (item.endTime instanceof Date) endTime = item.endTime.getTime();
        else if (typeof item.endTime === 'string' && item.endTime) endTime = new Date(item.endTime).getTime();
        
        return startTime !== null && endTime !== null && !isNaN(startTime) && !isNaN(endTime) && 
               startTime <= nowTime && endTime > nowTime;
      } catch { return false; }
    };

    const findNextItemLogic = (item: any): boolean => {
      if (!item) return false;
      try {
        let startTime: number | null = null;
        if (item.startTime instanceof Date) startTime = item.startTime.getTime();
        else if (typeof item.startTime === 'string' && item.startTime) startTime = new Date(item.startTime).getTime();
        
        return startTime !== null && !isNaN(startTime) && startTime > nowTime;
      } catch { return false; }
    };
    
    const createScheduledContent = (item: any): ScheduledContent | null => {
       if (!item?.startTime || !item.endTime) return null;
       try {
          let startTime: Date | undefined = undefined;
          let endTime: Date | undefined = undefined;
          if(item.startTime instanceof Date) startTime = item.startTime;
          else if(typeof item.startTime === 'string' && item.startTime) startTime = new Date(item.startTime);

          if(item.endTime instanceof Date) endTime = item.endTime;
          else if(typeof item.endTime === 'string' && item.endTime) endTime = new Date(item.endTime);
          
          if (!startTime || !endTime || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return null; 
          return {
            ...item, 
            startTime: startTime, 
            endTime: endTime, 
            content: {} as any 
          };
       } catch { return null; }
    };

    const currentItemData = items.find(findItemLogic);
    this.currentContent = currentItemData ? createScheduledContent(currentItemData) : null;
    
    const nextItemData = items.find(findNextItemLogic);
    this.nextContent = nextItemData ? createScheduledContent(nextItemData) : null;
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
    const nextStartTimeValue = this.nextContent?.startTime;
    if (!nextStartTimeValue) return null;
    try {
      let startTimeMs: number | null = null;
      if (nextStartTimeValue instanceof Date) {
        startTimeMs = nextStartTimeValue.getTime();
      } else if (typeof nextStartTimeValue === 'string' && nextStartTimeValue.length > 0) {
        startTimeMs = new Date(nextStartTimeValue).getTime();
      }
      if (startTimeMs === null || isNaN(startTimeMs)) return null;
      return startTimeMs - Date.now();
    } catch { return null; }
  }

  getRemainingTime(): number | null {
    const currentEndTimeValue = this.currentContent?.endTime;
    if (!currentEndTimeValue) return null;
    try {
      let endTimeMs: number | null = null;
      if (currentEndTimeValue instanceof Date) {
        endTimeMs = currentEndTimeValue.getTime();
      } else if (typeof currentEndTimeValue === 'string' && currentEndTimeValue.length > 0) {
        endTimeMs = new Date(currentEndTimeValue).getTime();
      }
      if (endTimeMs === null || isNaN(endTimeMs)) return null;
      return endTimeMs - Date.now();
    } catch { return null; }
  }

  isContentScheduled(contentId: string): boolean {
    return this.schedule.items.some((item: any) => item.contentId === contentId);
  }

  getContentSchedule(contentId: string): ScheduledContent | null {
    const item = this.schedule?.items?.find((item: any) => item.contentId === contentId);
    if (!item) return null;
    return this.createScheduledContent(item); 
  }
} 