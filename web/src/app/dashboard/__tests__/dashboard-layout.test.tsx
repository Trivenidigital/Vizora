import { act, render, waitFor } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import DashboardLayout from '../layout';
import { useSocket } from '@/lib/hooks/useSocket';

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  once: jest.fn(),
  close: jest.fn(),
  id: 'layout-socket-id',
  io: {
    on: jest.fn(),
  },
};

jest.mock('socket.io-client', () => ({
  __esModule: true,
  default: jest.fn(() => mockSocket),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: () => '/dashboard',
}));

jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'operator@example.com',
      firstName: 'Operator',
      lastName: 'One',
      organizationId: 'org-1',
      role: 'admin',
    },
    loading: false,
    logout: jest.fn(),
  }),
}));

jest.mock('@/components/providers/CustomizationProvider', () => ({
  useCustomization: () => ({
    brandConfig: null,
  }),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getDisplays: jest.fn().mockResolvedValue({ data: [] }),
    getNotifications: jest.fn().mockResolvedValue({ data: [] }),
    getUnreadNotificationCount: jest.fn().mockResolvedValue({ count: 0 }),
    getEntitlementBanner: jest.fn().mockResolvedValue(null),
    setAuthenticated: jest.fn(),
  },
}));

jest.mock('@/lib/providers/QueryProvider', () => {
  return function MockQueryProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
  };
});

jest.mock('@/components/support/SupportChatProvider', () => ({
  SupportChatProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/support/SupportChat', () => ({
  SupportChat: () => <div data-testid="support-chat" />,
}));

jest.mock('@/components/TrialBanner', () => {
  return function MockTrialBanner() {
    return null;
  };
});

jest.mock('@/components/Breadcrumbs', () => {
  return function MockBreadcrumbs() {
    return <nav data-testid="breadcrumbs" />;
  };
});

jest.mock('@/components/ThemeToggle', () => {
  return function MockThemeToggle() {
    return <button type="button">Theme</button>;
  };
});

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

function RealtimeChild() {
  const socket = useSocket({ auth: { organizationId: 'org-1' } });
  useEffect(() => {
    if (!socket.isConnected) return;
    return socket.on('child:event', jest.fn());
  }, [socket]);
  return <div data-testid="realtime-child" />;
}

describe('DashboardLayout shared socket integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.once.mockReset();
    mockSocket.close.mockReset();
    mockSocket.io.on.mockReset();
  });

  it('shares one org-scoped socket across dashboard chrome, device context, and page children', async () => {
    const io = require('socket.io-client').default;

    render(
      <DashboardLayout>
        <RealtimeChild />
      </DashboardLayout>,
    );

    await waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });

    const connectHandler = mockSocket.on.mock.calls.find(([event]) => event === 'connect')?.[1];
    act(() => {
      connectHandler?.();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('join:organization', { organizationId: 'org-1' });
    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('notification:new', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('device:status', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('child:event', expect.any(Function));
    });
  });
});
