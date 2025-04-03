import { apiService } from './apiService';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  permissions: string[];
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      displayAlerts: boolean;
      contentUpdates: boolean;
      systemUpdates: boolean;
    };
  };
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserFilters {
  role?: User['role'];
  status?: User['status'];
  search?: string;
  page?: number;
  limit?: number;
}

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  byRole: {
    role: User['role'];
    count: number;
  }[];
  recent: User[];
}

class UserService {
  async getUsers(filters?: UserFilters): Promise<{ users: User[]; total: number }> {
    try {
      const response = await apiService.get<{ users: User[]; total: number }>('/users', {
        params: filters,
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUser(id: string): Promise<User> {
    try {
      const response = await apiService.get<{ user: User }>(`/users/${id}`);
      return response.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin'>): Promise<User> {
    try {
      const response = await apiService.post<{ user: User }>('/users', data);
      return response.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    try {
      const response = await apiService.put<{ user: User }>(`/users/${id}`, data);
      return response.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      await apiService.delete(`/users/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserStats(): Promise<UserStats> {
    try {
      const response = await apiService.get<{ stats: UserStats }>('/users/stats');
      return response.stats;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUserPreferences(id: string, preferences: User['preferences']): Promise<User> {
    try {
      const response = await apiService.put<{ user: User }>(`/users/${id}/preferences`, preferences);
      return response.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUserPermissions(id: string, permissions: string[]): Promise<User> {
    try {
      const response = await apiService.put<{ user: User }>(`/users/${id}/permissions`, {
        permissions,
      });
      return response.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async suspendUser(id: string, reason: string): Promise<User> {
    try {
      const response = await apiService.post<{ user: User }>(`/users/${id}/suspend`, { reason });
      return response.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async activateUser(id: string): Promise<User> {
    try {
      const response = await apiService.post<{ user: User }>(`/users/${id}/activate`);
      return response.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async resetUserPassword(id: string): Promise<void> {
    try {
      await apiService.post(`/users/${id}/reset-password`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserActivity(id: string): Promise<{
    id: string;
    timestamp: string;
    action: string;
    details: string;
    ip: string;
    userAgent: string;
  }[]> {
    try {
      const response = await apiService.get<{
        activity: {
          id: string;
          timestamp: string;
          action: string;
          details: string;
          ip: string;
          userAgent: string;
        }[];
      }>(`/users/${id}/activity`);
      return response.activity;
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

export const userService = new UserService(); 