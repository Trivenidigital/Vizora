/**
 * Common Package Sanity Check
 * 
 * This file imports all critical exports to verify they're properly exposed.
 * Run this file occasionally to make sure exports don't silently break.
 */

// Import schedule utilities
import {
  isScheduleActive,
  isDailyScheduleActive,
  isWeeklyScheduleActive, 
  isMonthlyScheduleActive,
  getActiveSchedules,
  getHighestPrioritySchedule,
  getNextSchedule,
  processScheduledContent,
  formatTimeRange,
  parseTimeRange,
  doSchedulesOverlap,
  formatScheduleTime,
  validateSchedule,
  cleanupSchedules,
  findOverlappingSchedules,
  // Added export functions
  validateSchedules,
  exportSchedules,
  filterSchedulesByArchiveStatus
} from './src';

// Import types
import {
  Schedule,
  RepeatMode,
  TimeRange,
  ScheduleEntry,
  ScheduleInfo,
  ScheduleValidationResult,
  DaysOfWeek,
  MonthlyRepeatOptions,
  ScheduleRepeatMetadata
} from './src';

// AI tools
import { aiTools } from './src';

// Print confirmation message
console.log('✅ All named exports resolved successfully!');

/**
 * Run this file with:
 * ts-node sanity-check.ts
 * 
 * Or using the TypeScript compiler:
 * tsc sanity-check.ts --noEmit
 */ 