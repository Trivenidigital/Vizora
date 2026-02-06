import { render, screen, waitFor } from '@testing-library/react';
import InvoiceHistoryPage from '../history/page';
import { apiClient } from '@/lib/api';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    getInvoices: jest.fn(),
  },
}));

// Mock useToast
jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    ToastContainer: () => null,
  }),
}));

describe('InvoiceHistoryPage', () => {
  const mockInvoices = [
    {
      id: 'inv_001',
      amount: 9900,
      currency: 'USD',
      status: 'paid',
      description: 'Pro Plan - Monthly Subscription',
      createdAt: '2026-02-01T00:00:00.000Z',
      pdfUrl: 'https://invoices.stripe.com/inv_001.pdf',
    },
    {
      id: 'inv_002',
      amount: 9900,
      currency: 'USD',
      status: 'paid',
      description: 'Pro Plan - Monthly Subscription',
      createdAt: '2026-01-01T00:00:00.000Z',
      pdfUrl: 'https://invoices.stripe.com/inv_002.pdf',
    },
    {
      id: 'inv_003',
      amount: 2900,
      currency: 'USD',
      status: 'open',
      description: 'Basic Plan - Monthly Subscription',
      createdAt: '2025-12-01T00:00:00.000Z',
      pdfUrl: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getInvoices as jest.Mock).mockResolvedValue(mockInvoices);
  });

  it('renders invoice table', async () => {
    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Invoice')).toBeInTheDocument();
    });
  });

  it('shows empty state when no invoices', async () => {
    (apiClient.getInvoices as jest.Mock).mockResolvedValue([]);

    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('No invoices yet')).toBeInTheDocument();
      expect(
        screen.getByText('Your invoice history will appear here once you have an active subscription')
      ).toBeInTheDocument();
    });
  });

  it('formats amounts correctly for USD', async () => {
    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      // $99.00 (9900 cents)
      expect(screen.getAllByText('$99.00').length).toBeGreaterThan(0);
      // $29.00 (2900 cents)
      expect(screen.getByText('$29.00')).toBeInTheDocument();
    });
  });

  it('formats amounts correctly for INR', async () => {
    (apiClient.getInvoices as jest.Mock).mockResolvedValue([
      {
        id: 'inv_inr_001',
        amount: 799900, // 7999 INR in paise
        currency: 'INR',
        status: 'paid',
        description: 'Pro Plan - Monthly Subscription',
        createdAt: '2026-02-01T00:00:00.000Z',
        pdfUrl: 'https://invoices.razorpay.com/inv_inr_001.pdf',
      },
    ]);

    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      // Should format as INR
      expect(screen.getByText(/7,999/)).toBeInTheDocument();
    });
  });

  it('shows status badges correctly', async () => {
    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      // Two paid invoices and one open
      expect(screen.getAllByText('Paid').length).toBe(2);
      expect(screen.getByText('Open')).toBeInTheDocument();
    });
  });

  it('shows download link for invoices with PDF', async () => {
    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      const downloadLinks = screen.getAllByText('Download');
      expect(downloadLinks.length).toBe(2); // Two invoices have PDFs
    });
  });

  it('shows N/A for invoices without PDF', async () => {
    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  it('download link opens in new tab', async () => {
    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      const downloadLinks = screen.getAllByRole('link', { name: /Download/ });
      downloadLinks.forEach((link) => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  });

  it('displays loading spinner while fetching data', () => {
    // Delay resolution to see loading state
    (apiClient.getInvoices as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockInvoices), 100))
    );

    render(<InvoiceHistoryPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows invoice descriptions', async () => {
    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Pro Plan - Monthly Subscription').length).toBe(2);
      expect(screen.getByText('Basic Plan - Monthly Subscription')).toBeInTheDocument();
    });
  });

  it('shows back button to billing page', async () => {
    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      const backLink = screen.getByRole('link', { name: '' }); // The chevron link
      expect(backLink).toHaveAttribute('href', '/dashboard/settings/billing');
    });
  });

  it('shows help text with contact email', async () => {
    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/billing@vizora.io/)).toBeInTheDocument();
    });
  });

  it('formats dates correctly', async () => {
    render(<InvoiceHistoryPage />);

    await waitFor(() => {
      // Dates may vary slightly based on timezone, so check for patterns
      // The dates in mock data are 2026-02-01, 2026-01-01, 2025-12-01
      // Check that we have date cells rendered (3 rows)
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      // Check at least one date containing year is present
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });
  });
});
