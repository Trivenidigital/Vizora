import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockGetAlertRules = jest.fn();
const mockCreateAlertRule = jest.fn();
const mockUpdateAlertRule = jest.fn();
const mockDeleteAlertRule = jest.fn();
const mockAddRecipient = jest.fn();
const mockRemoveRecipient = jest.fn();
const mockGetDisplays = jest.fn();
const mockGetDisplayGroups = jest.fn();
const mockGetUsers = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getAlertRules: (...a: any[]) => mockGetAlertRules(...a),
    createAlertRule: (...a: any[]) => mockCreateAlertRule(...a),
    updateAlertRule: (...a: any[]) => mockUpdateAlertRule(...a),
    deleteAlertRule: (...a: any[]) => mockDeleteAlertRule(...a),
    addAlertRuleRecipient: (...a: any[]) => mockAddRecipient(...a),
    removeAlertRuleRecipient: (...a: any[]) => mockRemoveRecipient(...a),
    getDisplays: (...a: any[]) => mockGetDisplays(...a),
    getDisplayGroups: (...a: any[]) => mockGetDisplayGroups(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
  },
}));

const mockUseAuth = jest.fn();
jest.mock('@/lib/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), ToastContainer: () => null }),
}));

import AlertsPage from '../page';

const sampleRule = {
  id: 'rule-1',
  organizationId: 'org-1',
  name: 'Lobby offline',
  triggerEvent: 'device.offline',
  isActive: true,
  scope: 'all',
  scopeTagId: null,
  scopeGroupId: null,
  scopeDisplayId: null,
  minOfflineSec: 120,
  recipients: [
    { id: 'rec-1', alertRuleId: 'rule-1', channel: 'email', target: 'ops@example.com', createdAt: '' },
  ],
  createdAt: '',
  updatedAt: '',
};

describe('AlertsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { role: 'admin' } });
    mockGetAlertRules.mockResolvedValue([sampleRule]);
    mockGetDisplays.mockResolvedValue({ data: [] });
    mockGetDisplayGroups.mockResolvedValue({ data: [] });
    mockGetUsers.mockResolvedValue({ data: [] });
  });

  it('loads and renders existing alert rules', async () => {
    render(<AlertsPage />);
    await waitFor(() => expect(screen.getByText('Lobby offline')).toBeInTheDocument());
    expect(mockGetAlertRules).toHaveBeenCalled();
    expect(screen.getByText('1 Email')).toBeInTheDocument();
  });

  it('shows admin-only warning and hides create for non-admins', async () => {
    mockUseAuth.mockReturnValue({ user: { role: 'viewer' } });
    render(<AlertsPage />);
    await waitFor(() => expect(screen.getByText(/only administrators/i)).toBeInTheDocument());
    expect(screen.queryByText('New Alert Rule')).not.toBeInTheDocument();
  });

  it('renders an empty state when there are no rules', async () => {
    mockGetAlertRules.mockResolvedValue([]);
    render(<AlertsPage />);
    await waitFor(() => expect(screen.getByText('No alert rules')).toBeInTheDocument());
  });

  it('opens the create modal for admins', async () => {
    render(<AlertsPage />);
    await waitFor(() => expect(screen.getByText('Lobby offline')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New Alert Rule'));
    expect(screen.getByText('Rule Name')).toBeInTheDocument();
    expect(screen.getByText('Create Rule')).toBeInTheDocument();
  });

  it('toggles a rule active state via updateAlertRule', async () => {
    mockUpdateAlertRule.mockResolvedValue({ ...sampleRule, isActive: false });
    render(<AlertsPage />);
    await waitFor(() => expect(screen.getByText('Lobby offline')).toBeInTheDocument());
    const toggle = screen.getByRole('switch', { name: /toggle lobby offline/i });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(mockUpdateAlertRule).toHaveBeenCalledWith('rule-1', { isActive: false }),
    );
  });

  it('deletes a rule after confirmation', async () => {
    mockDeleteAlertRule.mockResolvedValue(undefined);
    render(<AlertsPage />);
    await waitFor(() => expect(screen.getByText('Lobby offline')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Delete Rule'));
    await waitFor(() => expect(mockDeleteAlertRule).toHaveBeenCalledWith('rule-1'));
  });

  describe('rule dialog submits on Enter', () => {
    const NAME_PLACEHOLDER = 'e.g. Lobby screens offline';

    const openEdit = async () => {
      render(<AlertsPage />);
      await waitFor(() => expect(screen.getByText('Lobby offline')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Edit'));
      expect(screen.getByText('Edit Alert Rule')).toBeInTheDocument();
    };

    it('saves the rule when Enter is pressed in the rule name field', async () => {
      mockUpdateAlertRule.mockResolvedValue({ ...sampleRule, name: 'Lobby screens down' });
      const user = userEvent.setup();
      await openEdit();

      const name = screen.getByPlaceholderText(NAME_PLACEHOLDER);
      await user.clear(name);
      await user.type(name, 'Lobby screens down{Enter}');

      await waitFor(() => {
        expect(mockUpdateAlertRule).toHaveBeenCalledWith(
          'rule-1',
          expect.objectContaining({ name: 'Lobby screens down' }),
        );
      });
      expect(mockUpdateAlertRule).toHaveBeenCalledTimes(1);
    });

    it('does not save when submitted with an empty rule name', async () => {
      await openEdit();

      const name = screen.getByPlaceholderText(NAME_PLACEHOLDER);
      fireEvent.change(name, { target: { value: '  ' } });
      fireEvent.submit(name.closest('form')!);

      expect(mockUpdateAlertRule).not.toHaveBeenCalled();
    });

    it('adds the recipient, and does not save the rule, on Enter in the new-recipient field', async () => {
      mockAddRecipient.mockResolvedValue({
        id: 'rec-2',
        alertRuleId: 'rule-1',
        channel: 'email',
        target: 'oncall@example.com',
        createdAt: '',
      });
      const user = userEvent.setup();
      await openEdit();

      // The add-recipient row is the only channel select still on its default.
      fireEvent.change(screen.getByDisplayValue('In-app notification'), { target: { value: 'email' } });
      await user.type(screen.getByPlaceholderText('alerts@example.com'), 'oncall@example.com{Enter}');

      await waitFor(() => {
        expect(mockAddRecipient).toHaveBeenCalledWith('rule-1', {
          channel: 'email',
          target: 'oncall@example.com',
        });
      });
      expect(mockUpdateAlertRule).not.toHaveBeenCalled();
    });

    it('does nothing on Enter in an empty new-recipient field', async () => {
      const user = userEvent.setup();
      await openEdit();

      fireEvent.change(screen.getByDisplayValue('In-app notification'), { target: { value: 'email' } });
      await user.type(screen.getByPlaceholderText('alerts@example.com'), '{Enter}');

      expect(mockAddRecipient).not.toHaveBeenCalled();
      expect(mockUpdateAlertRule).not.toHaveBeenCalled();
    });
  });
});
