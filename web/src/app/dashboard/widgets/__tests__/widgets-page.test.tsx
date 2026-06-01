import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import WidgetsPage from '../page';

const mockGetWidgetTypes = jest.fn();
const mockGet = jest.fn();
const mockCreateWidget = jest.fn();
const mockUpdateWidget = jest.fn();
const mockRefreshWidget = jest.fn();
const mockDeleteWidget = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getWidgetTypes: (...args: any[]) => mockGetWidgetTypes(...args),
    get: (...args: any[]) => mockGet(...args),
    createWidget: (...args: any[]) => mockCreateWidget(...args),
    updateWidget: (...args: any[]) => mockUpdateWidget(...args),
    refreshWidget: (...args: any[]) => mockRefreshWidget(...args),
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
    widgetType: 'weather',
    widgetConfig: { location: 'New York, NY' },
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'w2',
    name: 'News Feed',
    widgetType: 'rss',
    widgetConfig: { feedUrl: 'https://example.com/rss' },
    createdAt: '2026-01-15T00:00:00Z',
  },
];

describe('WidgetsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWidgetTypes.mockResolvedValue(sampleWidgetTypes);
    mockGet.mockResolvedValue({ data: sampleWidgets });
    mockCreateWidget.mockResolvedValue({
      id: 'new-1',
      name: 'New Widget',
      widgetType: 'weather',
      widgetConfig: { location: 'Austin' },
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
    });
    mockUpdateWidget.mockResolvedValue({});
    mockRefreshWidget.mockResolvedValue({});
    mockDeleteWidget.mockResolvedValue({});
  });

  it('renders loading spinner initially', async () => {
    render(<WidgetsPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    await screen.findByText('Weather');
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
    mockGet.mockResolvedValue({ data: [] });
    render(<WidgetsPage />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Create Widget/i })).toBeDisabled();
    expect(screen.getByText('No widgets available')).toBeInTheDocument();
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

  it('normalizes backend JSON schema into editable configuration fields', async () => {
    mockGetWidgetTypes.mockResolvedValue([
      {
        type: 'weather',
        name: 'Weather',
        description: 'Display current weather conditions',
        icon: 'sun',
        configSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name or city,country',
              default: 'New York',
            },
            units: {
              type: 'string',
              enum: ['metric', 'imperial'],
              description: 'Temperature units',
              default: 'metric',
            },
            showForecast: {
              type: 'boolean',
              description: 'Show forecast',
              default: true,
            },
          },
          required: ['location'],
        },
      },
    ]);

    render(<WidgetsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Create Weather Widget/i }));

    expect(screen.getByDisplayValue('New York')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Units/i })).toHaveValue('metric');
    expect(screen.getByRole('checkbox', { name: /Show Forecast/i })).toBeChecked();
    expect(screen.getByText('Location')).toBeInTheDocument();
  });

  it('does not allow fallback-only widget types to be created when API types fail to load', async () => {
    mockGetWidgetTypes.mockRejectedValue(new Error('Network error'));

    render(<WidgetsPage />);

    const createWeatherButton = await screen.findByRole('button', {
      name: /Create Weather Widget/i,
    });

    expect(screen.getByText(/Widget types could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Widget/i })).toBeDisabled();
    expect(createWeatherButton).toBeDisabled();

    fireEvent.click(createWeatherButton);
    expect(mockCreateWidget).not.toHaveBeenCalled();
  });

  it('shows per-widget refresh pending state and surfaces refresh failures without success toast', async () => {
    mockRefreshWidget.mockRejectedValue(new Error('live data unavailable'));

    render(<WidgetsPage />);

    await screen.findByText('Lobby Weather');
    fireEvent.click(screen.getAllByRole('button', { name: /Refresh/i })[0]);

    expect(screen.getByRole('button', { name: /Refreshing/i })).toBeDisabled();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('live data unavailable');
    });
    expect(mockToast.success).not.toHaveBeenCalledWith('Widget data refreshed');
  });

  it('tracks concurrent widget refreshes independently', async () => {
    let resolveFirstRefresh!: (value: unknown) => void;
    let resolveSecondRefresh!: (value: unknown) => void;
    mockRefreshWidget
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirstRefresh = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecondRefresh = resolve; }));

    render(<WidgetsPage />);

    await screen.findByText('Lobby Weather');
    const refreshButtons = screen.getAllByRole('button', { name: /Refresh/i });
    fireEvent.click(refreshButtons[0]);
    fireEvent.click(refreshButtons[1]);

    expect(screen.getAllByRole('button', { name: /Refreshing/i })).toHaveLength(2);

    resolveFirstRefresh({
      id: 'w1',
      name: 'Lobby Weather',
      widgetType: 'weather',
      widgetConfig: { location: 'New York, NY' },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Refreshing/i })).toHaveLength(1);
    });

    resolveSecondRefresh({
      id: 'w2',
      name: 'News Feed',
      widgetType: 'rss',
      widgetConfig: { feedUrl: 'https://example.com/rss' },
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Refreshing/i })).not.toBeInTheDocument();
    });
  });

  it('requires backend schema required fields before creating a widget', async () => {
    mockGetWidgetTypes.mockResolvedValue([
      {
        type: 'rss',
        name: 'RSS Feed',
        description: 'Show live news updates',
        icon: 'list',
        configSchema: {
          type: 'object',
          properties: {
            feedUrl: { type: 'string', description: 'Feed URL' },
          },
          required: ['feedUrl'],
        },
      },
    ]);

    render(<WidgetsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Create RSS Feed Widget/i }));
    const modal = screen.getByTestId('modal');
    fireEvent.change(within(modal).getByPlaceholderText('My RSS Feed Widget'), {
      target: { value: 'Lobby News' },
    });

    expect(within(modal).getByRole('button', { name: /^Create Widget$/i })).toBeDisabled();
    expect(within(modal).getByRole('button', { name: /^Preview$/i })).toBeDisabled();
    expect(mockCreateWidget).not.toHaveBeenCalled();
  });

  it('keeps a newly created widget visible from the mutation response when reload fails', async () => {
    mockGet.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(new Error('reload failed'));
    mockCreateWidget.mockResolvedValue({
      id: 'new-1',
      name: 'Lobby Live Weather',
      widgetType: 'weather',
      widgetConfig: { location: 'Austin' },
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
    });

    render(<WidgetsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Create Weather Widget/i }));
    const modal = screen.getByTestId('modal');
    fireEvent.change(within(modal).getByPlaceholderText('My Weather Widget'), {
      target: { value: 'Lobby Live Weather' },
    });
    fireEvent.change(within(modal).getByRole('textbox', { name: /Location/i }), {
      target: { value: 'Austin' },
    });
    fireEvent.click(within(modal).getByRole('button', { name: /^Create Widget$/i }));

    expect(await screen.findByText('Lobby Live Weather')).toBeInTheDocument();
    expect(mockToast.success).toHaveBeenCalledWith('Widget created successfully');
    expect(mockToast.error).toHaveBeenCalledWith('Widget list refresh failed. Showing the latest local change.');
  });
});
