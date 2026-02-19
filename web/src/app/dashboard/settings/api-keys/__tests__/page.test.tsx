import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockGetApiKeys = jest.fn();
const mockCreateApiKey = jest.fn();
const mockRevokeApiKey = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getApiKeys: (...args: any[]) => mockGetApiKeys(...args),
    createApiKey: (...args: any[]) => mockCreateApiKey(...args),
    revokeApiKey: (...args: any[]) => mockRevokeApiKey(...args),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
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
  return function MockSpinner() { return <div data-testid="loading-spinner">Loading...</div>; };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmptyState({ title, description, action }: any) {
    return (
      <div data-testid="empty-state">
        <span>{title}</span>
        <span>{description}</span>
        {action && <button onClick={action.onClick}>{action.label}</button>}
      </div>
    );
  };
});

jest.mock('@/components/Modal', () => {
  return function MockModal({ isOpen, children, title }: any) {
    return isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null;
  };
});

jest.mock('@/components/ConfirmDialog', () => {
  return function MockConfirm({ isOpen, onConfirm, title, message }: any) {
    return isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <span>{message}</span>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null;
  };
});

import ApiKeysPage from '../page';

const sampleApiKeys = [
  {
    id: 'key-1',
    name: 'Production API Key',
    prefix: 'vz_live',
    scopes: ['read:all', 'write:content'],
    lastUsedAt: '2026-02-10T08:00:00Z',
    expiresAt: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'key-2',
    name: 'Test Key',
    prefix: 'vz_test',
    scopes: ['read:content', 'read:playlists', 'read:displays', 'write:schedules'],
    lastUsedAt: null,
    expiresAt: '2027-06-01T00:00:00Z',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'key-3',
    name: 'Expired Key',
    prefix: 'vz_exp_',
    scopes: ['read:content'],
    lastUsedAt: '2025-12-01T00:00:00Z',
    expiresAt: '2025-12-31T23:59:59Z',
    createdAt: '2025-06-01T00:00:00Z',
  },
];

describe('ApiKeysPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApiKeys.mockResolvedValue(sampleApiKeys);
    mockCreateApiKey.mockResolvedValue({
      key: 'vz_live_abc123xyz',
      apiKey: { id: 'key-new', name: 'New Key', prefix: 'vz_live', scopes: ['read:all'], createdAt: '2026-02-17T00:00:00Z', lastUsedAt: null, expiresAt: null },
    });
    mockRevokeApiKey.mockResolvedValue({});
  });

  it('renders loading spinner initially', () => {
    render(<ApiKeysPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('fetches API keys on mount', async () => {
    render(<ApiKeysPage />);
    await waitFor(() => {
      expect(mockGetApiKeys).toHaveBeenCalled();
    });
  });

  it('renders page heading and description', async () => {
    render(<ApiKeysPage />);
    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });
    expect(screen.getByText(/Manage API keys for programmatic access/)).toBeInTheDocument();
  });

  it('renders API keys after load', async () => {
    render(<ApiKeysPage />);
    await waitFor(() => {
      expect(screen.getByText('Production API Key')).toBeInTheDocument();
    });
    expect(screen.getByText('Test Key')).toBeInTheDocument();
    expect(screen.getByText('Expired Key')).toBeInTheDocument();
  });

  it('shows key prefixes', async () => {
    render(<ApiKeysPage />);
    await waitFor(() => {
      expect(screen.getByText('vz_live...')).toBeInTheDocument();
    });
    expect(screen.getByText('vz_test...')).toBeInTheDocument();
  });

  it('shows scopes with overflow indicator', async () => {
    render(<ApiKeysPage />);
    await waitFor(() => {
      expect(screen.getByText('read:all')).toBeInTheDocument();
    });
    // key-2 has 4 scopes, only 3 shown, so "+1 more" should appear
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('shows Revoke button for each key', async () => {
    render(<ApiKeysPage />);
    await waitFor(() => {
      expect(screen.getByText('Production API Key')).toBeInTheDocument();
    });
    const revokeButtons = screen.getAllByText('Revoke');
    expect(revokeButtons).toHaveLength(3);
  });

  it('renders Create API Key button', async () => {
    render(<ApiKeysPage />);
    await waitFor(() => {
      expect(screen.getByText('Create API Key')).toBeInTheDocument();
    });
  });

  it('shows empty state when no keys exist', async () => {
    mockGetApiKeys.mockResolvedValue([]);
    render(<ApiKeysPage />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(screen.getByText('No API keys')).toBeInTheDocument();
  });

  it('shows error toast on fetch failure', async () => {
    mockGetApiKeys.mockRejectedValue(new Error('Network error'));
    render(<ApiKeysPage />);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Network error');
    });
  });

  it('renders usage instructions section', async () => {
    render(<ApiKeysPage />);
    await waitFor(() => {
      expect(screen.getByText('How to use API Keys')).toBeInTheDocument();
    });
    expect(screen.getByText('X-API-Key')).toBeInTheDocument();
  });
});
