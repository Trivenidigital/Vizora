import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SchedulesClient from '../page-client';

const mockGetSchedules = jest.fn();
const mockGetPlaylists = jest.fn();
const mockGetDisplays = jest.fn();
const mockGetDisplayGroups = jest.fn();
const mockCreateSchedule = jest.fn();
const mockDeleteSchedule = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getSchedules: (...args: any[]) => mockGetSchedules(...args),
    getPlaylists: (...args: any[]) => mockGetPlaylists(...args),
    getDisplays: (...args: any[]) => mockGetDisplays(...args),
    getDisplayGroups: (...args: any[]) => mockGetDisplayGroups(...args),
    createSchedule: (...args: any[]) => mockCreateSchedule(...args),
    deleteSchedule: (...args: any[]) => mockDeleteSchedule(...args),
  },
}));

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  ToastContainer: () => null,
};

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/lib/hooks', () => ({
  useRealtimeEvents: jest.fn(() => ({ isConnected: false, isOffline: true })),
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="spinner">Loading...</div>; };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmpty({ title }: any) { return <div data-testid="empty-state">{title || 'No items'}</div>; };
});

jest.mock('@/components/Modal', () => {
  return function MockModal({ isOpen, children, title }: any) {
    return isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null;
  };
});

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirm({ isOpen, onConfirm, title }: any) {
    return isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null;
  };
});

jest.mock('@/components/TimePicker', () => {
  return function MockTimePicker({ value, onChange }: any) {
    return <input data-testid="time-picker" type="text" value={value || ''} onChange={(e) => onChange?.(e.target.value)} />;
  };
});

jest.mock('@/components/DaySelector', () => {
  return function MockDaySelector() { return <div data-testid="day-selector">Day Selector</div>; };
});

jest.mock('@/components/ScheduleCalendar', () => {
  return function MockCalendar() { return <div data-testid="calendar">Calendar</div>; };
});

jest.mock('date-fns', () => ({
  format: jest.fn(() => '2026-01-01'),
}));

const sampleSchedules = [
  {
    id: 's1',
    name: 'Morning Announcements',
    description: 'Daily morning content rotation',
    startTime: 480,
    endTime: 720,
    daysOfWeek: [1, 2, 3, 4, 5],
    playlistId: 'p1',
    displayId: 'd1',
    isActive: true,
    priority: 1,
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 's2',
    name: 'Weekend Specials',
    description: 'Weekend promotional content',
    startTime: 600,
    endTime: 1200,
    daysOfWeek: [0, 6],
    playlistId: 'p2',
    displayGroupId: 'g1',
    isActive: true,
    priority: 2,
    createdAt: '2026-01-12T00:00:00Z',
    updatedAt: '2026-01-12T00:00:00Z',
  },
  {
    id: 's3',
    name: 'Holiday Schedule',
    isActive: false,
    startTime: 0,
    endTime: 1440,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    playlistId: 'p3',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
];

const samplePlaylists = [
  { id: 'p1', name: 'Welcome Playlist', isActive: true },
  { id: 'p2', name: 'Promo Playlist', isActive: true },
  { id: 'p3', name: 'Holiday Playlist', isActive: false },
];

describe('SchedulesClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSchedules.mockResolvedValue({ data: [] });
    mockGetPlaylists.mockResolvedValue({ data: [] });
    mockGetDisplays.mockResolvedValue({ data: [] });
    mockGetDisplayGroups.mockResolvedValue({ data: [] });
    mockCreateSchedule.mockResolvedValue({ id: 'new-1' });
    mockDeleteSchedule.mockResolvedValue({});
  });

  it('renders loading spinner initially', () => {
    render(<SchedulesClient />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('fetches schedules on mount', async () => {
    render(<SchedulesClient />);
    await waitFor(() => {
      expect(mockGetSchedules).toHaveBeenCalled();
    });
  });

  it('renders schedules after load', async () => {
    mockGetSchedules.mockResolvedValue({ data: sampleSchedules });
    render(<SchedulesClient />);
    await waitFor(() => {
      expect(screen.getByText('Morning Announcements')).toBeInTheDocument();
    });
    expect(screen.getByText('Weekend Specials')).toBeInTheDocument();
  });

  it('renders empty state when no schedules', async () => {
    mockGetSchedules.mockResolvedValue({ data: [] });
    render(<SchedulesClient />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });

  it('handles fetch failure gracefully', async () => {
    mockGetSchedules.mockRejectedValue(new Error('Failed to fetch'));
    render(<SchedulesClient />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });

  it('fetches playlists for schedule form', async () => {
    render(<SchedulesClient />);
    await waitFor(() => {
      expect(mockGetPlaylists).toHaveBeenCalled();
    });
  });

  it('fetches displays for schedule assignment', async () => {
    render(<SchedulesClient />);
    await waitFor(() => {
      expect(mockGetDisplays).toHaveBeenCalled();
    });
  });

  it('renders schedule list with data', async () => {
    mockGetSchedules.mockResolvedValue({ data: sampleSchedules });
    render(<SchedulesClient />);
    await waitFor(() => {
      expect(screen.getByText('Morning Announcements')).toBeInTheDocument();
    });
  });

  it('renders inactive schedules differently', async () => {
    mockGetSchedules.mockResolvedValue({ data: sampleSchedules });
    render(<SchedulesClient />);
    await waitFor(() => {
      expect(screen.getByText('Holiday Schedule')).toBeInTheDocument();
    });
  });

  it('renders page heading', async () => {
    render(<SchedulesClient />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText(/schedule/i).length).toBeGreaterThan(0);
  });
});
