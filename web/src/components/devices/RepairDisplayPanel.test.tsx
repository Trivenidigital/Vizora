import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RepairDisplayPanel } from './RepairDisplayPanel';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/error-handler';

jest.mock('@/lib/api', () => ({
  apiClient: {
    repairDisplayPairing: jest.fn(),
  },
}));

let mockUser: { id: string; role: string } | null = {
  id: 'u1',
  role: 'admin',
};
let mockAuthLoading = false;

jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockAuthLoading,
    isAuthenticated: !!mockUser,
  }),
}));

// next/link → plain anchor for assertions
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

const repairDisplayPairing = apiClient.repairDisplayPairing as jest.Mock;

const okResponse = {
  success: true,
  display: {
    id: 'disp-1',
    nickname: 'Lobby Screen',
    deviceIdentifier: 'device-2026-2',
    status: 'pairing',
  },
};

/** Open the form and type a code. Does NOT fire the request. */
function enterCode(code: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Re-pair display' }));
  fireEvent.change(screen.getByLabelText('Pairing code'), {
    target: { value: code },
  });
}

/** Open the form, type a code, then pass the confirmation step. */
function submitCode(code: string) {
  enterCode(code);
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Re-pair display' }));
}

function renderPanel(props: Partial<Parameters<typeof RepairDisplayPanel>[0]> = {}) {
  return render(
    <RepairDisplayPanel displayId="disp-1" displayName="Lobby Screen" {...props} />,
  );
}

