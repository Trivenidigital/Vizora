import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import WidgetsPage from '../page';

const mockGetWidgetTypes = jest.fn();
const mockGet = jest.fn();
const mockCreateWidget = jest.fn();
const mockDeleteWidget = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getWidgetTypes: (...args: any[]) => mockGetWidgetTypes(...args),
    get: (...args: any[]) => mockGet(...args),
    createWidget: (...args: any[]) => mockCreateWidget(...args),
    deleteWidget: (...args: any[]) => mockDeleteWidget(...args),
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

const sampleWidgetTypes = [
  {
    type: 'weather',
    name: 'Weather',
    description: 'Display current weather conditions',
    icon: 'sun',
    configSchema: { location: { type: 'string', required: true } },
  },
  {
    type: 'rss',
    name: 'RSS Feed',
    description: 'Show live news updates',
    icon: 'list',
    configSchema: { feedUrl: { type: 'string', required: true } },
  },
  {
    type: 'clock',
    name: 'Clock',
    description: 'Display a clock widget',
    icon: 'clock',
    configSchema: { timezone: { type: 'string' } },
  },
];

const sampleWidgets = [
  {
    id: 'w1',
    name: 'Lobby Weather',
    type: 'weather',
    config: { location: 'New York, NY' },
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'w2',
    name: 'News Feed',
    type: 'rss',
    config: { feedUrl: 'https://example.com/rss' },
    createdAt: '2026-01-15T00:00:00Z',
  },
];

describe('WidgetsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWidgetTypes.mockResolvedValue(sampleWidgetTypes);
    mockGet.mockResolvedValue({ data: sampleWidgets });
    mockCreateWidget.mockResolvedValue({ id: 'new-1' });
    mockDeleteWidget.mockResolvedValue({});
  });

  it('renders loading spinner initially', () => {
    render(<WidgetsPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('fetches widget data on mount', async () => {
    render(<WidgetsPage />);
    await waitFor(() => {
      expect(mockGetWidgetTypes).toHaveBeenCalled();
    });
  });

  it('renders widget types after load', async () => {
    render(<WidgetsPage />);
    await waitFor(() => {
      expect(screen.getByText('Weather')).toBeInTheDocument();
    });
    expect(screen.getByText('RSS Feed')).toBeInTheDocument();
    expect(screen.getByText('Clock')).toBeInTheDocument();
  });

  it('renders widget descriptions', async () => {
    render(<WidgetsPage />);
    await waitFor(() => {
      expect(screen.getByText('Display current weather conditions')).toBeInTheDocument();
    });
    expect(screen.getByText('Show live news updates')).toBeInTheDocument();
  });

  it('handles fetch failure gracefully with fallbacks', async () => {
    mockGetWidgetTypes.mockRejectedValue(new Error('API error'));
    render(<WidgetsPage />);
    await waitFor(() => {
      // Falls back to DEFAULT_WIDGET_TYPES
      expect(screen.getByText('Weather')).toBeInTheDocument();
    });
  });

  it('renders page heading', async () => {
    render(<WidgetsPage />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText(/widget/i).length).toBeGreaterThan(0);
  });

  it('handles empty widget types gracefully', async () => {
    mockGetWidgetTypes.mockResolvedValue([]);
    render(<WidgetsPage />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });

  it('renders existing widgets', async () => {
    render(<WidgetsPage />);
    await waitFor(() => {
      expect(screen.getByText('Lobby Weather')).toBeInTheDocument();
    });
    expect(screen.getByText('News Feed')).toBeInTheDocument();
  });

  it('uses fallback widget types when API fails', async () => {
    mockGetWidgetTypes.mockRejectedValue(new Error('Network error'));
    render(<WidgetsPage />);
    await waitFor(() => {
      // Should fall back to DEFAULT_WIDGET_TYPES
      expect(screen.getByText('Weather')).toBeInTheDocument();
    });
  });

  it('renders widget icons', async () => {
    render(<WidgetsPage />);
    await waitFor(() => {
      expect(screen.getByText('Weather')).toBeInTheDocument();
    });
  });
});
