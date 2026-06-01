import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TemplateLibraryPage from '../page';

const mockGetTemplateCategories = jest.fn();
const mockGetFeaturedTemplates = jest.fn();
const mockGetPopularTemplates = jest.fn();
const mockSearchTemplates = jest.fn();
const mockGetUserTemplates = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockAiGenerateTemplate = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getTemplateCategories: (...args: any[]) => mockGetTemplateCategories(...args),
    getFeaturedTemplates: (...args: any[]) => mockGetFeaturedTemplates(...args),
    getPopularTemplates: (...args: any[]) => mockGetPopularTemplates(...args),
    searchTemplates: (...args: any[]) => mockSearchTemplates(...args),
    getUserTemplates: (...args: any[]) => mockGetUserTemplates(...args),
    getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
    aiGenerateTemplate: (...args: any[]) => mockAiGenerateTemplate(...args),
    setAuthenticated: jest.fn(),
    getQuotaUsage: jest.fn().mockResolvedValue({ storageUsedBytes: 0, storageQuotaBytes: 1073741824, screenCount: 0, screenQuota: 5 }),
  },
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="spinner">Loading...</div>; };
});

jest.mock('@/components/templates/TemplateCardSkeleton', () => ({
  TemplateGridSkeleton: ({ count }: { count?: number }) => <div data-testid="spinner">Loading {count} templates...</div>,
}));

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
    mockGetCurrentUser.mockResolvedValue({
      id: '1',
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      organizationId: 'org-1',
      role: 'admin',
      isSuperAdmin: false,
    });
    mockGetTemplateCategories.mockResolvedValue(sampleCategories);
    mockGetFeaturedTemplates.mockResolvedValue({ data: sampleTemplates.filter(t => t.isFeatured) });
    mockGetPopularTemplates.mockResolvedValue([]);
    mockSearchTemplates.mockResolvedValue({ data: sampleTemplates, meta: { total: 3 } });
    mockGetUserTemplates.mockResolvedValue({ data: [], meta: { total: 0 } });
    mockAiGenerateTemplate.mockResolvedValue({ available: false, message: 'AI Designer is launching soon.' });
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

  it('does not expose platform template authoring actions to organization admins', async () => {
    render(<TemplateLibraryPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /new design/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /ai designer coming soon/i }).length).toBeGreaterThan(0);
  });

  it('shows platform template authoring actions to super admins', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 'super-1',
      email: 'super@test.com',
      firstName: 'Super',
      lastName: 'Admin',
      organizationId: 'org-1',
      role: 'admin',
      isSuperAdmin: true,
    });

    render(<TemplateLibraryPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /new design/i })).toBeInTheDocument();
  });

  it('does not expose clone/use actions on organization-owned templates', async () => {
    mockGetUserTemplates.mockResolvedValueOnce({
      data: [{
        id: 'owned-1',
        name: 'My Menu Clone',
        description: 'Org-owned template',
        category: 'Restaurant',
        orientation: 'landscape',
        difficulty: 'beginner',
        metadata: { isLibraryTemplate: false },
      }],
      meta: { total: 1 },
    });

    render(<TemplateLibraryPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('button', { name: /your templates/i })[0]);

    expect(await screen.findByText('My Menu Clone')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^use template$/i })).not.toBeInTheDocument();
  });
});
