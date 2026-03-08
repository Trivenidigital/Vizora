// Schedule API methods

import type { Schedule, PaginatedResponse } from '../types';
import { ApiClient, ScheduleData } from './client';

declare module './client' {
  interface ApiClient {
    getSchedules(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Schedule>>;
    createSchedule(data: ScheduleData): Promise<Schedule>;
    updateSchedule(id: string, data: Partial<ScheduleData>): Promise<Schedule>;
    deleteSchedule(id: string): Promise<void>;
    duplicateSchedule(id: string): Promise<Schedule>;
    checkScheduleConflicts(data: { displayId?: string; displayGroupId?: string; daysOfWeek: number[]; startTime?: string; endTime?: string; excludeScheduleId?: string }): Promise<{ hasConflicts: boolean; conflicts: any[] }>;
  }
}

ApiClient.prototype.getSchedules = async function (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Schedule>> {
  const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
  return this.request<PaginatedResponse<Schedule>>(`/schedules${query ? `?${query}` : ''}`);
};

ApiClient.prototype.createSchedule = async function (data: ScheduleData): Promise<Schedule> {
  return this.request<Schedule>('/schedules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updateSchedule = async function (id: string, data: Partial<ScheduleData>): Promise<Schedule> {
  return this.request<Schedule>(`/schedules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.deleteSchedule = async function (id: string): Promise<void> {
  return this.request<void>(`/schedules/${id}`, {
    method: 'DELETE',
  });
};

ApiClient.prototype.duplicateSchedule = async function (id: string): Promise<Schedule> {
  return this.request<Schedule>(`/schedules/${id}/duplicate`, {
    method: 'POST',
  });
};

ApiClient.prototype.checkScheduleConflicts = async function (data: {
  displayId?: string;
  displayGroupId?: string;
  daysOfWeek: number[];
  startTime?: string;
  endTime?: string;
  excludeScheduleId?: string;
}): Promise<{ hasConflicts: boolean; conflicts: any[] }> {
  return this.request<{ hasConflicts: boolean; conflicts: any[] }>('/schedules/check-conflicts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};
