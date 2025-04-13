import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from '../../src/pages/LoginPage';
import { renderWithProviders, authMock } from '../utils/test-utils.tsx';

// Create a mock specifically for this test file
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authMock
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authMock.login.mockClear();
    authMock.isLoading = false;
  });

  it('renders login form', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('handles form submission', async () => {
    renderWithProviders(<LoginPage />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authMock.login).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('handles login error', async () => {
    const errorMessage = 'Invalid credentials';
    authMock.login.mockRejectedValueOnce(new Error(errorMessage));

    renderWithProviders(<LoginPage />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' },
    });
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('shows loading state during login', async () => {
    // Setup a promise that we can control
    const loginPromise = new Promise<void>(resolve => {
      // We'll resolve this later
      setTimeout(() => resolve(), 100);
    });
    
    // Mock the login function to return our controlled promise
    authMock.login.mockReturnValueOnce(loginPromise);
    
    // Set loading state to true
    authMock.isLoading = true;
    
    renderWithProviders(<LoginPage />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    
    const submitButton = screen.getByRole('button', { name: /signing in/i });
    expect(submitButton).toBeDisabled();
    
    // Set loading state to false
    authMock.isLoading = false;
  });
}); 