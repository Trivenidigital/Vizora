import { 
  Schedule, 
  ScheduleEntry,
  ScheduleInfo,
  ContentWithSchedule,
  ScheduleValidationResult,
  TimeRange
} from '../types';

/**
 * Determines if a schedule is currently active based on the current time
 * @param schedule The schedule to check
 * @param currentTime The current time to check against (defaults to now)
 * @returns boolean indicating if the schedule is active
 */
export function isScheduleActive(
  schedule: Schedule | ScheduleEntry | ScheduleInfo, 
  currentTime: Date = new Date()
): boolean {
  // Must have either startTime or endTime defined, and be active
  if (typeof (schedule as any).active === 'boolean' && !(schedule as any).active) {
    return false;
  }

  // Check start time
  if (schedule.startTime) {
    const startTime = new Date(schedule.startTime);
    if (startTime > currentTime) {
      return false; // Not started yet
    }
  }

  // Check end time
  if (schedule.endTime) {
    const endTime = new Date(schedule.endTime);
    if (endTime < currentTime) {
      return false; // Already ended
    }
  }

  // Check recurring schedules
  if (schedule.repeat && schedule.repeat !== 'none') {
    // Need start time for recurring check
    if (!schedule.startTime) {
      return false;
    }
    
    const startDate = new Date(schedule.startTime);
    const endDate = schedule.endTime ? new Date(schedule.endTime) : null;
    
    switch (schedule.repeat) {
      case 'daily': 
        return isDailyScheduleActive(startDate, endDate, currentTime);
      case 'weekly':
        return isWeeklyScheduleActive(startDate, endDate, currentTime);
      case 'monthly':
        return isMonthlyScheduleActive(startDate, endDate, currentTime);
      default:
        return true;
    }
  }

  return true;
}

/**
 * Determines if a daily schedule is active at the current time
 * @param startDate The schedule's start date
 * @param endDate The schedule's end date (optional)
 * @param currentTime The current time
 * @returns boolean indicating if the schedule is active
 */
export function isDailyScheduleActive(
  startDate: Date,
  endDate: Date | null,
  currentTime: Date
): boolean {
  // Build today's time range using hours and minutes from the start/end dates
  const todayStart = new Date(currentTime);
  todayStart.setHours(
    startDate.getHours(),
    startDate.getMinutes(),
    startDate.getSeconds(),
    0
  );
  
  let todayEnd;
  if (endDate) {
    todayEnd = new Date(currentTime);
    todayEnd.setHours(
      endDate.getHours(),
      endDate.getMinutes(),
      endDate.getSeconds(),
      999
    );
  } else {
    todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
  }
  
  return currentTime >= todayStart && currentTime <= todayEnd;
}

/**
 * Determines if a weekly schedule is active at the current time
 * @param startDate The schedule's start date
 * @param endDate The schedule's end date (optional) 
 * @param currentTime The current time
 * @returns boolean indicating if the schedule is active
 */
export function isWeeklyScheduleActive(
  startDate: Date,
  endDate: Date | null,
  currentTime: Date
): boolean {
  // Check if current day of week matches
  if (startDate.getDay() !== currentTime.getDay()) {
    return false;
  }
  
  // Check time range for today
  return isDailyScheduleActive(startDate, endDate, currentTime);
}

/**
 * Determines if a monthly schedule is active at the current time
 * @param startDate The schedule's start date
 * @param endDate The schedule's end date (optional)
 * @param currentTime The current time
 * @returns boolean indicating if the schedule is active
 */
export function isMonthlyScheduleActive(
  startDate: Date,
  endDate: Date | null,
  currentTime: Date
): boolean {
  // Check if current day of month matches
  if (startDate.getDate() !== currentTime.getDate()) {
    return false;
  }
  
  // Check time range for today
  return isDailyScheduleActive(startDate, endDate, currentTime);
}

