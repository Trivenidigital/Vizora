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
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Organization Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
  });

  it('renders login link', () => {
    render(<RegisterContent />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<RegisterContent />);
    expect(screen.getByText('Create Account', { selector: 'button' })).toBeInTheDocument();
  });

  it('fills form fields', () => {
    render(<RegisterContent />);
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'john@test.com' } });
    expect(screen.getByLabelText('First Name')).toHaveValue('John');
    expect(screen.getByLabelText('Last Name')).toHaveValue('Doe');
    expect(screen.getByLabelText('Email address')).toHaveValue('john@test.com');
  });

  it('shows error when registration fails', async () => {
    const { apiClient } = require('@/lib/api');
    const { registerSchema } = require('@/lib/validation');
    registerSchema.parse.mockReturnValue(true);
    apiClient.register.mockRejectedValue(new Error('Email already exists'));

    render(<RegisterContent />);
    fireEvent.submit(screen.getByText('Create Account', { selector: 'button' }));

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });
  });

  it('shows password requirements text', () => {
    render(<RegisterContent />);
    expect(screen.getByText(/Must be 8\+ characters/)).toBeInTheDocument();
  });
});
