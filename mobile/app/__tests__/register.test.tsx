import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import RegisterScreen from '../(auth)/register';
import { api, ApiError } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';

// Mock the API client
jest.mock('../../src/api/client', () => {
  const actual = jest.requireActual('../../src/api/client');
  return {
    ...actual,
    api: {
      register: jest.fn(),
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

/**
 * Helper: get the "Create Account" button element (not the title).
 * The screen has both a title and a button with the same text.
 * The button text is the last element returned by getAllByText.
 */
function getSubmitButton(helpers: ReturnType<typeof render>) {
  const elements = helpers.getAllByText('Create Account');
  // The button text is the second occurrence (index 1)
  return elements[elements.length - 1];
}

/** Fill all form fields with valid data */
function fillValidForm(helpers: ReturnType<typeof render>) {
  const { getByPlaceholderText } = helpers;
  fireEvent.changeText(getByPlaceholderText('John'), 'Alice');
  fireEvent.changeText(getByPlaceholderText('Doe'), 'Smith');
  fireEvent.changeText(getByPlaceholderText('you@company.com'), 'alice@corp.com');
  fireEvent.changeText(getByPlaceholderText('Min. 8 characters'), 'StrongPass1!');
  fireEvent.changeText(getByPlaceholderText('Acme Corp'), 'Test Org');
}

describe('RegisterScreen', () => {
  it('renders all input fields and Create Account button', () => {
    const helpers = render(<RegisterScreen />);
    const { getByPlaceholderText, getAllByText } = helpers;

    expect(getByPlaceholderText('John')).toBeTruthy();
    expect(getByPlaceholderText('Doe')).toBeTruthy();
    expect(getByPlaceholderText('you@company.com')).toBeTruthy();
    expect(getByPlaceholderText('Min. 8 characters')).toBeTruthy();
    expect(getByPlaceholderText('Acme Corp')).toBeTruthy();
    // Title and button both say "Create Account"
    expect(getAllByText('Create Account').length).toBeGreaterThanOrEqual(1);
  });

  it('shows alert for empty first name', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const helpers = render(<RegisterScreen />);

    fireEvent.press(getSubmitButton(helpers));

    expect(alertSpy).toHaveBeenCalledWith('Error', 'First name is required.');
    expect((api.register as jest.Mock)).not.toHaveBeenCalled();
  });

  it('shows alert for empty last name', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const helpers = render(<RegisterScreen />);
    const { getByPlaceholderText } = helpers;

    fireEvent.changeText(getByPlaceholderText('John'), 'Alice');
    fireEvent.press(getSubmitButton(helpers));

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Last name is required.');
  });

  it('shows alert for invalid email', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const helpers = render(<RegisterScreen />);
    const { getByPlaceholderText } = helpers;

    fireEvent.changeText(getByPlaceholderText('John'), 'Alice');
    fireEvent.changeText(getByPlaceholderText('Doe'), 'Smith');
    fireEvent.changeText(getByPlaceholderText('you@company.com'), 'bad-email');
    fireEvent.press(getSubmitButton(helpers));

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter a valid email address.');
  });

  it('shows alert for weak password (missing uppercase)', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const helpers = render(<RegisterScreen />);
    const { getByPlaceholderText } = helpers;

    fireEvent.changeText(getByPlaceholderText('John'), 'Alice');
    fireEvent.changeText(getByPlaceholderText('Doe'), 'Smith');
    fireEvent.changeText(getByPlaceholderText('you@company.com'), 'alice@corp.com');
    fireEvent.changeText(getByPlaceholderText('Min. 8 characters'), 'alllower1');
    fireEvent.press(getSubmitButton(helpers));

    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      'Password must include uppercase, lowercase, and a number or special character.',
    );
  });

  it('shows alert for short org name (< 2 chars)', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const helpers = render(<RegisterScreen />);
    const { getByPlaceholderText } = helpers;

    fireEvent.changeText(getByPlaceholderText('John'), 'Alice');
    fireEvent.changeText(getByPlaceholderText('Doe'), 'Smith');
    fireEvent.changeText(getByPlaceholderText('you@company.com'), 'alice@corp.com');
    fireEvent.changeText(getByPlaceholderText('Min. 8 characters'), 'StrongPass1!');
    fireEvent.changeText(getByPlaceholderText('Acme Corp'), 'A');
    fireEvent.press(getSubmitButton(helpers));

    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      'Organization name must be at least 2 characters.',
    );
  });

  it('calls api.register and navigates on success', async () => {
    const mockUser = {
      id: '1',
      email: 'alice@corp.com',
      firstName: 'Alice',
      lastName: 'Smith',
      role: 'admin',
      organizationId: 'org-1',
    };
    (api.register as jest.Mock).mockResolvedValue({
      access_token: 'jwt-token-456',
      user: mockUser,
    });

    const helpers = render(<RegisterScreen />);
    fillValidForm(helpers);

    fireEvent.press(getSubmitButton(helpers));

    await waitFor(() => {
      expect(api.register).toHaveBeenCalledWith({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@corp.com',
        password: 'StrongPass1!',
        organizationName: 'Test Org',
      });
    });

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith('jwt-token-456', mockUser);
    });

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(main)/devices');
    });
  });

  it('shows alert on API failure with ApiError', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (api.register as jest.Mock).mockRejectedValue(
      new ApiError(409, 'Email already registered'),
    );

    const helpers = render(<RegisterScreen />);
    fillValidForm(helpers);

    fireEvent.press(getSubmitButton(helpers));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Registration Failed', 'Email already registered');
    });
  });

  it('shows generic network error for non-ApiError failures', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (api.register as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));

    const helpers = render(<RegisterScreen />);
    fillValidForm(helpers);

    fireEvent.press(getSubmitButton(helpers));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Registration Failed',
        'Could not connect to server.',
      );
    });
  });
});
