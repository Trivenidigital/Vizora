import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterContent from '../register-content';

jest.mock('@/lib/api', () => ({
  apiClient: {
    register: jest.fn(),
  },
}));

jest.mock('@/lib/validation', () => ({
  registerSchema: {
    parse: jest.fn(),
  },
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href }: any) {
    return <a href={href}>{children}</a>;
  };
});

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders registration form', () => {
    render(<RegisterContent />);
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Organization Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Work Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
  });

  it('renders login link', () => {
    render(<RegisterContent />);
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<RegisterContent />);
    expect(screen.getByText('Create Account', { selector: 'button' })).toBeInTheDocument();
  });

  it('fills form fields', () => {
    render(<RegisterContent />);
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'john@test.com' } });
    expect(screen.getByLabelText('First Name')).toHaveValue('John');
    expect(screen.getByLabelText('Last Name')).toHaveValue('Doe');
    expect(screen.getByLabelText('Work Email')).toHaveValue('john@test.com');
  });

  it('shows error when registration fails', async () => {
    const { apiClient } = require('@/lib/api');
    const { registerSchema } = require('@/lib/validation');
    registerSchema.parse.mockReturnValue(true);
    apiClient.register.mockRejectedValue(new Error('Email already exists'));

    render(<RegisterContent />);

    // Fill all fields so button is enabled
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Organization Name'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'john@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Pass1234' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Pass1234' } });
    fireEvent.submit(screen.getByText('Create Account', { selector: 'button' }));

    await waitFor(() => {
      expect(screen.getByText('An account with this email already exists.')).toBeInTheDocument();
    });
  });

  it('shows password checklist when password has content', () => {
    render(<RegisterContent />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'A' } });
    expect(screen.getByText('8+ characters')).toBeInTheDocument();
    expect(screen.getByText('Uppercase letter')).toBeInTheDocument();
    expect(screen.getByText('Lowercase letter')).toBeInTheDocument();
    expect(screen.getByText('Number or special char')).toBeInTheDocument();
  });

  it('shows trust signals', () => {
    render(<RegisterContent />);
    expect(screen.getByText('256-bit encrypted')).toBeInTheDocument();
    expect(screen.getByText('Free 30-day trial')).toBeInTheDocument();
    expect(screen.getByText('5 screens included')).toBeInTheDocument();
  });
});
