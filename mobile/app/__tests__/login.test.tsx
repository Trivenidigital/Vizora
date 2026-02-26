import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import LoginScreen from '../(auth)/login';
import { api, ApiError } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';

// Mock the API client
jest.mock('../../src/api/client', () => {
  const actual = jest.requireActual('../../src/api/client');
  return {
    ...actual,
    api: {
      login: jest.fn(),
    },
  };
});

// Mock the auth store
const mockSetAuth = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/stores/auth', () => ({
  useAuthStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector({ setAuth: mockSetAuth }),
  ),
}));

// Let validation use real implementation (no mock)

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
});

describe('LoginScreen', () => {
  it('renders email input, password input, and Sign In button', () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    expect(getByPlaceholderText('you@company.com')).toBeTruthy();
    expect(getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('shows alert when email is empty', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<LoginScreen />);

    fireEvent.press(getByText('Sign In'));

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Email is required.');
    expect((api.login as jest.Mock)).not.toHaveBeenCalled();
  });

  it('shows alert when email format is invalid', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('you@company.com'), 'not-an-email');
    fireEvent.press(getByText('Sign In'));

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter a valid email address.');
    expect((api.login as jest.Mock)).not.toHaveBeenCalled();
  });

  it('shows alert when password is empty', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('you@company.com'), 'user@test.com');
    fireEvent.press(getByText('Sign In'));

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter your password.');
    expect((api.login as jest.Mock)).not.toHaveBeenCalled();
  });

  it('calls api.login and navigates on success', async () => {
    const mockUser = {
      id: '1',
      email: 'user@test.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'admin',
      organizationId: 'org-1',
    };
    (api.login as jest.Mock).mockResolvedValue({
      access_token: 'jwt-token-123',
      user: mockUser,
    });

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('you@company.com'), 'user@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'Password1!');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('user@test.com', 'Password1!');
    });

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith('jwt-token-123', mockUser);
    });

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(main)/devices');
    });
  });

  it('reads res.token when access_token is absent', async () => {
    const mockUser = {
      id: '2',
      email: 'user2@test.com',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'user',
      organizationId: 'org-2',
    };
    (api.login as jest.Mock).mockResolvedValue({
      token: 'fallback-token',
      user: mockUser,
    });

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('you@company.com'), 'user2@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'Password1!');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith('fallback-token', mockUser);
    });
  });

  it('shows alert with ApiError message on API failure', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (api.login as jest.Mock).mockRejectedValue(new ApiError(401, 'Invalid credentials'));

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('you@company.com'), 'user@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'Password1!');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Login Failed', 'Invalid credentials');
    });
  });

  it('shows generic network error message for non-ApiError failures', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (api.login as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('you@company.com'), 'user@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'Password1!');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Login Failed',
        'Could not connect to server. Check your network.',
      );
    });
  });

  it('sign up link navigates to register screen', () => {
    const { getByText } = render(<LoginScreen />);

    fireEvent.press(getByText(/Don't have an account/));

    expect(mockRouter.push).toHaveBeenCalledWith('/(auth)/register');
  });
});
