import { vi } from 'vitest';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  createdAt: string;
  relatedTo?: {
    type: 'content' | 'display' | 'schedule' | 'user' | 'system';
    id: string;
    name?: string;
  };
}

export const mockNotifications: Notification[] = [
  {
    id: 'not-1',
    title: 'Display Offline',
    message: 'Display "Lobby Screen" has gone offline',
    type: 'error',
    isRead: false,
    createdAt: '2023-06-15T10:30:45Z',
    relatedTo: {
      type: 'display',
      id: 'disp-1',
      name: 'Lobby Screen'
    }
  },
  {
    id: 'not-2',
    title: 'New Schedule Published',
    message: 'Schedule "Summer Promotion" has been published and is now active',
    type: 'success',
    isRead: true,
    createdAt: '2023-06-14T14:22:10Z',
    relatedTo: {
      type: 'schedule',
      id: 'sch-1',
      name: 'Summer Promotion'
    }
  },
  {
    id: 'not-3',
    title: 'Content Upload Complete',
    message: 'Your video "Product Demo" has been processed and is ready for use',
    type: 'info',
    isRead: false,
    createdAt: '2023-06-14T09:15:30Z',
    relatedTo: {
      type: 'content',
      id: 'cont-1',
      name: 'Product Demo'
    }
  },
  {
    id: 'not-4',
    title: 'System Maintenance',
    message: 'Scheduled maintenance will occur on June 20th from 2-4 AM EST',
    type: 'warning',
    isRead: false,
    createdAt: '2023-06-13T16:45:00Z',
    relatedTo: {
      type: 'system',
      id: 'sys-maint-1'
    }
  },
  {
    id: 'not-5',
    title: 'New User Joined',
    message: 'Sarah Johnson has joined your organization',
    type: 'info',
    isRead: true,
    createdAt: '2023-06-12T11:10:15Z',
    relatedTo: {
      type: 'user',
      id: 'user-2',
      name: 'Sarah Johnson'
    }
  }
];

export const notificationService = {
  getNotifications: vi.fn().mockResolvedValue(mockNotifications),
  
  getUnreadCount: vi.fn().mockResolvedValue(
    mockNotifications.filter(n => !n.isRead).length
  ),
  
  getNotificationById: vi.fn().mockImplementation((id: string) => {
    const notification = mockNotifications.find(n => n.id === id);
    if (notification) {
      return Promise.resolve(notification);
    }
    return Promise.reject(new Error('Notification not found'));
  }),
  
  markAsRead: vi.fn().mockImplementation((id: string) => {
    const notification = mockNotifications.find(n => n.id === id);
    if (notification) {
      notification.isRead = true;
      return Promise.resolve(notification);
    }
    return Promise.reject(new Error('Notification not found'));
  }),
  
  markAllAsRead: vi.fn().mockImplementation(() => {
    mockNotifications.forEach(n => {
      n.isRead = true;
    });
    return Promise.resolve(true);
  }),
  
  deleteNotification: vi.fn().mockImplementation((id: string) => {
    const notificationIndex = mockNotifications.findIndex(n => n.id === id);
    if (notificationIndex !== -1) {
      mockNotifications.splice(notificationIndex, 1);
      return Promise.resolve(true);
    }
    return Promise.reject(new Error('Notification not found'));
  }),
  
  subscribeToNotifications: vi.fn().mockImplementation((callback) => {
    // Normally would set up WebSocket or SSE connection
    // For mocking, we just return an unsubscribe function
    return () => {
      // Unsubscribe function
    };
  }),
  
  getNotificationsByType: vi.fn().mockImplementation((type: 'info' | 'warning' | 'error' | 'success') => {
    return Promise.resolve(mockNotifications.filter(n => n.type === type));
  }),
  
  getNotificationsByRelatedEntity: vi.fn().mockImplementation((entityType: string, entityId: string) => {
    return Promise.resolve(
      mockNotifications.filter(
        n => n.relatedTo?.type === entityType && n.relatedTo?.id === entityId
      )
    );
  })
}; 