export interface Schedule {
  id: string;
  name: string;
  contentId: string;
  displayId: string;
  startTime?: string;
  endTime?: string;
  repeat: RepeatMode;
  priority?: number;
  active?: boolean;
  createdAt: string;
  updatedAt?: string;
  _id?: string; // MongoDB ID for backward compatibility
}

export interface ScheduleInfo {
  startTime?: string;
  endTime?: string;
  repeat: RepeatMode;
  priority: number;
}

export type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';

export interface DaysOfWeek {
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
}

export interface MonthlyRepeatOptions {
  dayOfMonth?: number; // 1-31
  weekOfMonth?: number; // 1-5 (1st, 2nd, 3rd, 4th, last)
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
}

export interface ScheduleRepeatMetadata {
  daysOfWeek?: DaysOfWeek;
  monthlyOptions?: MonthlyRepeatOptions;
}

export interface TimeRange {
  start: string; // ISO string
  end: string; // ISO string
}

export interface ScheduledContent {
  id: string;
  contentId: string;
  schedule: Schedule;
  content?: any; // Content details when populated
}

export interface ScheduleValidationResult {
  valid: boolean;
  overlaps?: Schedule[];
  errors?: string[];
}

// For middleware internal use
export interface ScheduleEntry {
  _id?: string;
  contentId: string;
  startTime?: Date;
  endTime?: Date;
  repeat: RepeatMode;
  priority: number;
  active: boolean;
  createdAt: Date;
}

export interface SchedulePayload {
  contentId: string;
  startTime?: string;
  endTime?: string;
  repeat?: RepeatMode;
  priority?: number;
} 