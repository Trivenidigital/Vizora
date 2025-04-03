import { apiService } from './apiService';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  metadata?: {
    userId?: string;
    displayId?: string;
    groupId?: string;
    contentId?: string;
    action?: string;
    [key: string]: unknown;
  };
  stack?: string;
}

interface LogFilters {
  level?: LogEntry['level'];
  category?: string;
  startTime?: string;
  endTime?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface LogStats {
  total: number;
  byLevel: {
    level: LogEntry['level'];
    count: number;
  }[];
  byCategory: {
    category: string;
    count: number;
  }[];
  recent: LogEntry[];
}

class LogService {
  async getLogs(filters?: LogFilters): Promise<{ logs: LogEntry[]; total: number }> {
    try {
      const response = await apiService.get<{ logs: LogEntry[]; total: number }>('/logs', {
        params: filters,
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLog(id: string): Promise<LogEntry> {
    try {
      const response = await apiService.get<{ log: LogEntry }>(`/logs/${id}`);
      return response.log;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLogStats(): Promise<LogStats> {
    try {
      const response = await apiService.get<{ stats: LogStats }>('/logs/stats');
      return response.stats;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async exportLogs(filters?: LogFilters): Promise<Blob> {
    try {
      const response = await apiService.get('/logs/export', {
        params: filters,
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async clearLogs(filters?: LogFilters): Promise<void> {
    try {
      await apiService.delete('/logs', {
        data: filters,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLogCategories(): Promise<string[]> {
    try {
      const response = await apiService.get<{ categories: string[] }>('/logs/categories');
      return response.categories;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLogLevels(): Promise<LogEntry['level'][]> {
    try {
      const response = await apiService.get<{ levels: LogEntry['level'][] }>('/logs/levels');
      return response.levels;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLogsByCategory(category: string, filters?: Omit<LogFilters, 'category'>): Promise<{
    logs: LogEntry[];
    total: number;
  }> {
    try {
      const response = await apiService.get<{ logs: LogEntry[]; total: number }>(
        `/logs/categories/${category}`,
        {
          params: filters,
        }
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLogsByLevel(level: LogEntry['level'], filters?: Omit<LogFilters, 'level'>): Promise<{
    logs: LogEntry[];
    total: number;
  }> {
    try {
      const response = await apiService.get<{ logs: LogEntry[]; total: number }>(
        `/logs/levels/${level}`,
        {
          params: filters,
        }
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLogsByTimeRange(startTime: string, endTime: string, filters?: Omit<LogFilters, 'startTime' | 'endTime'>): Promise<{
    logs: LogEntry[];
    total: number;
  }> {
    try {
      const response = await apiService.get<{ logs: LogEntry[]; total: number }>('/logs/time-range', {
        params: {
          startTime,
          endTime,
          ...filters,
        },
      });
      return response;
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

export const logService = new LogService(); 