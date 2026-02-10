import { render, screen, waitFor } from '@testing-library/react';
import DevicesClient from '../page-client';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/dashboard/devices',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getDisplays: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    getPlaylists: jest.fn().mockResolvedValue({ data: [] }),
    getDisplayGroups: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    ToastContainer: () => null,
  }),
}));

jest.mock('@/lib/hooks/useDebounce', () => ({
  useDebounce: (val: any) => val,
}));

jest.mock('@/lib/hooks', () => ({
  useRealtimeEvents: jest.fn(),
  useOptimisticState: jest.fn((initialState: any) => [initialState, jest.fn(), jest.fn()]),
  useErrorRecovery: jest.fn(() => ({ retry: jest.fn(), isRecovering: false })),
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="spinner">Loading...</div>; };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmpty({ title }: any) { return <div>{title || 'No items'}</div>; };
});

jest.mock('@/components/Modal', () => {
  return function MockModal({ isOpen, children }: any) { return isOpen ? <div>{children}</div> : null; };
});

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirm() { return null; };
});

jest.mock('@/components/SearchFilter', () => {
  return function MockSearch() { return <input placeholder="Search..." />; };
});

jest.mock('@/components/DeviceStatusIndicator', () => {
  return function MockIndicator() { return <span>Online</span>; };
});

jest.mock('@/components/DeviceGroupSelector', () => {
  return function MockGroupSelector() { return null; };
});

jest.mock('@/components/DevicePreviewModal', () => {
  return function MockDevicePreview() { return null; };
});

jest.mock('@/components/PlaylistQuickSelect', () => {
  return function MockPlaylistSelect() { return null; };
});

describe('DevicesClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner initially', () => {
    render(<DevicesClient initialDevices={[]} initialPlaylists={[]} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('loads device data', async () => {
    render(<DevicesClient initialDevices={[]} initialPlaylists={[]} />);
    const { apiClient } = require('@/lib/api');
    await waitFor(() => {
      expect(apiClient.getDisplays).toHaveBeenCalled();
    });
  });
});