/**
 * Gets all active schedules from a list of schedules at the current time
 * @param schedules Array of schedules to check
 * @param currentTime The current time (defaults to now)
 * @returns Array of active schedules
 */
export function getActiveSchedules<T extends Schedule | ScheduleEntry | ScheduleInfo>(
  schedules: T[],
  currentTime: Date = new Date()
): T[] {
  return schedules.filter(schedule => isScheduleActive(schedule, currentTime));
}

/**
 * Selects the highest priority active schedule from a list of schedules
 * If multiple schedules have the same priority, the first one is selected
 * @param schedules Array of schedules to check
 * @param currentTime The current time (defaults to now)
 * @returns The highest priority active schedule, or undefined if none are active
 */
export function getHighestPrioritySchedule<T extends Schedule | ScheduleEntry | ScheduleInfo>(
  schedules: T[],
  currentTime: Date = new Date()
): T | undefined {
  const activeSchedules = getActiveSchedules(schedules, currentTime);
  
  if (activeSchedules.length === 0) {
    return undefined;
  }
  
  if (activeSchedules.length === 1) {
    return activeSchedules[0];
  }
  
  // Sort by priority (highest first)
  return activeSchedules.sort((a, b) => {
    // If priority is not specified, default to 0
    const priorityA = typeof a.priority === 'number' ? a.priority : 0;
    const priorityB = typeof b.priority === 'number' ? b.priority : 0;
    return priorityB - priorityA;
  })[0];
}

/**
 * Gets the next schedule that will become active
 * @param schedules Array of schedules to check
 * @param currentTime The current time (defaults to now)
 * @returns The next schedule that will become active, or undefined if none
 */
export function getNextSchedule<T extends Schedule | ScheduleEntry | ScheduleInfo>(
  schedules: T[],
  currentTime: Date = new Date()
): T | undefined {
  // Filter for future schedules
  const futureSchedules = schedules.filter(schedule => {
    // Skip inactive schedules
    if (typeof (schedule as any).active === 'boolean' && !(schedule as any).active) {
      return false;
    }
    
    // Must have a start time
    if (!schedule.startTime) return false;
    
    // Check if start time is in the future
    return new Date(schedule.startTime) > currentTime;
  });
  
  if (futureSchedules.length === 0) {
    return undefined;
  }
  
  // Sort by start time (earliest first)
  return futureSchedules.sort((a, b) => {
    if (!a.startTime || !b.startTime) return 0;
    const startTimeA = new Date(a.startTime);
    const startTimeB = new Date(b.startTime);
    return startTimeA.getTime() - startTimeB.getTime();
  })[0];
}

/**
 * Processes a list of content items with schedule information
 * @param contentItems Array of content items with schedule information
 * @returns Object with active content and next content
 */
export function processScheduledContent<T extends ContentWithSchedule>(
  contentItems: T[],
  currentTime: Date = new Date()
): { activeContent: T | null, nextContent: T | null } {
  if (!contentItems || contentItems.length === 0) {
    return { activeContent: null, nextContent: null };
  }
  
  // Filter for scheduled content
  const scheduledItems = contentItems.filter(item => 
    item.scheduled && item.scheduledInfo
  );
  
  // Get active scheduled content
  const activeScheduledItems = scheduledItems.filter(item => {
    if (!item.scheduledInfo) return false;
    return isScheduleActive(item.scheduledInfo, currentTime);
  });
  
  // Find highest priority active content
  let activeContent: T | null = null;
  
  if (activeScheduledItems.length > 0) {
    // Sort by priority (highest first)
    activeContent = activeScheduledItems.sort((a, b) => {
      return ((b.scheduledInfo?.priority || 0) - (a.scheduledInfo?.priority || 0));
    })[0];
  } else if (contentItems.length > 0) {
    // Fall back to first regular content
    activeContent = contentItems.find(item => !item.scheduled) || contentItems[0];
  }
  
  // Find next content (scheduled to start in the future)
  const futureScheduledItems = scheduledItems.filter(item => {
    if (!item.scheduledInfo || !item.scheduledInfo.startTime) return false;
    return new Date(item.scheduledInfo.startTime) > currentTime;
  });
  
  // Sort by start time (earliest first)
  const nextContent = futureScheduledItems.length > 0 
    ? futureScheduledItems.sort((a, b) => {
        if (!a.scheduledInfo?.startTime || !b.scheduledInfo?.startTime) return 0;
        return new Date(a.scheduledInfo.startTime).getTime() - new Date(b.scheduledInfo.startTime).getTime();
      })[0]
    : null;
  
  return { activeContent, nextContent };
}

