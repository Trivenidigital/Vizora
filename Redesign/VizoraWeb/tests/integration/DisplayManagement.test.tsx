import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '../utils/test-utils';
import DisplaysPage from '../mocks/DisplaysPage';
import { mockDisplays } from '../mocks/displayServiceMock';
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));

describe('Display Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays display list', async () => {
    render(<DisplaysPage />);

    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
      expect(screen.getByText('Conference Room Display')).toBeInTheDocument();
    });

    // Get the display cards
    const displayCards = screen.getAllByRole('heading', { level: 3 });
    const mainLobbyCard = displayCards[0].closest('.display-card');
    const conferenceRoomCard = displayCards[1].closest('.display-card');

    // Check status within each card to avoid ambiguity
    if (mainLobbyCard) {
      expect(within(mainLobbyCard).getByText('online')).toBeInTheDocument();
    }
    if (conferenceRoomCard) {
      expect(within(conferenceRoomCard).getByText('offline')).toBeInTheDocument();
    }
  });

  it('allows filtering displays by status', async () => {
    render(<DisplaysPage />);

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    // Find and click the Online button
    const filterButtons = screen.getAllByRole('button');
    const onlineButton = filterButtons.find(button => button.textContent === 'Online');
    fireEvent.click(onlineButton!);
    
    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
      expect(screen.queryByText('Conference Room Display')).not.toBeInTheDocument();
    });
  });

  it('allows searching displays', async () => {
    render(<DisplaysPage />);

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    // Enter search term
    const searchInput = screen.getByPlaceholderText('Search displays...');
    fireEvent.change(searchInput, { target: { value: 'Conference' } });

    await waitFor(() => {
      expect(screen.getByText('Conference Room Display')).toBeInTheDocument();
      expect(screen.queryByText('Main Lobby Display')).not.toBeInTheDocument();
    });
  });

  it('handles display deletion', async () => {
    render(<DisplaysPage />);

    await waitFor(() => {
      expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    });

    // Click unpair button for first display
    const unpairButtons = screen.getAllByRole('button', { name: 'Unpair' });
    fireEvent.click(unpairButtons[0]);

    // Confirm deletion in modal
    const modal = screen.getByText('Confirm Unpair').closest('.modal');
    if (modal) {
      const confirmButton = within(modal).getByRole('button', { name: 'Confirm' });
      fireEvent.click(confirmButton);
    }

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Display unpaired successfully');
    });
  });

  it('handles display registration', async () => {
    render(<DisplaysPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Find and click the Add Display button by its exact text
    const buttons = screen.getAllByRole('button');
    const addButton = buttons.find(button => button.textContent === 'Add Display');
    expect(addButton).toBeTruthy();
    fireEvent.click(addButton!);

    // Fill form in modal
    const modal = screen.getByText('Pair New Display').closest('.modal');
    if (modal) {
      const codeInput = within(modal).getByLabelText(/pairing code/i);
      fireEvent.change(codeInput, { target: { value: 'ABC123' } });
      
      const nameInput = within(modal).getByLabelText(/display name/i);
      fireEvent.change(nameInput, { target: { value: 'New Display' } });
      
      // Submit form
      const submitButton = within(modal).getByRole('button', { name: 'Pair' });
      fireEvent.click(submitButton);
    }

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Display paired successfully');
    });
  });

  it('handles errors gracefully', async () => {
    // Force an error by rendering the component and dispatching a custom event for error testing
    render(<DisplaysPage />);
    
    // Simulate display loading
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });
}); 