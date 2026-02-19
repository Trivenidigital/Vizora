import { renderHook, waitFor, act } from '@testing-library/react';
import { useNotifications } from '../useNotifications';

jest.mock('@/lib/api', () => {
  const mockNotifications = [
    { id: 'n1', title: 'Test', message: 'Test message', read: false, severity: 'info', type: 'general', createdAt: new Date().toISOString() },
    { id: 'n2', title: 'Test 2', message: 'Test message 2', read: true, severity: 'warning', type: 'general', createdAt: new Date().toISOString() },
  ];
  return {
    apiClient: {
      getNotifications: jest.fn().mockResolvedValue({ data: mockNotifications }),
      getUnreadNotificationCount: jest.fn().mockResolvedValue({ count: 1 }),
      markNotificationAsRead: jest.fn().mockResolvedValue({ ...mockNotifications[0], read: true }),
      markAllNotificationsAsRead: jest.fn().mockResolvedValue(undefined),
      dismissNotification: jest.fn().mockResolvedValue(undefined),
      getCurrentUser: jest.fn().mockResolvedValue({ id: 'u1', email: 'test@test.com', firstName: 'Test', lastName: 'User', organizationId: 'org1', role: 'admin' }),
      setAuthenticated: jest.fn(),
      logout: jest.fn(),
    },
  };
});

const stableOn = jest.fn(() => jest.fn());
jest.mock('../useSocket', () => ({
  useSocket: () => ({
    on: stableOn,
    isConnected: false,
    socket: null,
    emit: jest.fn(),
    once: jest.fn(),
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    connectionError: null,
    lastMessage: null,
  }),
}));

jest.mock('../useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', organizationId: 'org1' },
    loading: false,
    isAuthenticated: true,
    error: null,
    logout: jest.fn(),
    reload: jest.fn(),
  }),
}));

const hookOptions = { autoFetch: true, pollInterval: 999999999 };

describe('useNotifications', () => {
  it('fetches notifications on mount', async () => {
    const { result } = renderHook(() => useNotifications(hookOptions));

    await waitFor(() => {
      expect(result.current.notifications.length).toBeGreaterThan(0);
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
  });

  it('calls API methods', () => {
    renderHook(() => useNotifications(hookOptions));
    const { apiClient } = require('@/lib/api');
    expect(apiClient.getNotifications).toHaveBeenCalled();
    expect(apiClient.getUnreadNotificationCount).toHaveBeenCalled();
  });

  it('returns expected API functions', () => {
    const { result } = renderHook(() => useNotifications(hookOptions));
    expect(typeof result.current.markAsRead).toBe('function');
    expect(typeof result.current.markAllAsRead).toBe('function');
    expect(typeof result.current.dismiss).toBe('function');
    expect(typeof result.current.refresh).toBe('function');
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useNotifications(hookOptions));
    expect(result.current.loading).toBe(true);
  });
});