/**
 * Format a time range properly for use in APIs
 * @param startTime Start time
 * @param endTime End time
 * @returns Formatted time range object
 */
export function formatTimeRange(startTime: Date, endTime: Date): TimeRange {
  return {
    start: startTime.toISOString(),
    end: endTime.toISOString()
  };
}

/**
 * Parse a time range into Date objects
 * @param timeRange Time range object
 * @returns Object with start and end dates
 */
export function parseTimeRange(timeRange: TimeRange): { start: Date; end: Date } {
  return {
    start: new Date(timeRange.start),
    end: new Date(timeRange.end)
  };
}

/**
 * Checks if two schedules overlap in time
 * @param schedule1 First schedule
 * @param schedule2 Second schedule
 * @returns Boolean indicating if the schedules overlap
 */
export function doSchedulesOverlap(
  schedule1: Schedule | ScheduleEntry | ScheduleInfo,
  schedule2: Schedule | ScheduleEntry | ScheduleInfo
): boolean {
  // Need start and end times for both schedules
  if (!schedule1.startTime || !schedule1.endTime || !schedule2.startTime || !schedule2.endTime) {
    return false;
  }
  
  const start1 = new Date(schedule1.startTime);
  const end1 = new Date(schedule1.endTime);
  const start2 = new Date(schedule2.startTime);
  const end2 = new Date(schedule2.endTime);
  
  // Check if one schedule ends before the other starts
  if (end1 <= start2 || end2 <= start1) {
    return false;
  }
  
  // Check repeat modes
  if (schedule1.repeat !== 'none' || schedule2.repeat !== 'none') {
    // For recurring schedules, we'd need more complex logic
    // This is a simplified check
    if (schedule1.repeat === schedule2.repeat) {
      // Same repeat mode, potential overlap
      return true;
    }
  }
  
  return true;
}

/**
 * Formats date and time for output
 * @param dateString ISO date string to format
 * @returns Formatted date string
 */
