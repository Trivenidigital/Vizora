import { render, screen } from '@testing-library/react';
import ScheduleCalendar from '../ScheduleCalendar';

// Mock react-big-calendar to avoid complex setup
jest.mock('react-big-calendar', () => ({
  Calendar: ({ events, onSelectEvent, onSelectSlot, views }: any) => (
    <div data-testid="calendar">
      <span data-testid="event-count">{events?.length || 0} events</span>
      {events?.map((e: any, i: number) => (
        <div key={i} data-testid={`event-${i}`} onClick={() => onSelectEvent?.(e)}>
          {e.title}
        </div>
      ))}
    </div>
  ),
  dateFnsLocalizer: () => ({}),
}));

jest.mock('react-big-calendar/lib/css/react-big-calendar.css', () => ({}));

jest.mock('date-fns', () => ({
  format: jest.fn(),
  parse: jest.fn(),
  startOfWeek: jest.fn(),
  getDay: jest.fn((d: Date) => d.getDay()),
  addMonths: jest.fn((d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate())),
  subMonths: jest.fn((d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() - n, d.getDate())),
  startOfMonth: jest.fn((d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)),
  endOfMonth: jest.fn((d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  eachDayOfInterval: jest.fn(() => []),
  setHours: jest.fn((d: Date, h: number) => new Date(d.setHours(h))),
  setMinutes: jest.fn((d: Date, m: number) => new Date(d.setMinutes(m))),
}));

jest.mock('date-fns/locale/en-US', () => ({
  enUS: {},
}));

describe('ScheduleCalendar', () => {
  const defaultProps = {
    schedules: [],
    onSelectEvent: jest.fn(),
    onSelectSlot: jest.fn(),
  };

  it('renders the calendar component', () => {
    render(<ScheduleCalendar {...defaultProps} />);
    expect(screen.getByTestId('calendar')).toBeInTheDocument();
  });

  it('shows 0 events when no schedules provided', () => {
    render(<ScheduleCalendar {...defaultProps} />);
    expect(screen.getByTestId('event-count')).toHaveTextContent('0 events');
  });

  it('applies custom styles container', () => {
    const { container } = render(<ScheduleCalendar {...defaultProps} />);
    expect(container.querySelector('.schedule-calendar')).toBeInTheDocument();
  });
});
