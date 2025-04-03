import { apiService } from './apiService';

interface Display {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'maintenance';
  lastSeen: string;
  ipAddress: string;
  macAddress: string;
  firmwareVersion: string;
  model: string;
  resolution: string;
  orientation: 'portrait' | 'landscape';
  brightness: number;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;
  currentContent: {
    id: string;
    name: string;
    type: string;
    duration: number;
    startTime: string;
    endTime: string;
  } | null;
  schedule: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    content: {
      id: string;
      name: string;
      type: string;
      duration: number;
    }[];
  }[];
  group: {
    id: string;
    name: string;
  } | null;
  settings: {
    autoStart: boolean;
    autoUpdate: boolean;
    updateSchedule: string;
    maintenanceMode: boolean;
    networkSettings: {
      dhcp: boolean;
      staticIp?: string;
      gateway?: string;
      dns?: string[];
    };
  };
}

interface DisplayFilters {
  status?: Display['status'];
  groupId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface DisplayStats {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  groups: {
    id: string;
    name: string;
    count: number;
  }[];
}

class DisplayService {
  async getDisplays(filters?: DisplayFilters): Promise<{ displays: Display[]; total: number }> {
    try {
      const response = await apiService.get<{ displays: Display[]; total: number }>('/displays', {
        params: filters,
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getDisplay(id: string): Promise<Display> {
    try {
      const response = await apiService.get<{ display: Display }>(`/displays/${id}`);
      return response.display;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createDisplay(data: Omit<Display, 'id' | 'lastSeen' | 'currentContent' | 'schedule' | 'group'>): Promise<Display> {
    try {
      const response = await apiService.post<{ display: Display }>('/displays', data);
      return response.display;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateDisplay(id: string, data: Partial<Display>): Promise<Display> {
    try {
      const response = await apiService.put<{ display: Display }>(`/displays/${id}`, data);
      return response.display;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteDisplay(id: string): Promise<void> {
    try {
      await apiService.delete(`/displays/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getDisplayStats(): Promise<DisplayStats> {
    try {
      const response = await apiService.get<{ stats: DisplayStats }>('/displays/stats');
      return response.stats;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async restartDisplay(id: string): Promise<void> {
    try {
      await apiService.post(`/displays/${id}/restart`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateDisplayFirmware(id: string): Promise<void> {
    try {
      await apiService.post(`/displays/${id}/firmware/update`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getDisplayLogs(id: string, startTime?: string, endTime?: string): Promise<{
    id: string;
    timestamp: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    metadata?: Record<string, unknown>;
  }[]> {
    try {
      const response = await apiService.get<{
        logs: {
          id: string;
          timestamp: string;
          level: 'info' | 'warning' | 'error';
          message: string;
          metadata?: Record<string, unknown>;
        }[];
      }>(`/displays/${id}/logs`, {
        params: { startTime, endTime },
      });
      return response.logs;
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

export const displayService = new DisplayService(); 