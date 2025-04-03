import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import DisplayList from '../../src/pages/displays/DisplayList';
import * as displayService from '../../src/services/displayService';
import toast from 'react-hot-toast';

// Mock services
vi.mock('../../src/services/displayService');
vi.mock('react-hot-toast');

const mockDisplays = [
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
    type: 'digital-signage',
    resolution: '1920x1080',
    orientation: 'landscape',
    schedule: {
      enabled: true,
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'UTC',
    },
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
    type: 'digital-signage',
    resolution: '1920x1080',
    orientation: 'landscape',
    schedule: {
      enabled: true,
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'UTC',
    },
  },
];

describe('Display Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (displayService.getDisplays as any).mockResolvedValue(mockDisplays);
  });

  it('loads and displays display list', async () => {
    render(<DisplayList />);

    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
      expect(screen.getByText('Conference Room A')).toBeInTheDocument();
    });

    // Verify display details are shown
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });

  it('allows filtering displays by status', async () => {
    render(<DisplayList />);

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    // Click active filter
    fireEvent.click(screen.getByText('Active'));
    
    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
      expect(screen.queryByText('Conference Room A')).not.toBeInTheDocument();
    });
  });

  it('allows searching displays', async () => {
    render(<DisplayList />);

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    // Enter search term
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Conference' } });

    await waitFor(() => {
      expect(screen.getByText('Conference Room A')).toBeInTheDocument();
      expect(screen.queryByText('Main Lobby Display')).not.toBeInTheDocument();
    });
  });

  it('handles display deletion', async () => {
    (displayService.deleteDisplay as any).mockResolvedValue(undefined);
    
    render(<DisplayList />);

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    // Click delete button for first display
    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(displayService.deleteDisplay).toHaveBeenCalledWith('disp-001');
      expect(toast.success).toHaveBeenCalledWith('Display deleted successfully');
    });
  });

  it('handles display registration', async () => {
    const mockNewDisplay = {
      name: 'New Display',
      location: 'New Location',
      type: 'digital-signage',
      resolution: '1920x1080',
      orientation: 'landscape',
    };
    (displayService.registerDisplay as any).mockResolvedValue({ ...mockNewDisplay, _id: 'disp-003' });
    
    render(<DisplayList />);

    // Click add display button
    const addButton = screen.getByRole('button', { name: /add display/i });
    fireEvent.click(addButton);

    // Fill in display details
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Display' } });
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'New Location' } });
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'digital-signage' } });
    fireEvent.change(screen.getByLabelText(/resolution/i), { target: { value: '1920x1080' } });
    fireEvent.change(screen.getByLabelText(/orientation/i), { target: { value: 'landscape' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(displayService.registerDisplay).toHaveBeenCalledWith(mockNewDisplay);
      expect(toast.success).toHaveBeenCalledWith('Display registered successfully');
    });
  });

  it('handles errors gracefully', async () => {
    const error = new Error('API Error');
    (displayService.getDisplays as any).mockRejectedValue(error);
    
    render(<DisplayList />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load displays');
    });
  });
}); 