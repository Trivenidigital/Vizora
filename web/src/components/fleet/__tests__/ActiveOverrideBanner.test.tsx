import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ActiveOverrideBanner from '../ActiveOverrideBanner';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

const mockGetActiveOverrides = jest.fn();
const mockClearOverride = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getActiveOverrides: (...args: any[]) => mockGetActiveOverrides(...args),
    clearOverride: (...args: any[]) => mockClearOverride(...args),
  },
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    ToastContainer: () => null,
  }),
}));

describe('ActiveOverrideBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when no overrides', async () => {
    mockGetActiveOverrides.mockResolvedValue([]);
    const { container } = render(<ActiveOverrideBanner />);

    await waitFor(() => {
      expect(mockGetActiveOverrides).toHaveBeenCalled();
    });

    expect(container.innerHTML).toBe('');
  });

  it('renders banner when override exists', async () => {
    mockGetActiveOverrides.mockResolvedValue([
      {
        commandId: 'cmd-1',
        contentId: 'content-1',
        contentTitle: 'Emergency Announcement',
        targetType: 'organization',
        targetId: 'org-1',
        targetName: 'All Devices',
        duration: 60,
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        startedBy: 'admin@test.com',
      },
    ]);

    render(<ActiveOverrideBanner />);

    await waitFor(() => {
      expect(screen.getByText(/Emergency Announcement/)).toBeInTheDocument();
    });

    expect(screen.getByText('Clear Override')).toBeInTheDocument();
    expect(screen.getByTestId('active-override-banner')).toBeInTheDocument();
  });

  it('clear button calls clearOverride', async () => {
    mockGetActiveOverrides.mockResolvedValue([
      {
        commandId: 'cmd-1',
        contentId: 'content-1',
        contentTitle: 'Emergency Announcement',
        targetType: 'organization',
        targetId: 'org-1',
        targetName: 'All Devices',
        duration: 60,
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        startedBy: 'admin@test.com',
      },
    ]);

    mockClearOverride.mockResolvedValue({ commandId: 'cmd-1', devicesNotified: 5 });

    render(<ActiveOverrideBanner />);

    await waitFor(() => {
      expect(screen.getByText('Clear Override')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Clear Override'));

    await waitFor(() => {
      expect(mockClearOverride).toHaveBeenCalledWith('cmd-1');
    });
  });
});
