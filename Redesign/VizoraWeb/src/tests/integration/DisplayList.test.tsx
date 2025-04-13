import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DisplayList } from '../../pages/displays/DisplayList';
import { BrowserRouter } from 'react-router-dom';
import * as displayService from '../../services/displayService';
import { toast } from 'react-hot-toast';

// Mock displayService
vi.mock('../../services/displayService', () => ({
  displayService: {
    getDisplays: vi.fn(),
    unpairDisplay: vi.fn()
  }
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

// Define the Display interface to match the component's expected props
interface Display {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'maintenance';
  description?: string;
  location?: string;
  lastSeen?: string;
  ipAddress?: string;
}

// Create mock displays that match the expected props format
const mockDisplays: Display[] = [
  {
    id: '1',
    name: 'Main Lobby Display',
    status: 'active',
    location: 'Main Lobby',
    lastSeen: new Date().toISOString(),
    ipAddress: '192.168.1.100',
    description: 'Main display in lobby',
  },
  {
    id: '2',
    name: 'Conference Room A',
    status: 'inactive',
    location: 'Conference Room A',
    lastSeen: new Date().toISOString(),
    ipAddress: '192.168.1.101',
  },
  {
    id: '3',
    name: 'Cafeteria Display',
    status: 'active',
    location: 'Cafeteria',
    lastSeen: new Date().toISOString(),
    ipAddress: '192.168.1.102',
  }
];

// Create mock props for the DisplayList component
const mockProps = {
  displays: mockDisplays,
  onSelectDisplay: vi.fn(),
  onDeleteDisplay: vi.fn(),
  isAdmin: true
};

describe('DisplayList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window.confirm to always return true
    window.confirm = vi.fn(() => true);
  });

  it('renders displays when loaded', async () => {
    render(
      <BrowserRouter>
        <DisplayList 
          displays={mockDisplays}
          onSelectDisplay={mockProps.onSelectDisplay}
          onDeleteDisplay={mockProps.onDeleteDisplay}
          isAdmin={true}
        />
      </BrowserRouter>
    );

    // Check if displays are rendered
    expect(screen.getByText('Main Lobby Display')).toBeInTheDocument();
    expect(screen.getByText('Conference Room A')).toBeInTheDocument();
    expect(screen.getByText('Cafeteria Display')).toBeInTheDocument();
  });

  it('renders empty state when no displays', async () => {
    render(
      <BrowserRouter>
        <DisplayList 
          displays={[]}
          onSelectDisplay={mockProps.onSelectDisplay}
          onDeleteDisplay={mockProps.onDeleteDisplay}
          isAdmin={true}
        />
      </BrowserRouter>
    );

    // Check if empty state is rendered
    expect(screen.getByText(/no displays found/i)).toBeInTheDocument();
  });

  it('handles display deletion', async () => {
    render(
      <BrowserRouter>
        <DisplayList 
          displays={mockDisplays}
          onSelectDisplay={mockProps.onSelectDisplay}
          onDeleteDisplay={mockProps.onDeleteDisplay}
          isAdmin={true}
        />
      </BrowserRouter>
    );

    // Find and click delete button for first display
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    // Verify callback was called
    expect(mockProps.onDeleteDisplay).toHaveBeenCalledWith('1');
  });

  it('handles push content', async () => {
    render(
      <BrowserRouter>
        <DisplayList 
          displays={mockDisplays}
          onSelectDisplay={mockProps.onSelectDisplay}
          onDeleteDisplay={mockProps.onDeleteDisplay}
          isAdmin={true}
        />
      </BrowserRouter>
    );

    // Find and click push content button for first display
    const pushButtons = screen.getAllByRole('button', { name: /push content/i });
    fireEvent.click(pushButtons[0]);

    // Verify dialog would open (the actual dialog is tested separately)
    // This test just ensures the click handler works
  });

  it('does not show delete button for non-admin users', async () => {
    render(
      <BrowserRouter>
        <DisplayList 
          displays={mockDisplays}
          onSelectDisplay={mockProps.onSelectDisplay}
          onDeleteDisplay={mockProps.onDeleteDisplay}
          isAdmin={false}
        />
      </BrowserRouter>
    );

    // Verify no delete buttons are shown
    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
    expect(deleteButtons.length).toBe(0);
  });
}); 