import { render, screen, waitFor } from '@testing-library/react';
import SchedulesClient from '../page-client';

jest.mock('@/lib/api', () => ({
  apiClient: {
    getSchedules: jest.fn().mockResolvedValue({ data: [] }),
    getPlaylists: jest.fn().mockResolvedValue({ data: [] }),
    getDisplays: jest.fn().mockResolvedValue({ data: [] }),
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

jest.mock('@/lib/hooks', () => ({
  useRealtimeEvents: jest.fn(),
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

jest.mock('@/components/TimePicker', () => {
  return function MockTimePicker() { return <input type="text" />; };
});

jest.mock('@/components/DaySelector', () => {
  return function MockDaySelector() { return <div>Day Selector</div>; };
});

jest.mock('@/components/ScheduleCalendar', () => {
  return function MockCalendar() { return <div data-testid="calendar">Calendar</div>; };
});

jest.mock('date-fns', () => ({
  format: jest.fn(() => '2024-01-01'),
}));

describe('SchedulesClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner initially', () => {
    render(<SchedulesClient />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('fetches schedules on mount', async () => {
    render(<SchedulesClient />);
    const { apiClient } = require('@/lib/api');
    await waitFor(() => {
      expect(apiClient.getSchedules).toHaveBeenCalled();
    });
  });
});
