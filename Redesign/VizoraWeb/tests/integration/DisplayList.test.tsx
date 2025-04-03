import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import DisplayList from '../../src/pages/displays/DisplayList';
import toast from 'react-hot-toast';
import * as displayService from '../../src/services/displays';
import type { Display } from '../../src/services/displays';

// Mock displayService
vi.mock('../../src/services/displays', () => ({
  default: {
    getDisplays: vi.fn(),
    unpairDisplay: vi.fn(),
  },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
  success: vi.fn(),
  error: vi.fn(),
}));

const mockDisplays: Display[] = [
  {
    _id: 'disp-001',
    name: 'Main Lobby Display',
    location: 'Main Lobby',
    qrCode: 'QLOB01',
    status: 'active',
    lastConnected: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    user: 'user1',
  },
  {
    _id: 'disp-002',
    name: 'Conference Room A',
    location: 'Conference Room A',
    qrCode: 'CONA01',
    status: 'inactive',
    lastConnected: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    user: 'user1',
  },
  {
    _id: 'disp-003',
    name: 'Cafeteria Display',
    location: 'Cafeteria',
    qrCode: 'CAFE01',
    status: 'active',
    lastConnected: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    user: 'user1',
  },
];

describe('DisplayList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm
    window.confirm = vi.fn(() => true);
    // Set up localStorage token
    localStorage.setItem('token', 'fake-token');
  });

  it('renders loading state initially', () => {
    (displayService.default.getDisplays as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<DisplayList />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders displays when loaded', async () => {
    (displayService.default.getDisplays as jest.Mock).mockResolvedValueOnce(mockDisplays);

    render(<DisplayList />);

    // Wait for loading state to clear
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // Check if displays are rendered
    expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    expect(screen.getByText('Conference Room A')).toBeInTheDocument();
    expect(screen.getByText('Cafeteria Display')).toBeInTheDocument();
  });

  it('renders empty state when no displays', async () => {
    (displayService.default.getDisplays as jest.Mock).mockResolvedValueOnce([]);

    render(<DisplayList />);

    // Wait for loading state to clear
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // Check if empty state is rendered
    expect(screen.getByText(/no displays found/i)).toBeInTheDocument();
  });

  it('handles display unpairing', async () => {
    (displayService.default.getDisplays as jest.Mock).mockResolvedValueOnce(mockDisplays);
    (displayService.default.unpairDisplay as jest.Mock).mockResolvedValueOnce({ success: true });

    render(<DisplayList />);

    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    // Find and click unpair button for first display
    const unpairButton = screen.getAllByRole('button', { name: /unpair/i })[0];
    fireEvent.click(unpairButton);

    // Wait for success message
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Display unpaired successfully');
    });

    // Verify service was called
    expect(displayService.default.unpairDisplay).toHaveBeenCalledWith('disp-001');
  });

  it('handles error when loading displays fails', async () => {
    (displayService.default.getDisplays as jest.Mock).mockRejectedValueOnce(new Error('Failed to load displays'));

    render(<DisplayList />);

    // Wait for error message
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load displays');
    });
  });

  it('handles error when unpairing display fails', async () => {
    (displayService.default.getDisplays as jest.Mock).mockResolvedValueOnce(mockDisplays);
    (displayService.default.unpairDisplay as jest.Mock).mockRejectedValueOnce(new Error('Failed to unpair display'));

    render(<DisplayList />);

    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    // Find and click unpair button for first display
    const unpairButton = screen.getAllByRole('button', { name: /unpair/i })[0];
    fireEvent.click(unpairButton);

    // Wait for error message
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to unpair display');
    });
  });
}); 