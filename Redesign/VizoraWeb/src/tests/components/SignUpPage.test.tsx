import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SignUpPage } from '../../pages/auth/SignUpPage';
import { authService } from '../../services/authService';
import { useNavigate } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock authService
vi.mock('../../services/authService', () => ({
  authService: {
    register: vi.fn(),
  },
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SignUpPage', () => {
  const fillForm = () => {
    fireEvent.change(screen.getByPlaceholderText(/first name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByPlaceholderText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/email address/i), { target: { value: 'john.doe@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/company name/i), { target: { value: 'Test Company' } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'Test123!@#' } });
    fireEvent.change(screen.getByPlaceholderText(/confirm password/i), { target: { value: 'Test123!@#' } });
    fireEvent.click(screen.getByRole('checkbox'));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    render(<SignUpPage />);
  });

  it('renders sign up form', () => {
    expect(screen.getByText(/create an account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/first name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/last name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/company name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/company name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      expect(screen.getByText(/terms must be accepted/i)).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    fireEvent.change(screen.getByPlaceholderText(/email address/i), { target: { value: 'invalid-email' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });

  it('validates password match', async () => {
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'Test123!@#' } });
    fireEvent.change(screen.getByPlaceholderText(/confirm password/i), { target: { value: 'Different123!@#' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockNavigate = vi.fn();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (authService.register as jest.Mock).mockResolvedValueOnce({
      token: 'mock-token',
      user: { id: 1, email: 'john.doe@example.com' }
    });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        companyName: 'Test Company',
        password: 'Test123!@#'
      });
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles registration error', async () => {
    (authService.register as jest.Mock).mockRejectedValueOnce(new Error('Registration failed'));

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
    });
  });

  it('prevents form submission while already submitting', async () => {
    const mockNavigate = vi.fn();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (authService.register as jest.Mock).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    fireEvent.click(screen.getByRole('button', { name: /creating account/i }));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledTimes(1);
    });
  });
});