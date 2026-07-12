import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginContent from '../login-content';

jest.mock('@/lib/api', () => ({
  apiClient: {
    login: jest.fn(),
    mfaChallenge: jest.fn(),
    mfaEnroll: jest.fn(),
    mfaEnable: jest.fn(),
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

  it('shows the MFA challenge step when login returns mfaRequired', async () => {
    const { apiClient } = require('@/lib/api');
    const { loginSchema } = require('@/lib/validation');
    loginSchema.parse.mockReturnValue(true);
    apiClient.login.mockResolvedValue({ mfaRequired: true, challengeToken: 'ct-123' });

    render(<LoginContent />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'mfa@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByText('Log in', { selector: 'button' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Two-factor authentication/i }),
      ).toBeInTheDocument();
    });
    // The password form is gone; a code input is shown instead.
    expect(screen.getByLabelText(/Authentication code/i)).toBeInTheDocument();
  });

  it('shows the forced-enrollment step when login returns mfaEnrollmentRequired', async () => {
    const { apiClient } = require('@/lib/api');
    const { loginSchema } = require('@/lib/validation');
    loginSchema.parse.mockReturnValue(true);
    apiClient.login.mockResolvedValue({ mfaEnrollmentRequired: true, enrollmentToken: 'et-123' });
    apiClient.mfaEnroll.mockResolvedValue({
      otpauthUrl: 'otpauth://totp/Vizora:u@e.com?secret=ABCDEF&issuer=Vizora',
      qrDataUrl: 'data:image/png;base64,AAAA',
    });

    render(<LoginContent />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'force@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByText('Log in', { selector: 'button' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Two-factor authentication required/i }),
      ).toBeInTheDocument();
    });
    // The enrollment token was used to fetch the QR.
    await waitFor(() => expect(apiClient.mfaEnroll).toHaveBeenCalledWith('et-123'));
  });
});
