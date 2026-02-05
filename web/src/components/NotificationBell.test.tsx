import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationBell from './NotificationBell';
import { useNotifications } from '@/lib/hooks';

// Mock the useNotifications hook
jest.mock('@/lib/hooks', () => ({
  useNotifications: jest.fn(),
}));

const mockUseNotifications = useNotifications as jest.Mock;

describe('NotificationBell', () => {
  const defaultMockReturn = {
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    dismiss: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNotifications.mockReturnValue(defaultMockReturn);
  });

  it('renders the bell icon', () => {
    render(<NotificationBell />);

    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toBeInTheDocument();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('shows badge with unread count when there are unread notifications', () => {
    mockUseNotifications.mockReturnValue({
      ...defaultMockReturn,
      unreadCount: 5,
    });

    render(<NotificationBell />);

    const badge = screen.getByTestId('notification-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('5');
  });

  it('does not show badge when there are no unread notifications', () => {
    mockUseNotifications.mockReturnValue({
      ...defaultMockReturn,
      unreadCount: 0,
    });

    render(<NotificationBell />);

    const badge = screen.queryByTestId('notification-badge');
    expect(badge).not.toBeInTheDocument();
  });

  it('shows 99+ when unread count exceeds 99', () => {
    mockUseNotifications.mockReturnValue({
      ...defaultMockReturn,
      unreadCount: 150,
    });

    render(<NotificationBell />);

    const badge = screen.getByTestId('notification-badge');
    expect(badge).toHaveTextContent('99+');
  });

  it('toggles dropdown on click', () => {
    mockUseNotifications.mockReturnValue({
      ...defaultMockReturn,
      notifications: [
        {
          id: 'notif-1',
          title: 'Test Notification',
          message: 'Test message',
          type: 'system',
          severity: 'info',
          read: false,
          dismissedAt: null,
          organizationId: 'org-1',
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    });

    render(<NotificationBell />);

    // Initially dropdown is closed
    expect(screen.queryByRole('menu', { name: /notifications/i })).not.toBeInTheDocument();

    // Click to open
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    // Dropdown should be visible
    expect(screen.getByRole('menu', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByText('Test Notification')).toBeInTheDocument();

    // Click to close
    fireEvent.click(button);
    expect(screen.queryByRole('menu', { name: /notifications/i })).not.toBeInTheDocument();
  });

  it('calls markAsRead when clicking a notification', async () => {
    const mockMarkAsRead = jest.fn().mockResolvedValue({});
    mockUseNotifications.mockReturnValue({
      ...defaultMockReturn,
      notifications: [
        {
          id: 'notif-1',
          title: 'Unread Notification',
          message: 'Click me',
          type: 'system',
          severity: 'info',
          read: false,
          dismissedAt: null,
          organizationId: 'org-1',
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
      markAsRead: mockMarkAsRead,
    });

    render(<NotificationBell />);

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    // Click notification
    fireEvent.click(screen.getByText('Unread Notification'));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1');
    });
  });
});
