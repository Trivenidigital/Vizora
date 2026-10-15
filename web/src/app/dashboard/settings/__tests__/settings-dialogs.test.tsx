import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The Change Password and Delete Account dialogs are forms: Enter in a field
 * submits them, under the same guard as the (disabled) primary button. These
 * render the REAL Modal — most page suites mock it, which is how a focus bug
 * that made modal fields untypeable went unnoticed.
 */

const mockChangePassword = jest.fn();
const mockDeleteAccount = jest.fn();
const mockPush = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getCurrentUser: jest.fn(() =>
      Promise.resolve({
        email: 'admin@example.com',
        firstName: 'Ada',
        lastName: 'Admin',
        organizationId: 'org-1',
        organization: { name: 'Acme', country: 'US', settings: {} },
      }),
    ),
    getOrganization: jest.fn(() =>
      Promise.resolve({ id: 'org-1', name: 'Acme', country: 'US', settings: {} }),
    ),
    changePassword: (...args: any[]) => mockChangePassword(...args),
    deleteAccount: (...args: any[]) => mockDeleteAccount(...args),
    setAuthenticated: jest.fn(),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn(), replace: jest.fn() }),
}));

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  ToastContainer: () => null,
};
jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/components/providers/CustomizationProvider', () => ({
  useCustomization: () => ({ brandConfig: null, updateBrandConfig: jest.fn(), organizationId: 'org-1' }),
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

import SettingsPage from '../page';

async function openDialog(trigger: string) {
  render(<SettingsPage />);
  await waitFor(() => expect(screen.getByDisplayValue('admin@example.com')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: new RegExp(trigger) }));
  return screen.getByRole('dialog');
}

describe('Settings dialogs submit on Enter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChangePassword.mockResolvedValue({});
    mockDeleteAccount.mockResolvedValue({});
  });

  it('changes the password when Enter is pressed in the confirm field', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog('Change Password');
    const [current, next, confirm] = Array.from(
      dialog.querySelectorAll<HTMLInputElement>('input[type="password"]'),
    );

    await user.type(current, 'old-password');
    await user.type(next, 'new-password-1');
    await user.type(confirm, 'new-password-1{Enter}');

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: 'old-password',
        newPassword: 'new-password-1',
      });
    });
    expect(mockChangePassword).toHaveBeenCalledTimes(1);
  });

  it('does not change the password, or toast, when submitted with a field empty', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog('Change Password');
    const [current, next] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="password"]'));

    await user.type(current, 'old-password');
    await user.type(next, 'new-password-1{Enter}');
    fireEvent.submit(next.closest('form')!);

    expect(mockChangePassword).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('does not delete the account on Enter until the confirmation phrase is typed exactly', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog('Delete Account');
    const phrase = within(dialog).getByPlaceholderText('DELETE MY ACCOUNT');
    const password = within(dialog).getByPlaceholderText('Enter your password');

    await user.type(phrase, 'delete my account');
    await user.type(password, 'secret{Enter}');
    fireEvent.submit(password.closest('form')!);

    expect(mockDeleteAccount).not.toHaveBeenCalled();

    await user.clear(phrase);
    await user.type(phrase, 'DELETE MY ACCOUNT');
    await user.type(password, '{Enter}');

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith({
        password: 'secret',
        confirmation: 'DELETE MY ACCOUNT',
      });
    });
  });
});
