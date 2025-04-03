import { apiService } from './apiService';

interface Backup {
  id: string;
  name: string;
  description?: string;
  type: 'full' | 'incremental';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  size: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
  metadata: {
    version: string;
    databaseSize: number;
    filesSize: number;
    totalFiles: number;
    compression: boolean;
    encryption: boolean;
  };
}

interface BackupFilters {
  type?: Backup['type'];
  status?: Backup['status'];
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface BackupStats {
  total: number;
  totalSize: number;
  byType: {
    type: Backup['type'];
    count: number;
    size: number;
  }[];
  byStatus: {
    status: Backup['status'];
    count: number;
  }[];
  recent: Backup[];
}

class BackupService {
  async getBackups(filters?: BackupFilters): Promise<{ backups: Backup[]; total: number }> {
    try {
      const response = await apiService.get<{ backups: Backup[]; total: number }>('/backups', {
        params: filters,
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getBackup(id: string): Promise<Backup> {
    try {
      const response = await apiService.get<{ backup: Backup }>(`/backups/${id}`);
      return response.backup;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createBackup(data: {
    name: string;
    description?: string;
    type: Backup['type'];
  }): Promise<Backup> {
    try {
      const response = await apiService.post<{ backup: Backup }>('/backups', data);
      return response.backup;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteBackup(id: string): Promise<void> {
    try {
      await apiService.delete(`/backups/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getBackupStats(): Promise<BackupStats> {
    try {
      const response = await apiService.get<{ stats: BackupStats }>('/backups/stats');
      return response.stats;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async downloadBackup(id: string): Promise<Blob> {
    try {
      const response = await apiService.get(`/backups/${id}/download`, {
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async restoreBackup(id: string): Promise<void> {
    try {
      await apiService.post(`/backups/${id}/restore`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async verifyBackup(id: string): Promise<{ isValid: boolean; errors?: string[] }> {
    try {
      const response = await apiService.get<{ isValid: boolean; errors?: string[] }>(
        `/backups/${id}/verify`
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async scheduleBackup(data: {
    name: string;
    description?: string;
    type: Backup['type'];
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      time: string;
      daysOfWeek?: number[];
      retention: number;
    };
  }): Promise<Backup> {
    try {
      const response = await apiService.post<{ backup: Backup }>('/backups/schedule', data);
      return response.backup;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async cancelScheduledBackup(id: string): Promise<void> {
    try {
      await apiService.delete(`/backups/${id}/schedule`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getBackupLogs(id: string): Promise<{
    id: string;
    timestamp: string;
    level: 'info' | 'warning' | 'error';
    message: string;
  }[]> {
    try {
      const response = await apiService.get<{
        logs: {
          id: string;
          timestamp: string;
          level: 'info' | 'warning' | 'error';
          message: string;
        }[];
      }>(`/backups/${id}/logs`);
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

export const backupService = new BackupService(); 