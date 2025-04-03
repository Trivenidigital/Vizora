import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import UserManagementPage from '../../src/pages/admin/UserManagementPage';
import * as userService from '../../src/services/userService';
import toast from 'react-hot-toast';

// Mock services
vi.mock('../../src/services/userService');
vi.mock('react-hot-toast');

const mockUsers = [
  {
    _id: 'user-001',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    organization: 'Example Corp',
    permissions: ['manage_users', 'manage_content', 'manage_displays'],
  },
  {
    _id: 'user-002',
    email: 'editor@example.com',
    name: 'Editor User',
    role: 'editor',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    organization: 'Example Corp',
    permissions: ['manage_content', 'manage_displays'],
  },
  {
    _id: 'user-003',
    email: 'viewer@example.com',
    name: 'Viewer User',
    role: 'viewer',
    status: 'inactive',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    organization: 'Example Corp',
    permissions: ['view_content', 'view_displays'],
  },
];

describe('User Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (userService.getUsers as any).mockResolvedValue(mockUsers);
  });

  it('loads and displays user list', async () => {
    render(<UserManagementPage />);

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Editor User')).toBeInTheDocument();
      expect(screen.getByText('Viewer User')).toBeInTheDocument();
    });

    // Verify user details are shown
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
    expect(screen.getByText('viewer')).toBeInTheDocument();
  });

  it('allows filtering users by role', async () => {
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    // Select role filter
    const roleSelect = screen.getByLabelText(/role/i);
    fireEvent.change(roleSelect, { target: { value: 'admin' } });
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.queryByText('Editor User')).not.toBeInTheDocument();
      expect(screen.queryByText('Viewer User')).not.toBeInTheDocument();
    });
  });

  it('allows searching users', async () => {
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    // Enter search term
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'editor' } });

    await waitFor(() => {
      expect(screen.getByText('Editor User')).toBeInTheDocument();
      expect(screen.queryByText('Admin User')).not.toBeInTheDocument();
      expect(screen.queryByText('Viewer User')).not.toBeInTheDocument();
    });
  });

  it('handles user creation', async () => {
    const mockNewUser = {
      email: 'newuser@example.com',
      name: 'New User',
      role: 'editor',
      organization: 'Example Corp',
      permissions: ['manage_content', 'manage_displays'],
    };
    (userService.createUser as any).mockResolvedValue({ ...mockNewUser, _id: 'user-004' });
    
    render(<UserManagementPage />);

    // Click add user button
    const addButton = screen.getByRole('button', { name: /add user/i });
    fireEvent.click(addButton);

    // Fill in user details
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'newuser@example.com' } });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'editor' } });
    fireEvent.change(screen.getByLabelText(/organization/i), { target: { value: 'Example Corp' } });
    
    // Select permissions
    const contentCheckbox = screen.getByLabelText(/manage content/i);
    const displaysCheckbox = screen.getByLabelText(/manage displays/i);
    
    fireEvent.click(contentCheckbox);
    fireEvent.click(displaysCheckbox);

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(userService.createUser).toHaveBeenCalledWith(mockNewUser);
      expect(toast.success).toHaveBeenCalledWith('User created successfully');
    });
  });

  it('handles user deletion', async () => {
    (userService.deleteUser as any).mockResolvedValue(undefined);
    
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Viewer User')).toBeInTheDocument();
    });

    // Click delete button for viewer user
    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[2];
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(userService.deleteUser).toHaveBeenCalledWith('user-003');
      expect(toast.success).toHaveBeenCalledWith('User deleted successfully');
    });
  });

  it('handles user updates', async () => {
    const mockUpdate = {
      name: 'Updated Editor User',
      role: 'admin',
      permissions: ['manage_users', 'manage_content', 'manage_displays'],
    };
    (userService.updateUser as any).mockResolvedValue({
      ...mockUsers[1],
      ...mockUpdate,
    });
    
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Editor User')).toBeInTheDocument();
    });

    // Click edit button for editor user
    const editButton = screen.getAllByRole('button', { name: /edit/i })[1];
    fireEvent.click(editButton);

    // Update user details
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Updated Editor User' } });
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'admin' } });
    
    // Update permissions
    const usersCheckbox = screen.getByLabelText(/manage users/i);
    fireEvent.click(usersCheckbox);

    // Submit form
    const submitButton = screen.getByRole('button', { name: /update/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(userService.updateUser).toHaveBeenCalledWith('user-002', mockUpdate);
      expect(toast.success).toHaveBeenCalledWith('User updated successfully');
    });
  });

  it('handles user status toggle', async () => {
    (userService.updateUserStatus as any).mockResolvedValue({
      ...mockUsers[2],
      status: 'active',
    });
    
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Viewer User')).toBeInTheDocument();
    });

    // Click status toggle for viewer user
    const statusToggle = screen.getAllByRole('switch')[2];
    fireEvent.click(statusToggle);

    await waitFor(() => {
      expect(userService.updateUserStatus).toHaveBeenCalledWith('user-003', 'active');
      expect(toast.success).toHaveBeenCalledWith('User status updated successfully');
    });
  });

  it('handles errors gracefully', async () => {
    const error = new Error('API Error');
    (userService.getUsers as any).mockRejectedValue(error);
    
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load users');
    });
  });
}); 