import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * Organization settings must come from GET /organizations/current, not the
 * /auth/me snapshot: that snapshot is cached server-side and is not invalidated
 * by PATCH /organizations/:id, so reading it showed the pre-save values after a
 * reload and the next Save silently reverted the change. And if the org cannot
 * be loaded, the form holds placeholder defaults that must never be saved.
 */

const mockGetCurrentUser = jest.fn();
const mockGetOrganization = jest.fn();
const mockUpdateOrganization = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
    getOrganization: (...args: any[]) => mockGetOrganization(...args),
    updateOrganization: (...args: any[]) => mockUpdateOrganization(...args),
    setAuthenticated: jest.fn(),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn(), replace: jest.fn() }),
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

// The cached /auth/me snapshot: the values BEFORE the last save.
const staleUser = {
  email: 'admin@example.com',
  firstName: 'Ada',
  lastName: 'Admin',
  organizationId: 'org-1',
  organization: {
    name: 'Old Name',
    country: 'US',
    settings: { defaultDuration: 30, timezone: 'America/New_York', notifications: true },
  },
};

// The source of truth: the values AFTER the last save.
const freshOrg = {
  id: 'org-1',
  name: 'New Name',
  country: 'IN',
  settings: { defaultDuration: 45, timezone: 'UTC', notifications: false },
};

const saveButton = () => screen.getByRole('button', { name: 'Save Changes' });

describe('Settings page organization load', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(staleUser);
    mockGetOrganization.mockResolvedValue(freshOrg);
    mockUpdateOrganization.mockResolvedValue(freshOrg);
  });

  it('shows organization values from getOrganization, not the stale /auth/me snapshot', async () => {
    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByDisplayValue('New Name')).toBeInTheDocument());
    expect(screen.queryByDisplayValue('Old Name')).not.toBeInTheDocument();
    expect((document.getElementById('settings-region') as HTMLSelectElement).value).toBe('IN');
    expect((document.getElementById('settings-timezone') as HTMLSelectElement).value).toBe('UTC');
    expect((document.getElementById('settings-default-duration') as HTMLInputElement).value).toBe('45');
    // User fields still come from the current user.
    expect(screen.getByDisplayValue('admin@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ada')).toBeInTheDocument();
  });

  it('saves the freshly loaded organization values', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(saveButton()).toBeEnabled());

    fireEvent.click(saveButton());

    await waitFor(() => expect(mockUpdateOrganization).toHaveBeenCalledTimes(1));
    expect(mockUpdateOrganization).toHaveBeenCalledWith('org-1', {
      name: 'New Name',
      country: 'IN',
      settings: { defaultDuration: 45, timezone: 'UTC', notifications: false },
    });
    expect(mockToast.success).toHaveBeenCalledWith('Settings saved successfully');
  });

  it('keeps Save disabled while the organization is still loading', async () => {
    mockGetOrganization.mockReturnValue(new Promise(() => {}));
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByDisplayValue('admin@example.com')).toBeInTheDocument());

    expect(saveButton()).toBeDisabled();
    fireEvent.click(saveButton());
    expect(mockUpdateOrganization).not.toHaveBeenCalled();
  });

  it('never saves placeholder defaults over real settings when the organization fails to load', async () => {
    mockGetOrganization.mockRejectedValue(new Error('Network error'));
    render(<SettingsPage />);

    const alert = await screen.findByText(/Couldn.t load your organization settings/);
    expect(alert).toHaveAttribute('role', 'alert');
    expect(saveButton()).toBeDisabled();
    expect(saveButton()).toHaveAttribute('aria-describedby', alert.id);

    fireEvent.click(saveButton());
    expect(mockUpdateOrganization).not.toHaveBeenCalled();

    // The profile section is independent and still loads from the user.
    expect(screen.getByDisplayValue('Ada')).toBeInTheDocument();
  });
});
