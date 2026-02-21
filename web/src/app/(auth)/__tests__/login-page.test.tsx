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
    expect(screen.getByRole('heading', { name: 'Log in to Vizora' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders sign up link', () => {
    render(<LoginContent />);
    expect(screen.getByText('Sign up free')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<LoginContent />);
    expect(screen.getByText('Log in', { selector: 'button' })).toBeInTheDocument();
  });

  it('updates email field on input', () => {
    render(<LoginContent />);
    const emailInput = screen.getByLabelText('Email');
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
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.submit(screen.getByText('Log in', { selector: 'button' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password. Please try again.')).toBeInTheDocument();
    });
  });

  it('renders forgot password link', () => {
    render(<LoginContent />);
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });
});
