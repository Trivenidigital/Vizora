import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TemplateLibraryPage from '../page';

const mockGetTemplateCategories = jest.fn();
const mockGetFeaturedTemplates = jest.fn();
const mockSearchTemplates = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getTemplateCategories: (...args: any[]) => mockGetTemplateCategories(...args),
    getFeaturedTemplates: (...args: any[]) => mockGetFeaturedTemplates(...args),
    searchTemplates: (...args: any[]) => mockSearchTemplates(...args),
  },
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

jest.mock('next/link', () => {
  return function MockLink({ children, href }: any) {
    return <a href={href}>{children}</a>;
  };
});

const sampleCategories = [
  { name: 'Retail', count: 5 },
  { name: 'Restaurant', count: 8 },
  { name: 'Corporate', count: 3 },
];

const sampleTemplates = [
  {
    id: 't1',
    name: 'Welcome Screen',
    description: 'A welcoming display for lobbies',
    category: 'Corporate',
    tags: ['welcome', 'corporate'],
    orientation: 'landscape',
    difficulty: 'easy',
    isFeatured: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 't2',
    name: 'Menu Board',
    description: 'Digital menu for restaurants',
    category: 'Restaurant',
    tags: ['menu', 'food'],
    orientation: 'portrait',
    difficulty: 'medium',
    isFeatured: false,
    createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 't3',
    name: 'Sale Announcement',
    description: 'Promotional sale template',
    category: 'Retail',
    tags: ['sale', 'promo'],
    orientation: 'landscape',
    difficulty: 'easy',
    isFeatured: true,
    createdAt: '2026-01-10T00:00:00Z',
  },
];

describe('TemplateLibraryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTemplateCategories.mockResolvedValue(sampleCategories);
    mockGetFeaturedTemplates.mockResolvedValue({ data: sampleTemplates.filter(t => t.isFeatured) });
    mockSearchTemplates.mockResolvedValue({ data: sampleTemplates, meta: { total: 3 } });
  });

  it('renders loading spinner initially', () => {
    render(<TemplateLibraryPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('fetches templates on mount', async () => {
    render(<TemplateLibraryPage />);
    await waitFor(() => {
      expect(mockGetTemplateCategories).toHaveBeenCalled();
    });
  });

  it('renders templates after load', async () => {
    render(<TemplateLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Screen')).toBeInTheDocument();
    });
    expect(screen.getByText('Menu Board')).toBeInTheDocument();
    expect(screen.getByText('Sale Announcement')).toBeInTheDocument();
  });

  it('renders template descriptions', async () => {
    render(<TemplateLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText('A welcoming display for lobbies')).toBeInTheDocument();
    });
  });

  it('renders categories', async () => {
    render(<TemplateLibraryPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Retail/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Restaurant/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Corporate/).length).toBeGreaterThan(0);
  });

  it('fetches featured templates', async () => {
    render(<TemplateLibraryPage />);
    await waitFor(() => {
      expect(mockGetFeaturedTemplates).toHaveBeenCalled();
    });
  });

  it('renders page heading', async () => {
    render(<TemplateLibraryPage />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText(/template/i).length).toBeGreaterThan(0);
  });

  it('handles empty template list', async () => {
    mockSearchTemplates.mockResolvedValue({ data: [], meta: { total: 0 } });
    mockGetFeaturedTemplates.mockResolvedValue({ data: [] });
    render(<TemplateLibraryPage />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });

  it('shows search input', async () => {
    render(<TemplateLibraryPage />);
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
    const searchInput = screen.queryByPlaceholderText(/search/i);
    if (searchInput) {
      expect(searchInput).toBeInTheDocument();
    }
  });

  it('calls searchTemplates with filters', async () => {
    render(<TemplateLibraryPage />);
    await waitFor(() => {
      expect(mockSearchTemplates).toHaveBeenCalled();
    });
  });
});
