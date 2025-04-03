import { apiService } from './apiService';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: {
    displayId?: string;
    groupId?: string;
    contentId?: string;
    action?: string;
    [key: string]: unknown;
  };
}

interface NotificationFilters {
  type?: Notification['type'];
  read?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

interface NotificationStats {
  total: number;
  unread: number;
  byType: {
    type: Notification['type'];
    count: number;
  }[];
}

class NotificationService {
  async getNotifications(filters?: NotificationFilters): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const response = await apiService.get<{ notifications: Notification[]; total: number }>('/notifications', {
        params: filters,
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getNotification(id: string): Promise<Notification> {
    try {
      const response = await apiService.get<{ notification: Notification }>(`/notifications/${id}`);
      return response.notification;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async markAsRead(id: string): Promise<Notification> {
    try {
      const response = await apiService.put<{ notification: Notification }>(`/notifications/${id}/read`);
      return response.notification;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      await apiService.put('/notifications/read-all');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteNotification(id: string): Promise<void> {
    try {
      await apiService.delete(`/notifications/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteAllNotifications(): Promise<void> {
    try {
      await apiService.delete('/notifications');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getNotificationStats(): Promise<NotificationStats> {
    try {
      const response = await apiService.get<{ stats: NotificationStats }>('/notifications/stats');
      return response.stats;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async subscribeToNotifications(callback: (notification: Notification) => void): Promise<void> {
    try {
      await apiService.post('/notifications/subscribe', { callback });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async unsubscribeFromNotifications(): Promise<void> {
    try {
      await apiService.post('/notifications/unsubscribe');
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

export const notificationService = new NotificationService(); 