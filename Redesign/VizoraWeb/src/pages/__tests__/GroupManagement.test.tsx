import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GroupManagement } from '../GroupManagement';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';
import { useDisplays } from '../../hooks/useDisplays';

// Mock the hooks
jest.mock('../../hooks/useSocket');
jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useDisplays');

const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

const mockGroups = [
  {
    id: 'group1',
    name: 'Test Group 1',
    description: 'Test Description 1',
    displayIds: ['display1', 'display2'],
  },
  {
    id: 'group2',
    name: 'Test Group 2',
    description: 'Test Description 2',
    displayIds: ['display3'],
  },
];

const mockDisplays = [
  {
    id: 'display1',
    name: 'Display 1',
    health: { status: 'healthy' },
  },
  {
    id: 'display2',
    name: 'Display 2',
    health: { status: 'warning' },
  },
  {
    id: 'display3',
    name: 'Display 3',
    health: { status: 'healthy' },
  },
];

describe('GroupManagement', () => {
  beforeEach(() => {
    (useSocket as jest.Mock).mockReturnValue(mockSocket);
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        role: 'admin',
      },
    });
    (useDisplays as jest.Mock).mockReturnValue({
      displays: mockDisplays,
    });

    // Mock fetch
    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ groups: mockGroups }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders group management page', async () => {
    render(<GroupManagement />);

    await waitFor(() => {
      expect(screen.getByText('Display Groups')).toBeInTheDocument();
      expect(screen.getByText('Create New Group')).toBeInTheDocument();
    });
  });

  it('displays list of groups', async () => {
    render(<GroupManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Group 1')).toBeInTheDocument();
      expect(screen.getByText('Test Group 2')).toBeInTheDocument();
      expect(screen.getByText('2 displays')).toBeInTheDocument();
      expect(screen.getByText('1 display')).toBeInTheDocument();
    });
  });

  it('handles group creation', async () => {
    const newGroup = {
      name: 'New Group',
      description: 'New Description',
      displayIds: ['display1'],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...newGroup, id: 'group3' }),
    });

    render(<GroupManagement />);

    // Click create button
    fireEvent.click(screen.getByText('Create New Group'));

    // Fill form
    fireEvent.change(screen.getByLabelText(/group name/i), {
      target: { value: newGroup.name },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: newGroup.description },
    });
    fireEvent.click(screen.getByLabelText(/display 1/i));

    // Submit form
    fireEvent.click(screen.getByText(/create group/i));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroup),
      });
    });
  });

  it('handles group deletion', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(<GroupManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Group 1')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/groups/group1', {
        method: 'DELETE',
      });
    });
  });

  it('handles real-time updates', async () => {
    render(<GroupManagement />);

    // Simulate real-time update
    const updateCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'display:group:update'
    )[1];
    updateCallback({
      group: {
        id: 'group3',
        name: 'New Group',
        description: 'New Description',
        displayIds: ['display1'],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('New Group')).toBeInTheDocument();
    });
  });

  it('displays group statistics', async () => {
    render(<GroupManagement />);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // Total displays
      expect(screen.getByText('2')).toBeInTheDocument(); // Total groups
      expect(screen.getByText('3')).toBeInTheDocument(); // Displays in groups
      expect(screen.getByText('0')).toBeInTheDocument(); // Unassigned displays
    });
  });

  it('restricts admin actions for non-admin users', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        role: 'user',
      },
    });

    render(<GroupManagement />);

    await waitFor(() => {
      expect(screen.queryByText('Create New Group')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });
  });
}); 