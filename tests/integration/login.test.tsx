import React from 'react';
import { describe, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import LoginPage from '../../src/pages/auth/LoginPage';
import * as router from 'react-router-dom';
import toast from 'react-hot-toast';

// Mock the modules
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('LoginPage Integration Tests', () => {
  const navigate = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    vi.spyOn(router, 'useNavigate').mockImplementation(() => navigate);
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    (global as any).localStorage = localStorageMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form correctly', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-button')).toBeInTheDocument();
    expect(screen.getByTestId('remember-checkbox')).toBeInTheDocument();
  });

  it('shows validation error for empty fields', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    // Try to submit without filling fields
    fireEvent.click(screen.getByTestId('login-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please enter both email and password');
    });
  });

  it('handles successful login', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    // Fill in the form
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'password123' },
    });

    // Submit the form
    fireEvent.click(screen.getByTestId('login-button'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Logged in successfully');
      expect(navigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('maintains login state', async () => {
    // Mock localStorage to simulate logged in state
    vi.spyOn((global as any).localStorage, 'getItem').mockImplementation((key: string) => {
      if (key === 'token') return 'mock-token';
      if (key === 'user') return JSON.stringify({ email: 'test@example.com' });
      if (key === 'isAuthenticated') return 'true';
      return null;
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/dashboard');
    });
  });
}); 