describe('RepairDisplayPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'u1', role: 'admin' };
    mockAuthLoading = false;
    repairDisplayPairing.mockResolvedValue(okResponse);
  });

  describe('role gating', () => {
    it.each(['admin', 'manager'])(
      'offers the action to %s, the roles the endpoint allows',
      (role) => {
        mockUser = { id: 'u1', role };
        renderPanel();
        expect(
          screen.getByRole('button', { name: 'Re-pair display' }),
        ).toBeInTheDocument();
      },
    );

    it.each(['viewer', 'unknown-role'])(
      'renders nothing at all for %s',
      (role) => {
        mockUser = { id: 'u1', role };
        const { container } = renderPanel();
        expect(container).toBeEmptyDOMElement();
      },
    );

    it('renders nothing while the session is still loading', () => {
      mockAuthLoading = true;
      const { container } = renderPanel();
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('client-side code validation', () => {
    it('keeps submit disabled until the code is 6 characters', () => {
      renderPanel();
      enterCode('AB1');

      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Pairing code'), {
        target: { value: 'AB123C' },
      });
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    });

    it('normalises the typed code to uppercase alphanumerics', () => {
      renderPanel();
      enterCode('ab-12c!d9');
      expect(screen.getByLabelText('Pairing code')).toHaveValue('AB12CD');
    });
  });

  describe('confirmation', () => {
    it('fires no request until the confirmation is accepted', async () => {
      renderPanel();
      enterCode('AB12CD');

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

      // Confirmation states plainly what happens, and nothing has been sent.
      const dialog = within(screen.getByRole('dialog'));
      expect(dialog.getByText('Re-pair Lobby Screen?')).toBeInTheDocument();
      expect(
        dialog.getByText(/keeps its name, playlist, schedules and history/),
      ).toBeInTheDocument();
      expect(
        dialog.getByText(/current credential is replaced/),
      ).toBeInTheDocument();
      expect(dialog.getByText(/stops working immediately/)).toBeInTheDocument();
      expect(repairDisplayPairing).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Re-pair display' }));

      await waitFor(() => expect(repairDisplayPairing).toHaveBeenCalled());
    });

    it('sends no request when the confirmation is cancelled', () => {
      renderPanel();
      enterCode('AB12CD');
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(repairDisplayPairing).not.toHaveBeenCalled();
    });

    it('posts the target display id and the entered code', async () => {
      renderPanel();
      submitCode('AB12CD');

      await waitFor(() =>
        expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD'),
      );
      expect(repairDisplayPairing).toHaveBeenCalledTimes(1);
    });
  });

  describe('server errors are surfaced faithfully', () => {
    const apiError = (status: number, message: string) =>
      new ApiError(status, message, 'GENERIC USER MESSAGE');

    it('404 — code not found or expired', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(404, 'Pairing code not found or expired'),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent('Pairing code not found or expired');
      expect(alert).toHaveTextContent(
        'restart pairing on the display to get a new one',
      );
      expect(alert).not.toHaveTextContent('GENERIC USER MESSAGE');
    });

    it('400 — code already completed', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(400, 'Pairing code has already been completed'),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent('That pairing code cannot be used');
      expect(alert).toHaveTextContent('Pairing code has already been completed');
      expect(alert).not.toHaveTextContent('GENERIC USER MESSAGE');
    });

    it('409 — another display holds the device identifier, and its id is linked', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(
          409,
          'Display disp-other already uses this device identifier. ' +
            'Remove or re-pair that display first, then restart pairing on this screen.',
        ),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent('Re-pair refused — conflict');
      expect(alert).toHaveTextContent(
        'Display disp-other already uses this device identifier',
      );
      expect(
        screen.getByRole('link', { name: 'Open display disp-other' }),
      ).toHaveAttribute('href', '/dashboard/devices/disp-other');
    });

    it('409 — a concurrent re-pair carries no display id, so none is invented', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(409, 'This display is already being re-paired. Please try again.'),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent(
        'This display is already being re-paired. Please try again.',
      );
      expect(alert).toHaveTextContent('Wait for it to finish');
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('403 — insufficient role', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(403, 'Insufficient permissions. Required roles: admin, manager'),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent('Your role cannot re-pair displays');
      expect(alert).toHaveTextContent(
        'Insufficient permissions. Required roles: admin, manager',
      );
      expect(alert).not.toHaveTextContent('GENERIC USER MESSAGE');
    });

    it('each error class renders a distinct headline', async () => {
      const headlines = new Set<string>();
      for (const [status, message] of [
        [404, 'Pairing code not found or expired'],
        [400, 'Pairing code has already been completed'],
        [409, 'Display disp-other already uses this device identifier.'],
        [403, 'Insufficient permissions. Required roles: admin, manager'],
      ] as [number, string][]) {
        repairDisplayPairing.mockRejectedValueOnce(apiError(status, message));
        const view = renderPanel();
        submitCode('AB12CD');
        const alert = await screen.findByRole('alert');
        headlines.add(alert.querySelector('p')?.textContent ?? '');
        view.unmount();
      }
      expect(headlines.size).toBe(4);
    });

    it('a transport failure is reported without inventing a server verdict', async () => {
      repairDisplayPairing.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent('Re-pairing failed');
      expect(alert).toHaveTextContent('Failed to fetch');
    });

    it('leaves the form open with the code intact so the operator can retry', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(404, 'Pairing code not found or expired'),
      );
      renderPanel();
      submitCode('AB12CD');

      await screen.findByRole('alert');
      expect(screen.getByLabelText('Pairing code')).toHaveValue('AB12CD');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('success', () => {
    it('shows a success state and refreshes the display', async () => {
      const onRepaired = jest.fn().mockResolvedValue(undefined);
      renderPanel({ onRepaired });
      submitCode('AB12CD');

      const status = await screen.findByRole('status');
      expect(status).toHaveTextContent('Display re-paired');
      expect(onRepaired).toHaveBeenCalledTimes(1);
      // Form closed, no error left over.
      expect(screen.queryByLabelText('Pairing code')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('reports a failed refresh as a refresh failure, not a failed re-pair', async () => {
      const onRepaired = jest.fn().mockRejectedValue(new Error('reload failed'));
      renderPanel({ onRepaired });
      submitCode('AB12CD');

      const status = await screen.findByRole('status');
      await waitFor(() =>
        expect(status).toHaveTextContent('This page could not be refreshed'),
      );
      expect(status).toHaveTextContent('Display re-paired');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('renders no credential material from the response', async () => {
      // The rebind response carries no credential — the server parks it for
      // the screen's own poller. Prove the panel would not leak one anyway.
      repairDisplayPairing.mockResolvedValueOnce({
        ...okResponse,
        jwtToken: 'eyJhbGciOiJIUzI1NiJ9.LEAKED-DEVICE-TOKEN',
        pairingToken: 'LEAKED-PAIRING-TOKEN',
      });
      renderPanel();
      submitCode('AB12CD');

      await screen.findByRole('status');
      expect(document.body.textContent).not.toContain('LEAKED-DEVICE-TOKEN');
      expect(document.body.textContent).not.toContain('LEAKED-PAIRING-TOKEN');
      expect(document.body.textContent).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(document.body.textContent).not.toContain('device-2026-2');
    });
  });
});
