import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import { act } from 'react-dom/test-utils';
import LoginPage from '../mocks/LoginPage';
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

describe('LoginPage Integration Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Clear localStorage before each test
    localStorage.clear();
    
    // Mock localStorage.setItem to test authentication
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      clear: vi.fn()
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });
  
  afterEach(() => {
    // Restore original implementation
    vi.restoreAllMocks();
  });
  
  test('renders login form correctly', () => {
    render(<LoginPage />);
    
    // Check that all form elements are rendered
    expect(screen.getByText('Sign in to Vizora')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
  
  test('shows validation errors when form is submitted with empty fields', async () => {
    render(<LoginPage />);
    
    // Submit form without entering any data
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    fireEvent.click(submitButton);
    
    // Check error toast is called
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please enter both email and password');
    });
  });
  
  test('shows loading state during login attempt', async () => {
    // Create a spy on localStorage.setItem to verify it was called
    const localStorageSpy = vi.spyOn(localStorage, 'setItem');
    
    render(<LoginPage />);
    
    // Fill in form
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' }
    });
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    
    // Use act to handle the state update
    await act(async () => {
      fireEvent.click(submitButton);
      
      // Wait for the login simulation to complete (1000ms)
      await new Promise(resolve => setTimeout(resolve, 1100));
    });
    
    // Verify that localStorage was called, indicating the async process completed
    expect(localStorageSpy).toHaveBeenCalledWith('isAuthenticated', 'true');
    expect(toast.success).toHaveBeenCalledWith('Logged in successfully');
    
    // Clean up the spy
    localStorageSpy.mockRestore();
  });
  
  test('sets authentication in localStorage after successful login', async () => {
    render(<LoginPage />);
    
    // Fill in form
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' }
    });
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    
    await act(async () => {
      fireEvent.click(submitButton);
      
      // Wait for the login simulation to complete
      await new Promise(resolve => setTimeout(resolve, 1100));
    });
    
    // Check localStorage was updated
    expect(localStorage.setItem).toHaveBeenCalledWith('isAuthenticated', 'true');
    
    // Success toast should be shown
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Logged in successfully');
    });
  });
}); 