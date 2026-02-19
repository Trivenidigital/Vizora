import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationDropdown from '../NotificationDropdown';

const mockNotifications = [
  {
    id: 'n1',
    title: 'Device went offline',
    message: 'Lobby screen is offline',
    severity: 'critical' as const,
    read: false,
    type: 'device_offline',
    createdAt: new Date().toISOString(),
    metadata: { deviceId: 'd1' },
  },
  {
    id: 'n2',
    title: 'Content uploaded',
    message: 'New video was uploaded successfully',
    severity: 'info' as const,
    read: true,
    type: 'content_uploaded',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    metadata: {},
  },
];

describe('NotificationDropdown', () => {
  const defaultProps = {
    notifications: mockNotifications,
    onMarkAsRead: jest.fn().mockResolvedValue(undefined),
    onMarkAllAsRead: jest.fn().mockResolvedValue(undefined),
    onDismiss: jest.fn().mockResolvedValue(undefined),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders notification list', () => {
    render(<NotificationDropdown {...defaultProps} />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Device went offline')).toBeInTheDocument();
    expect(screen.getByText('Content uploaded')).toBeInTheDocument();
  });

  it('shows "Mark all as read" when unread exist', () => {
    render(<NotificationDropdown {...defaultProps} />);
    expect(screen.getByText('Mark all as read')).toBeInTheDocument();
  });

  it('hides "Mark all as read" when all are read', () => {
    const allRead = mockNotifications.map(n => ({ ...n, read: true }));
    render(<NotificationDropdown {...defaultProps} notifications={allRead} />);
    expect(screen.queryByText('Mark all as read')).not.toBeInTheDocument();
  });

  it('calls onMarkAllAsRead when button is clicked', async () => {
    const onMarkAllAsRead = jest.fn().mockResolvedValue(undefined);
    render(<NotificationDropdown {...defaultProps} onMarkAllAsRead={onMarkAllAsRead} />);
    fireEvent.click(screen.getByText('Mark all as read'));
    await waitFor(() => expect(onMarkAllAsRead).toHaveBeenCalledTimes(1));
  });

  it('shows empty state when no notifications', () => {
    render(<NotificationDropdown {...defaultProps} notifications={[]} />);
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('calls onMarkAsRead when unread notification is clicked', async () => {
    const onMarkAsRead = jest.fn().mockResolvedValue(undefined);
    render(<NotificationDropdown {...defaultProps} onMarkAsRead={onMarkAsRead} />);
    fireEvent.click(screen.getByText('Device went offline'));
    await waitFor(() => expect(onMarkAsRead).toHaveBeenCalledWith('n1'));
  });

  it('has role="menu" for accessibility', () => {
    render(<NotificationDropdown {...defaultProps} />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});
