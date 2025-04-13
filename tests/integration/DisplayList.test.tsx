import React from 'react';
import { describe, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import DisplayList from '../../src/pages/displays/DisplayList';
import displayService from '../../src/services/displays';
import toast from 'react-hot-toast';

// Mock the modules
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/services/displays', () => ({
  default: {
    getDisplays: vi.fn(),
    unpairDisplay: vi.fn(),
  },
}));

// Mock PushContentDialog component
vi.mock('../../src/components/PushContentDialog', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    isOpen ? (
      <div data-testid="push-content-dialog">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  ),
}));

describe('DisplayList Integration Tests', () => {
  const mockDisplays = [
    {
      _id: 'display-1',
      name: 'Test Display 1',
      location: 'Room 101',
      qrCode: 'QR123',
      status: 'active',
      lastConnected: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: 'user-1',
    },
    {
      _id: 'display-2',
      name: 'Test Display 2',
      location: 'Room 102',
      qrCode: 'QR124',
      status: 'inactive',
      lastConnected: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: 'user-1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful displays fetch
    (displayService.getDisplays as any).mockResolvedValue(mockDisplays);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <DisplayList />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders display list after loading', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <DisplayList />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('display-list')).toBeInTheDocument();
      expect(screen.getByText('Test Display 1')).toBeInTheDocument();
      expect(screen.getByText('Test Display 2')).toBeInTheDocument();
    });
  });

  it('shows empty state when no displays', async () => {
    (displayService.getDisplays as any).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <AuthProvider>
          <DisplayList />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText("You haven't paired any displays yet")).toBeInTheDocument();
    });
  });

  it('handles display unpairing', async () => {
    (displayService.unpairDisplay as any).mockResolvedValue(undefined);
    (global as any).confirm = vi.fn(() => true); // Mock confirm dialog

    render(
      <BrowserRouter>
        <AuthProvider>
          <DisplayList />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('display-list')).toBeInTheDocument();
    });

    // Click unpair button for first display
    fireEvent.click(screen.getByTestId('unpair-button-display-1'));

    await waitFor(() => {
      expect(displayService.unpairDisplay).toHaveBeenCalledWith('display-1');
      expect(toast.success).toHaveBeenCalledWith('Display unpaired successfully');
    });
  });

  it('shows push content dialog when clicking push content', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <DisplayList />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('display-list')).toBeInTheDocument();
    });

    // Click push content button for first display
    fireEvent.click(screen.getByTestId('push-content-button-display-1'));

    expect(screen.getByTestId('push-content-dialog')).toBeInTheDocument();

    // Close dialog
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('push-content-dialog')).not.toBeInTheDocument();
  });

  it('handles error when loading displays fails', async () => {
    const error = new Error('Failed to load displays');
    (displayService.getDisplays as any).mockRejectedValue(error);

    render(
      <BrowserRouter>
        <AuthProvider>
          <DisplayList />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith('Failed to load displays');
    });
  });
}); 