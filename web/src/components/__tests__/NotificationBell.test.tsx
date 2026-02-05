import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationBell from '../NotificationBell';

// Mock the hooks
const mockUseNotifications = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  dismiss: jest.fn(),
};

jest.mock('@/lib/hooks', () => ({
  useNotifications: () => mockUseNotifications,
}));

// Mock NotificationDropdown
jest.mock('../NotificationDropdown', () => {
  return function MockNotificationDropdown({
    onClose,
    notifications,
    onMarkAsRead,
    onMarkAllAsRead,
    onDismiss,
  }: any) {
    return (
      <div data-testid="notification-dropdown">
        <button onClick={onClose} data-testid="close-dropdown">
          Close
        </button>
        <span data-testid="notification-count">{notifications.length}</span>
      </div>
    );
  };
});

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNotifications.notifications = [];
    mockUseNotifications.unreadCount = 0;
    mockUseNotifications.loading = false;
  });

  it('renders the bell button', () => {
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  it('shows unread count badge when there are unread notifications', () => {
    mockUseNotifications.unreadCount = 5;
    render(<NotificationBell />);
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('5');
  });

  it('shows 99+ when unread count exceeds 99', () => {
    mockUseNotifications.unreadCount = 150;
    render(<NotificationBell />);
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('99+');
  });

  it('does not show badge when there are no unread notifications', () => {
    mockUseNotifications.unreadCount = 0;
    render(<NotificationBell />);
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  it('toggles dropdown on click', () => {
    render(<NotificationBell />);
    const button = screen.getByRole('button', { name: /notifications/i });

    // Initially dropdown is not visible
    expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(button);
    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();

    // Click to close
    fireEvent.click(button);
    expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', async () => {
    render(
      <div>
        <NotificationBell />
        <button data-testid="outside-button">Outside</button>
      </div>
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside-button'));
    await waitFor(() => {
      expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument();
    });
  });
});
