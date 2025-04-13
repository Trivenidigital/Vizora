import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../../Redesign/VizoraWeb/src/contexts/AuthContext';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import Login from '../../components/Login';
import ProtectedRoute from '../../components/ProtectedRoute';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock components that use the auth context
const LoginForm = () => {
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    await login(email, password);
  };

  return (
    <div>
      <h1>Login</h1>
      <form data-testid="login-form" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input 
          id="email"
          type="email" 
          name="email"
          placeholder="Email" 
          data-testid="email-input" 
        />
        <label htmlFor="password">Password</label>
        <input 
          id="password"
          type="password" 
          name="password"
          placeholder="Password" 
          data-testid="password-input" 
        />
        <button type="submit" data-testid="login-button">
          Login
        </button>
      </form>
    </div>
  );
};

const UserProfile = () => {
  const { user, logout } = useAuth();
  
  if (!user) return null;
  
  return (
    <div>
      <h1 data-testid="profile-heading">User Profile</h1>
      <p data-testid="user-email">{user.email}</p>
      <button onClick={logout} data-testid="logout-button">
        Logout
      </button>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <div data-testid="unauthorized">Please login to access this page</div>;
  }
  
  return children;
};

// Mock the auth service
vi.mock('../../../Redesign/VizoraWeb/src/services/authService', () => ({
  default: {
    login: vi.fn().mockImplementation((email, password) => {
      if (email === 'test@example.com' && password === 'password123') {
        return Promise.resolve({
          user: { id: '1', email, name: 'Test User' },
          token: 'fake-jwt-token'
        });
      }
      return Promise.reject(new Error('Invalid credentials'));
    }),
    logout: vi.fn().mockResolvedValue(true),
    getCurrentUser: vi.fn().mockReturnValue({ id: '1', email: 'test@example.com', name: 'Test User' }),
  }
}));

const renderWithRouter = (component: React.ReactNode) => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders login form correctly', () => {
    renderWithRouter(<Login />);
    
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-button')).toBeInTheDocument();
  });

  it('handles successful login', async () => {
    renderWithRouter(<Login />);
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles logout correctly', async () => {
    renderWithRouter(<Login />);
    
    // Login first
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    // Then logout
    const logoutButton = screen.getByTestId('logout-button');
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('prevents access to protected routes when not authenticated', () => {
    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
  });

  it('allows access to protected routes when authenticated', async () => {
    renderWithRouter(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );

    // Login first
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });
}); 