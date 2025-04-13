import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as scheduleService from '../../src/services/scheduleService';

const mockSchedule = [
  {
    _id: 'sched-001',
    name: 'Business Hours',
    contentId: 'content-001',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    repeat: 'weekly',
    priority: 1,
  },
  {
    _id: 'sched-002',
    name: 'Weekend Hours',
    contentId: 'content-002',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    startTime: '10:00',
    endTime: '18:00',
    daysOfWeek: ['saturday', 'sunday'],
    repeat: 'weekly',
    priority: 2,
  },
];

describe('Schedule Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets schedule list', async () => {
    const schedules = await scheduleService.getSchedules();
    expect(schedules).toEqual(mockSchedule);
  });

  it('gets schedule by ID', async () => {
    const schedule = await scheduleService.getScheduleById('sched-001');
    expect(schedule).toEqual(mockSchedule[0]);
  });

  it('handles schedule not found', async () => {
    await expect(scheduleService.getScheduleById('non-existent')).rejects.toThrow('Schedule not found');
  });

  it('gets active schedules for current time', async () => {
    const currentTime = new Date();
    currentTime.setHours(10, 0, 0, 0); // Set to 10:00 AM
    currentTime.setDay(1); // Set to Monday

    const activeSchedules = await scheduleService.getActiveSchedules(currentTime);
    expect(activeSchedules).toContainEqual(mockSchedule[0]);
  });

  it('handles schedule validation', async () => {
    const validSchedule = {
      ...mockSchedule[0],
      startTime: '09:00',
      endTime: '17:00',
    };
    expect(await scheduleService.validateSchedule(validSchedule)).toBe(true);

    const invalidSchedule = {
      ...mockSchedule[0],
      startTime: '17:00',
      endTime: '09:00',
    };
    await expect(scheduleService.validateSchedule(invalidSchedule)).rejects.toThrow('Invalid schedule time');
  });

  it('handles schedule overlap detection', async () => {
    const overlappingSchedule = {
      ...mockSchedule[0],
      startTime: '16:00',
      endTime: '18:00',
    };
    const hasOverlap = await scheduleService.checkScheduleOverlap(overlappingSchedule);
    expect(hasOverlap).toBe(true);

    const nonOverlappingSchedule = {
      ...mockSchedule[0],
      startTime: '18:00',
      endTime: '20:00',
    };
    const noOverlap = await scheduleService.checkScheduleOverlap(nonOverlappingSchedule);
    expect(noOverlap).toBe(false);
  });

  it('handles schedule priority resolution', async () => {
    const currentTime = new Date();
    currentTime.setHours(10, 0, 0, 0);
    currentTime.setDay(1);

    const activeSchedules = await scheduleService.getActiveSchedules(currentTime);
    const highestPrioritySchedule = await scheduleService.resolveSchedulePriority(activeSchedules);
    expect(highestPrioritySchedule.priority).toBe(1);
  });

  it('handles schedule caching', async () => {
    const schedule = mockSchedule[0];
    await scheduleService.cacheSchedule(schedule);
    
    const cachedSchedule = await scheduleService.getCachedSchedule(schedule._id);
    expect(cachedSchedule).toEqual(schedule);
  });

  it('handles schedule cache invalidation', async () => {
    const schedule = mockSchedule[0];
    await scheduleService.cacheSchedule(schedule);
    
    await scheduleService.invalidateScheduleCache(schedule._id);
    await expect(scheduleService.getCachedSchedule(schedule._id)).rejects.toThrow('Schedule not found in cache');
  });

  it('handles schedule date range validation', async () => {
    const validSchedule = {
      ...mockSchedule[0],
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    };
    expect(await scheduleService.validateScheduleDates(validSchedule)).toBe(true);

    const invalidSchedule = {
      ...mockSchedule[0],
      startDate: '2024-12-31',
      endDate: '2024-01-01',
    };
    await expect(scheduleService.validateScheduleDates(invalidSchedule)).rejects.toThrow('Invalid date range');
  });

  it('handles schedule days of week validation', async () => {
    const validSchedule = {
      ...mockSchedule[0],
      daysOfWeek: ['monday', 'tuesday', 'wednesday'],
    };
    expect(await scheduleService.validateScheduleDays(validSchedule)).toBe(true);

    const invalidSchedule = {
      ...mockSchedule[0],
      daysOfWeek: ['invalid-day'],
    };
    await expect(scheduleService.validateScheduleDays(invalidSchedule)).rejects.toThrow('Invalid day of week');
  });

  it('handles schedule repeat pattern validation', async () => {
    const validSchedule = {
      ...mockSchedule[0],
      repeat: 'weekly',
    };
    expect(await scheduleService.validateScheduleRepeat(validSchedule)).toBe(true);

    const invalidSchedule = {
      ...mockSchedule[0],
      repeat: 'invalid-repeat',
    };
    await expect(scheduleService.validateScheduleRepeat(invalidSchedule)).rejects.toThrow('Invalid repeat pattern');
  });
}); 