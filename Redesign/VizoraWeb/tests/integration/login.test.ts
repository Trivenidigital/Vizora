import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { act } from 'react-dom/test-utils';
import LoginPage from '../../pages/auth/LoginPage';

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  success: vi.fn(),
  error: vi.fn()
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
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    
    // Check that all form elements are rendered
    expect(screen.getByText('Sign in to Vizora')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
  
  test('shows validation errors when form is submitted with empty fields', async () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    
    // Submit form without entering any data
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);
    
    // Toast error should be called
    const toast = await import('react-hot-toast');
    expect(toast.error).toHaveBeenCalledWith('Please enter both email and password');
    
    // Navigate should not be called
    expect(mockNavigate).not.toHaveBeenCalled();
  });
  
  test('shows loading state during login attempt', async () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    
    // Fill in form
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    // Use act to handle the state update
    await act(async () => {
      fireEvent.click(submitButton);
      
      // Check that loading state is shown
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      
      // Wait for the login simulation to complete (1000ms)
      await new Promise(resolve => setTimeout(resolve, 1100));
    });
    
    // After login completes, should navigate to dashboard
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
  
  test('sets authentication in localStorage after successful login', async () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    
    // Fill in form
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await act(async () => {
      fireEvent.click(submitButton);
      
      // Wait for the login simulation to complete
      await new Promise(resolve => setTimeout(resolve, 1100));
    });
    
    // Check localStorage was updated
    expect(localStorage.setItem).toHaveBeenCalledWith('isAuthenticated', 'true');
    
    // Success toast should be shown
    const toast = await import('react-hot-toast');
    expect(toast.success).toHaveBeenCalledWith('Logged in successfully');
    
    // Should navigate to dashboard
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
  
  test('handles login error gracefully', async () => {
    // Mock Promise.reject to simulate API error
    const originalPromise = global.Promise;
    global.Promise = class extends originalPromise {
      static reject = vi.fn().mockImplementationOnce(() => {
        throw new Error('Login failed');
      });
    };
    
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    
    // Fill in form
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrong-password' }
    });
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    // Mock console.error to prevent test output pollution
    const originalConsoleError = console.error;
    console.error = vi.fn();
    
    await act(async () => {
      fireEvent.click(submitButton);
      
      // Wait for the error to be handled
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // Restore console.error
    console.error = originalConsoleError;
    
    // Error toast should be shown
    const toast = await import('react-hot-toast');
    expect(toast.error).toHaveBeenCalledWith('Failed to login. Please check your credentials.');
    
    // Should not navigate to dashboard
    expect(mockNavigate).not.toHaveBeenCalled();
    
    // Restore original Promise
    global.Promise = originalPromise;
  });
}); 