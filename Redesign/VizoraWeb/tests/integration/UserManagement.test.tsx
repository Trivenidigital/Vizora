import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '../utils/test-utils';
import UserManagementPage from '../mocks/UserManagementPage';
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

describe('User Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays user list', async () => {
    render(<UserManagementPage />);

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Editor User')).toBeInTheDocument();
      expect(screen.getByText('Viewer User')).toBeInTheDocument();
    });

    // Get user cards by their names first
    const adminUserCard = screen.getByText('Admin User').closest('.user-card');
    const editorUserCard = screen.getByText('Editor User').closest('.user-card');
    const viewerUserCard = screen.getByText('Viewer User').closest('.user-card');
    
    // Verify role texts are shown within each user card
    expect(within(adminUserCard!).getByText('admin')).toBeInTheDocument();
    expect(within(editorUserCard!).getByText('editor')).toBeInTheDocument();
    expect(within(viewerUserCard!).getByText('viewer')).toBeInTheDocument();
  });

  it('allows filtering users by role', async () => {
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    // Select role filter
    const roleSelect = screen.getByLabelText(/role:/i);
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
    const searchInput = screen.getByPlaceholderText(/search users/i);
    fireEvent.change(searchInput, { target: { value: 'editor' } });

    await waitFor(() => {
      expect(screen.getByText('Editor User')).toBeInTheDocument();
      expect(screen.queryByText('Admin User')).not.toBeInTheDocument();
      expect(screen.queryByText('Viewer User')).not.toBeInTheDocument();
    });
  });

  it('handles user creation', async () => {
    render(<UserManagementPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Click add user button
    const addButton = screen.getByRole('button', { name: /add user/i });
    fireEvent.click(addButton);

    // Fill in user details in the modal
    const modal = screen.getByText('Create New User').closest('.modal');
    expect(modal).toBeInTheDocument();

    // Fill form fields within modal
    const emailInput = within(modal!).getByLabelText(/email:/i);
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    
    const nameInput = within(modal!).getByLabelText(/name:/i);
    fireEvent.change(nameInput, { target: { value: 'New User' } });
    
    const roleSelect = within(modal!).getByLabelText(/role:/i);
    fireEvent.change(roleSelect, { target: { value: 'editor' } });
    
    const orgInput = within(modal!).getByLabelText(/organization:/i);
    fireEvent.change(orgInput, { target: { value: 'Example Corp' } });
    
    // Select permissions
    const contentCheckbox = within(modal!).getByLabelText(/Manage Content/i);
    const displaysCheckbox = within(modal!).getByLabelText(/Manage Displays/i);
    
    fireEvent.click(contentCheckbox);
    fireEvent.click(displaysCheckbox);

    // Submit form
    const submitButton = within(modal!).getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('User created successfully');
    });
  });

  it('handles user deletion', async () => {
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Viewer User')).toBeInTheDocument();
    });

    // Find and click delete button for Viewer User
    const userCards = screen.getAllByRole('heading', { level: 3 });
    const viewerUserCard = userCards[2].closest('.user-card');
    
    const deleteButton = within(viewerUserCard!).getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    // Confirm deletion in the modal
    const modal = screen.getByText('Confirm Deletion').closest('.modal');
    const confirmButton = within(modal!).getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('User deleted successfully');
    });
  });

  it('handles user updates', async () => {
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Editor User')).toBeInTheDocument();
    });

    // Find and click edit button for Editor User
    const userCards = screen.getAllByRole('heading', { level: 3 });
    const editorUserCard = userCards[1].closest('.user-card');
    
    const editButton = within(editorUserCard!).getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Update user details in the modal
    const modal = screen.getByText('Edit User').closest('.modal');
    
    const nameInput = within(modal!).getByLabelText(/name:/i);
    fireEvent.change(nameInput, { target: { value: 'Updated Editor User' } });
    
    const roleSelect = within(modal!).getByLabelText(/role:/i);
    fireEvent.change(roleSelect, { target: { value: 'admin' } });
    
    // Update permissions
    const usersCheckbox = within(modal!).getByLabelText(/Manage Users/i);
    fireEvent.click(usersCheckbox);

    // Submit form
    const submitButton = within(modal!).getByRole('button', { name: /update/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('User updated successfully');
    });
  });

  it('handles user status toggle', async () => {
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Viewer User')).toBeInTheDocument();
    });

    // Find and click status toggle for Viewer User
    const userCards = screen.getAllByRole('heading', { level: 3 });
    const viewerUserCard = userCards[2].closest('.user-card');
    
    const statusToggle = within(viewerUserCard!).getByRole('switch');
    fireEvent.click(statusToggle);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('User status updated successfully');
    });
  });
}); 