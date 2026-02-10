import { render, screen, waitFor } from '@testing-library/react';
import TemplateLibraryPage from '../page';

jest.mock('@/lib/api', () => ({
  apiClient: {
    getTemplateCategories: jest.fn().mockResolvedValue([]),
    getFeaturedTemplates: jest.fn().mockResolvedValue({ data: [] }),
    searchTemplates: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  },
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

jest.mock('next/link', () => {
  return function MockLink({ children, href }: any) {
    return <a href={href}>{children}</a>;
  };
});

describe('TemplateLibraryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner initially', () => {
    render(<TemplateLibraryPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('fetches templates on mount', async () => {
    render(<TemplateLibraryPage />);
    const { apiClient } = require('@/lib/api');
    await waitFor(() => {
      expect(apiClient.getTemplateCategories).toHaveBeenCalled();
    });
  });
});
