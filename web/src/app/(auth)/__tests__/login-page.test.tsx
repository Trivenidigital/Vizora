import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginContent from '../login-content';

jest.mock('@/lib/api', () => ({
  apiClient: {
    login: jest.fn(),
  },
}));

jest.mock('@/lib/validation', () => ({
  loginSchema: {
    parse: jest.fn(),
  },
}));

jest.mock('@/components/Button', () => {
  return function MockButton({ children, loading, ...props }: any) {
    return (
      <button {...props} disabled={loading}>
        {loading ? 'Loading...' : children}
      </button>
    );
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href }: any) {
    return <a href={href}>{children}</a>;
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form', () => {
    render(<LoginContent />);
    expect(screen.getByText('Login to Vizora')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders sign up link', () => {
    render(<LoginContent />);
    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<LoginContent />);
    expect(screen.getByLabelText('Log in to your account')).toBeInTheDocument();
  });

  it('updates email field on input', () => {
    render(<LoginContent />);
    const emailInput = screen.getByLabelText('Email address');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(emailInput).toHaveValue('test@example.com');
  });

  it('updates password field on input', () => {
    render(<LoginContent />);
    const passwordInput = screen.getByLabelText('Password');
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    expect(passwordInput).toHaveValue('password123');
  });

  it('shows error when login fails', async () => {
    const { apiClient } = require('@/lib/api');
    const { loginSchema } = require('@/lib/validation');
    loginSchema.parse.mockReturnValue(true);
    apiClient.login.mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginContent />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.submit(screen.getByLabelText('Log in to your account'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
