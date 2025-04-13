import { format, isWithinInterval, setHours, setMinutes } from 'date-fns';
import { Schedule, TimeRange } from '../types';

/**
 * Check if a schedule is currently active based on the current time
 * @param schedule The schedule to check
 * @param currentTime The current time to check against
 * @returns boolean indicating if the schedule is active
 */
export function isScheduleActive(schedule: Schedule, currentTime: Date = new Date()): boolean {
  if (!schedule) return false;
  
  // Handle date properties that might be stored in different formats
  const startDate = new Date(schedule.startTime || (schedule as any).startDate || '');
  const endDate = new Date(schedule.endTime || (schedule as any).endDate || '');

  // Check if current time is within the schedule's date range
  if (!isWithinInterval(currentTime, { start: startDate, end: endDate })) {
    return false;
  }

  // Parse start and end times (handle potentially undefined values)
  if (!schedule.startTime || !schedule.endTime) return false;
  
  const [startHour, startMinute] = schedule.startTime?.split(':').map(Number) || [0, 0];
  const [endHour, endMinute] = schedule.endTime?.split(':').map(Number) || [0, 0];

  // Check if current time is within the schedule's time range
  const currentTimeOfDay = setMinutes(setHours(currentTime, 0), 0);
  const scheduleStartTime = setMinutes(setHours(currentTimeOfDay, startHour), startMinute);
  const scheduleEndTime = setMinutes(setHours(currentTimeOfDay, endHour), endMinute);

  // Check if current day is in the schedule's days of week
  const currentDay = format(currentTime, 'EEEE').toLowerCase();
  const daysOfWeek = (schedule as any).daysOfWeek || [];
  if (daysOfWeek.length > 0 && !daysOfWeek.includes(currentDay)) {
    return false;
  }

  return isWithinInterval(currentTime, { start: scheduleStartTime, end: scheduleEndTime });
}

/**
 * Get all currently active schedules from a list of schedules
 * @param schedules List of schedules to check
 * @param currentTime The current time to check against
 * @returns Array of active schedules
 */
export function getActiveSchedules(schedules: Schedule[], currentTime: Date = new Date()): Schedule[] {
  if (!schedules || !Array.isArray(schedules)) return [];
  return schedules.filter(schedule => isScheduleActive(schedule, currentTime));
}

/**
 * Get the highest priority schedule from a list of schedules
 * @param schedules List of schedules to check
 * @returns The highest priority schedule or undefined if no schedules
 */
export function resolveSchedulePriority(schedules: Schedule[]): Schedule | undefined {
  if (!schedules || schedules.length === 0) return undefined;
  return schedules.reduce((prev, current) => {
    const prevPriority = prev.priority ?? 0;
    const currentPriority = current.priority ?? 0;
    return currentPriority > prevPriority ? current : prev;
  });
}

/**
 * Parse a time range into start and end dates
 * @param timeRange The time range to parse
 * @returns Object containing start and end dates
 */
export function parseTimeRange(timeRange: TimeRange): { start: Date; end: Date } {
  return {
    start: new Date(timeRange.start),
    end: new Date(timeRange.end),
  };
}

/**
 * Format start and end dates into a TimeRange object
 * @param start The start date
 * @param end The end date
 * @returns TimeRange object
 */
export function formatTimeRange(start: Date, end: Date): TimeRange {
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Get the next occurrence of a schedule based on the current time
 * @param schedule The schedule to check
 * @param currentTime The current time to check against
 * @returns The next date when the schedule will be active
 */
export function getNextScheduleTime(schedule: Schedule, currentTime: Date = new Date()): Date {
  let nextDate = new Date(currentTime);

  // If schedule is currently active, return current time
  if (isScheduleActive(schedule, currentTime)) {
    return currentTime;
  }

  // Find the next day that matches the schedule's days of week
  const daysOfWeek = (schedule as any).daysOfWeek || [];
  while (daysOfWeek.length > 0 && !daysOfWeek.includes(format(nextDate, 'EEEE').toLowerCase())) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  // Set the time to the schedule's start time
  if (schedule.startTime) {
    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
    nextDate = setMinutes(setHours(nextDate, startHour), startMinute);
  }

  return nextDate;
}

/**
 * Check if a schedule overlaps with any existing schedules
 * @param newSchedule The new schedule to check
 * @param existingSchedules List of existing schedules
 * @returns boolean indicating if there is an overlap
 */
export function validateScheduleOverlap(newSchedule: Schedule, existingSchedules: Schedule[]): boolean {
  if (!newSchedule || !existingSchedules || !Array.isArray(existingSchedules)) return false;
  
  const newStart = new Date(newSchedule.startTime || (newSchedule as any).startDate || '');
  const newEnd = new Date(newSchedule.endTime || (newSchedule as any).endDate || '');

  return existingSchedules.some(schedule => {
    const existingStart = new Date(schedule.startTime || (schedule as any).startDate || '');
    const existingEnd = new Date(schedule.endTime || (schedule as any).endDate || '');

    // Check if date ranges overlap
    const dateOverlap = isWithinInterval(newStart, { start: existingStart, end: existingEnd }) ||
                       isWithinInterval(newEnd, { start: existingStart, end: existingEnd });

    if (!dateOverlap) return false;

    // Check if time ranges overlap
    if (!newSchedule.startTime || !newSchedule.endTime || !schedule.startTime || !schedule.endTime) {
      return false;
    }
    
    const [newStartHour, newStartMinute] = newSchedule.startTime.split(':').map(Number);
    const [newEndHour, newEndMinute] = newSchedule.endTime.split(':').map(Number);
    const [existingStartHour, existingStartMinute] = schedule.startTime.split(':').map(Number);
    const [existingEndHour, existingEndMinute] = schedule.endTime.split(':').map(Number);

    const baseDate = new Date();
    const newStartTime = setMinutes(setHours(baseDate, newStartHour), newStartMinute);
    const newEndTime = setMinutes(setHours(baseDate, newEndHour), newEndMinute);
    const existingStartTime = setMinutes(setHours(baseDate, existingStartHour), existingStartMinute);
    const existingEndTime = setMinutes(setHours(baseDate, existingEndHour), existingEndMinute);

    const timeOverlap = isWithinInterval(newStartTime, { start: existingStartTime, end: existingEndTime }) ||
                       isWithinInterval(newEndTime, { start: existingStartTime, end: existingEndTime });

    if (!timeOverlap) return false;

    // Check if days of week overlap
    const newDays = (newSchedule as any).daysOfWeek || [];
    const existingDays = (schedule as any).daysOfWeek || [];
    
    if (newDays.length === 0 || existingDays.length === 0) return true;
    
    return newDays.some((day: string) => existingDays.includes(day));
  });
} 