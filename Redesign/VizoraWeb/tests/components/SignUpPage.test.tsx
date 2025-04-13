import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { SignUpPage } from '../../src/pages/SignUpPage';
import { authService } from '../../src/services/authService';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}));

vi.mock('../../src/services/authService', () => ({
  authService: {
    register: vi.fn(),
  }
}));

describe('SignUpPage', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    render(<SignUpPage />);
  });

  it('renders the signup form', () => {
    expect(screen.getByPlaceholderText(/first name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/last name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/company name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/I agree to the/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('validates password match', async () => {
    // Fill form with mismatched passwords
    fireEvent.change(screen.getByPlaceholderText(/first name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByPlaceholderText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/email address/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/company name/i), { target: { value: 'Test Company' } });
    
    // Use getByPlaceholderText instead of getElementById
    const passwordField = screen.getByPlaceholderText(/^password$/i);
    const confirmPasswordField = screen.getByPlaceholderText(/confirm password/i);
    
    fireEvent.change(passwordField, { target: { value: 'StrongP@ss123' } });
    fireEvent.change(confirmPasswordField, { target: { value: 'DifferentP@ss123' } });
    fireEvent.click(screen.getByLabelText(/I agree to the/i));
    
    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);
    
    // Check for mismatch error
    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('successfully submits the form and navigates to dashboard', async () => {
    vi.mocked(authService.register).mockResolvedValue({ success: true });
    
    // Fill out the form with valid data
    fireEvent.change(screen.getByPlaceholderText(/first name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByPlaceholderText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/email address/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/company name/i), { target: { value: 'Test Company' } });
    
    // Use getByPlaceholderText instead of getElementById
    const passwordField = screen.getByPlaceholderText(/^password$/i);
    const confirmPasswordField = screen.getByPlaceholderText(/confirm password/i);
    
    fireEvent.change(passwordField, { target: { value: 'StrongP@ss123' } });
    fireEvent.change(confirmPasswordField, { target: { value: 'StrongP@ss123' } });
    fireEvent.click(screen.getByLabelText(/I agree to the/i));
    
    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        companyName: 'Test Company',
        password: 'StrongP@ss123',
      });
      expect(toast.success).toHaveBeenCalledWith('Account created successfully!');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles registration errors', async () => {
    const errorMessage = 'Registration failed: Email already exists';
    vi.mocked(authService.register).mockRejectedValue(new Error(errorMessage));
    
    // Fill out the form with valid data
    fireEvent.change(screen.getByPlaceholderText(/first name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByPlaceholderText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/email address/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/company name/i), { target: { value: 'Test Company' } });
    
    // Use getByPlaceholderText instead of getElementById
    const passwordField = screen.getByPlaceholderText(/^password$/i);
    const confirmPasswordField = screen.getByPlaceholderText(/confirm password/i);
    
    fireEvent.change(passwordField, { target: { value: 'StrongP@ss123' } });
    fireEvent.change(confirmPasswordField, { target: { value: 'StrongP@ss123' } });
    fireEvent.click(screen.getByLabelText(/I agree to the/i));
    
    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(authService.register).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
}); 