export function formatScheduleTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  
  // If it's today, just show the time
  if (date.toDateString() === now.toDateString()) {
    return `Today at ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // If it's tomorrow, show "Tomorrow at TIME"
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Otherwise show date and time
  return date.toLocaleString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

/**
 * Validate a schedule against a list of existing schedules
 */
export function validateSchedule(
  newSchedule: Schedule | ScheduleEntry | ScheduleInfo,
  existingSchedules: Array<Schedule | ScheduleEntry | ScheduleInfo>
): ScheduleValidationResult {
  const result: ScheduleValidationResult = {
    valid: true,
    errors: [],
    overlaps: []
  };
  
  // Basic validation
  if (!newSchedule.startTime) {
    result.valid = false;
    result.errors?.push('Start time is required');
  }
  
  if (!newSchedule.endTime) {
    result.valid = false;
    result.errors?.push('End time is required');
  }
  
  if (newSchedule.startTime && newSchedule.endTime) {
    const startTime = new Date(newSchedule.startTime);
    const endTime = new Date(newSchedule.endTime);
    
    if (startTime >= endTime) {
      result.valid = false;
      result.errors?.push('End time must be after start time');
    }
  }
  
  // Weekly schedule should have days selected
  if (newSchedule.repeat === 'weekly' && 
      (!(newSchedule as any).weeklyDays || 
       ((newSchedule as any).weeklyDays as string[]).length === 0)) {
    result.valid = false;
    result.errors?.push('Weekly schedule must have at least one day selected');
  }
  
  // Check for overlaps
  for (const existingSchedule of existingSchedules) {
    // Skip comparing to self (for edits)
    if ((newSchedule as any).id && (existingSchedule as any).id && 
        (newSchedule as any).id === (existingSchedule as any).id) {
      continue;
    }
    
    if (doSchedulesOverlap(newSchedule as Schedule, existingSchedule as Schedule)) {
      result.overlaps?.push(existingSchedule as Schedule);
    }
  }
  
  return result;
}

/**
 * Cleans up expired schedules and provides recommendations for schedule management
 * @param schedules Array of schedules to process
 * @param options Cleanup options
 * @returns Object containing cleaned schedules and recommendations
 */
export function cleanupSchedules(
  schedules: Schedule[],
  options: {
    archiveExpired?: boolean;
    maxAgeDays?: number;
    includeRecommendations?: boolean;
  } = {}
): {
  activeSchedules: Schedule[];
  expiredSchedules: Schedule[];
  recommendations: string[];
} {
  const now = new Date();
  const maxAge = options.maxAgeDays ? now.getTime() - (options.maxAgeDays * 24 * 60 * 60 * 1000) : null;
  
  const activeSchedules: Schedule[] = [];
  const expiredSchedules: Schedule[] = [];
  const recommendations: string[] = [];
  
  schedules.forEach(schedule => {
    const endTime = schedule.endTime ? new Date(schedule.endTime) : null;
    
    // Check if schedule is expired
    if (endTime && endTime < now) {
      // Check if schedule is too old to keep
      if (maxAge && endTime.getTime() < maxAge) {
        expiredSchedules.push(schedule);
        if (options.includeRecommendations) {
          recommendations.push(`Schedule "${schedule.name}" is more than ${options.maxAgeDays} days old and can be archived`);
        }
      } else if (options.archiveExpired) {
        expiredSchedules.push(schedule);
      } else {
        activeSchedules.push(schedule);
      }
    } else {
      activeSchedules.push(schedule);
    }
  });
  
  // Add recommendations for schedule optimization
  if (options.includeRecommendations) {
    // Check for overlapping schedules
    const overlappingSchedules = findOverlappingSchedules(activeSchedules);
    if (overlappingSchedules.length > 0) {
      recommendations.push(`Found ${overlappingSchedules.length} overlapping schedules. Consider adjusting priorities or times.`);
    }
    
    // Check for inactive schedules
    const inactiveCount = activeSchedules.filter(s => !s.active).length;
    if (inactiveCount > 0) {
      recommendations.push(`Found ${inactiveCount} inactive schedules. Consider cleaning up or reactivating them.`);
    }
    
    // Check for schedules with no end time
    const noEndTimeCount = activeSchedules.filter(s => !s.endTime).length;
    if (noEndTimeCount > 0) {
      recommendations.push(`Found ${noEndTimeCount} schedules with no end time. Consider setting appropriate end times.`);
    }
  }
  
  return {
    activeSchedules,
    expiredSchedules,
    recommendations
  };
}

/**
 * Finds overlapping schedules in a given array
 * @param schedules Array of schedules to check
 * @returns Array of schedule pairs that overlap
 */
export function findOverlappingSchedules(schedules: Schedule[]): Array<[Schedule, Schedule]> {
  const overlaps: Array<[Schedule, Schedule]> = [];
  
  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const s1 = schedules[i];
      const s2 = schedules[j];
      
      if (doSchedulesOverlap(s1, s2)) {
        overlaps.push([s1, s2]);
      }
    }
  }
  
  return overlaps;
} 
