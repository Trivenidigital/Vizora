import { apiService } from './apiService';

interface Schedule {
  id: string;
  name: string;
  description?: string;
  type: 'display' | 'group';
  targetId: string;
  content: {
    id: string;
    name: string;
    type: string;
    duration: number;
    startTime: string;
    endTime: string;
  }[];
  timezone: string;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[];
  startDate: string;
  endDate?: string;
  priority: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
  };
}

interface ScheduleFilters {
  type?: Schedule['type'];
  status?: Schedule['status'];
  targetId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface ScheduleStats {
  total: number;
  active: number;
  paused: number;
  completed: number;
  cancelled: number;
  byType: {
    type: Schedule['type'];
    count: number;
  }[];
  byStatus: {
    status: Schedule['status'];
    count: number;
  }[];
  recent: Schedule[];
}

class ScheduleService {
  async getSchedules(filters?: ScheduleFilters): Promise<{ schedules: Schedule[]; total: number }> {
    try {
      const response = await apiService.get<{ schedules: Schedule[]; total: number }>('/schedules', {
        params: filters,
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSchedule(id: string): Promise<Schedule> {
    try {
      const response = await apiService.get<{ schedule: Schedule }>(`/schedules/${id}`);
      return response.schedule;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createSchedule(data: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<Schedule> {
    try {
      const response = await apiService.post<{ schedule: Schedule }>('/schedules', data);
      return response.schedule;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateSchedule(id: string, data: Partial<Schedule>): Promise<Schedule> {
    try {
      const response = await apiService.put<{ schedule: Schedule }>(`/schedules/${id}`, data);
      return response.schedule;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteSchedule(id: string): Promise<void> {
    try {
      await apiService.delete(`/schedules/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getScheduleStats(): Promise<ScheduleStats> {
    try {
      const response = await apiService.get<{ stats: ScheduleStats }>('/schedules/stats');
      return response.stats;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async pauseSchedule(id: string): Promise<Schedule> {
    try {
      const response = await apiService.post<{ schedule: Schedule }>(`/schedules/${id}/pause`);
      return response.schedule;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async resumeSchedule(id: string): Promise<Schedule> {
    try {
      const response = await apiService.post<{ schedule: Schedule }>(`/schedules/${id}/resume`);
      return response.schedule;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async cancelSchedule(id: string): Promise<Schedule> {
    try {
      const response = await apiService.post<{ schedule: Schedule }>(`/schedules/${id}/cancel`);
      return response.schedule;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async duplicateSchedule(id: string): Promise<Schedule> {
    try {
      const response = await apiService.post<{ schedule: Schedule }>(`/schedules/${id}/duplicate`);
      return response.schedule;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getScheduleContent(id: string): Promise<Schedule['content']> {
    try {
      const response = await apiService.get<{ content: Schedule['content'] }>(`/schedules/${id}/content`);
      return response.content;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateScheduleContent(id: string, content: Schedule['content']): Promise<Schedule> {
    try {
      const response = await apiService.put<{ schedule: Schedule }>(`/schedules/${id}/content`, content);
      return response.schedule;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getScheduleHistory(id: string): Promise<{
    id: string;
    timestamp: string;
    action: string;
    details: string;
    user: {
      id: string;
      name: string;
    };
  }[]> {
    try {
      const response = await apiService.get<{
        history: {
          id: string;
          timestamp: string;
          action: string;
          details: string;
          user: {
            id: string;
            name: string;
          };
        }[];
      }>(`/schedules/${id}/history`);
      return response.history;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error('An unexpected error occurred');
  }
}

export const scheduleService = new ScheduleService(); 