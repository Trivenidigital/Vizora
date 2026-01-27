export enum ScheduleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DRAFT = 'DRAFT',
}

export interface TimeSlot {
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  days: number[]; // 0-6, Sunday-Saturday
}

export interface ScheduleItem {
  contentId: string;
  order: number;
}

export interface Schedule {
  id: string;
  name: string;
  status: ScheduleStatus;
  displayIds: string[];
  items: ScheduleItem[];
  timeSlots: TimeSlot[];
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduleDto {
  name: string;
  displayIds: string[];
  items: ScheduleItem[];
  timeSlots: TimeSlot[];
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateScheduleDto {
  name?: string;
  status?: ScheduleStatus;
  displayIds?: string[];
  items?: ScheduleItem[];
  timeSlots?: TimeSlot[];
  startDate?: Date;
  endDate?: Date;
}
