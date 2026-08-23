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

  /**
   * Copy is selected from `statusCode` + the published `code`, never from the
   * server's message text — and no server text is rendered at all, apart from
   * the id-shape-validated `conflictingDisplayId`.
   */
  describe('errors are rendered from the contract, not from server text', () => {
    /** Mirrors `buildApiError`: `code` lifted from the body, body kept as details. */
    const apiError = (
      status: number,
      body: Record<string, unknown> & { message: string },
    ) =>
      new ApiError(
        status,
        body.message,
        'GENERIC USER MESSAGE',
        typeof body.code === 'string' ? body.code : undefined,
        body,
      );

    it('404 — code not found or expired', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(404, { message: 'Pairing code not found or expired' }),
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

    it('400 — the code can no longer be used', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(400, { message: 'Pairing code has already been completed' }),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent('That pairing code cannot be used');
      expect(alert).toHaveTextContent('Restart pairing on the display');
      expect(alert).not.toHaveTextContent('GENERIC USER MESSAGE');
    });

    it('403 — insufficient role', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(403, {
          message: 'Insufficient permissions. Required roles: admin, manager',
        }),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent('Your role cannot re-pair displays');
      expect(alert).toHaveTextContent('limited to admins and managers');
      expect(alert).not.toHaveTextContent('GENERIC USER MESSAGE');
    });

    it('409 DEVICE_IDENTIFIER_IN_USE — the link is built from the structured field', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(409, {
          code: 'DEVICE_IDENTIFIER_IN_USE',
          conflictingDisplayId: 'display-ghost',
          message: 'Display display-ghost already uses this device identifier.',
        }),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent(
        'Another display is already using that screen',
      );
      expect(
        screen.getByRole('link', { name: 'Open display display-ghost' }),
      ).toHaveAttribute('href', '/dashboard/devices/display-ghost');
    });

    it('409 DEVICE_IDENTIFIER_IN_USE — a prose-only body renders safely with no link', async () => {
      // The id lives ONLY in the sentence. Nothing parses prose any more, so
      // there is no link — and nothing crashes.
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(409, {
          code: 'DEVICE_IDENTIFIER_IN_USE',
          message: 'Display display-ghost already uses this device identifier.',
        }),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent(
        'Another display is already using that screen',
      );
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(document.body.textContent).not.toContain('display-ghost');
    });

    it('409 — a malformed conflictingDisplayId is dropped, not linked', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(409, {
          code: 'DEVICE_IDENTIFIER_IN_USE',
          conflictingDisplayId: '../../admin?x=<script>alert(1)</script>',
          message: 'Conflict',
        }),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(alert.innerHTML).not.toContain('<script>');
      expect(document.body.textContent).not.toContain('/admin');
    });

    it.each([
      ['DISPLAY_REBIND_IN_PROGRESS', 'This display is already being re-paired'],
      ['ORG_PAIRING_IN_PROGRESS', 'Another pairing is in progress'],
      [
        'DEVICE_IDENTIFIER_TAKEN_DURING_REBIND',
        'Another display claimed that screen first',
      ],
    ])('409 %s renders its own curated copy and no link', async (code, headline) => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(409, { code, message: 'server prose that must not render' }),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent(headline);
      expect(alert).not.toHaveTextContent('server prose that must not render');
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('409 with an unrecognised code falls back to the generic conflict', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(409, {
          code: 'SOME_FUTURE_CODE',
          message: 'server prose that must not render',
        }),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent('Re-pair refused — conflict');
      expect(alert).not.toHaveTextContent('server prose that must not render');
    });

    it('each error class renders a distinct headline', async () => {
      const headlines = new Set<string>();
      const cases: [number, Record<string, unknown> & { message: string }][] = [
        [404, { message: 'Pairing code not found or expired' }],
        [400, { message: 'Pairing code has already been completed' }],
        [403, { message: 'Insufficient permissions.' }],
        [
          409,
          {
            code: 'DEVICE_IDENTIFIER_IN_USE',
            conflictingDisplayId: 'display-ghost',
            message: 'Display display-ghost already uses this device identifier.',
          },
        ],
        [500, { message: 'Internal server error' }],
      ];
      for (const [status, body] of cases) {
        repairDisplayPairing.mockRejectedValueOnce(apiError(status, body));
        const view = renderPanel();
        submitCode('AB12CD');
        const alert = await screen.findByRole('alert');
        headlines.add(alert.querySelector('p')?.textContent ?? '');
        view.unmount();
      }
      expect(headlines.size).toBe(cases.length);
    });

    it('leaves the form open with the code intact so the operator can retry', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        apiError(404, { message: 'Pairing code not found or expired' }),
      );
      renderPanel();
      submitCode('AB12CD');

      await screen.findByRole('alert');
      expect(screen.getByLabelText('Pairing code')).toHaveValue('AB12CD');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  /**
   * `AllExceptionsFilter` already flattens a non-HttpException body to
   * 'Internal server error' outside NODE_ENV=development, so none of this
   * should reach a prod client. These pin the second lock: the UI has no path
   * that would render it if it ever did.
   */
  describe('internal detail never reaches the DOM', () => {
    const leaky = (status: number, message: string, extra: Record<string, unknown> = {}) =>
      new ApiError(status, message, message, undefined, { message, ...extra });

    it.each([
      [
        'a stack trace',
        'TypeError: x is not a function\n    at PairingService.completePairing (/opt/vizora/app/middleware/dist/pairing.service.js:812:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)',
        ['pairing.service.js', 'processTicksAndRejections', '/opt/vizora/app'],
      ],
      [
        'a SQL error',
        'PrismaClientKnownRequestError: Invalid `prisma.display.updateMany()` invocation: Unique constraint failed on the fields: (`deviceIdentifier`) — SELECT * FROM "displays" WHERE "organizationId" = $1',
        ['SELECT * FROM', 'prisma.display.updateMany', 'deviceIdentifier'],
      ],
      [
        'a Redis error',
        'ReplyError: NOAUTH Authentication required. redis://:s3cr3t@10.0.0.4:6379/0',
        ['NOAUTH', 'redis://', 's3cr3t'],
      ],
      [
        'an arbitrary internal exception string',
        'Failed to finalize pairing token handoff for code 49GXDB with secret JWT_SECRET=hunter2',
        ['JWT_SECRET', 'hunter2', '49GXDB'],
      ],
    ])('%s in a 500 body is not rendered', async (_label, message, fragments) => {
      repairDisplayPairing.mockRejectedValueOnce(leaky(500, message));
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent('Re-pairing failed');
      for (const fragment of fragments) {
        expect(document.body.textContent).not.toContain(fragment);
      }
    });

    it('the same leak inside a recognised 4xx is not rendered either', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        leaky(400, 'ReplyError: NOAUTH redis://:s3cr3t@10.0.0.4:6379/0'),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent('That pairing code cannot be used');
      expect(document.body.textContent).not.toContain('s3cr3t');
    });

    it('HTML in an error body never becomes markup', async () => {
      // React escapes by default; pinned so a future dangerouslySetInnerHTML
      // on this surface fails here rather than in production.
      repairDisplayPairing.mockRejectedValueOnce(
        leaky(
          409,
          '<img src=x onerror="alert(1)"><script>alert(2)</script>',
          { code: '<script>alert(3)</script>' },
        ),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert.innerHTML).not.toContain('<script');
      expect(alert.innerHTML).not.toContain('onerror');
      expect(document.querySelector('script')).toBeNull();
      expect(document.body.textContent).not.toContain('alert(');
    });

    it('a transport failure reports a generic outcome, not the thrown message', async () => {
      repairDisplayPairing.mockRejectedValueOnce(
        new TypeError('Failed to fetch http://10.0.0.4:3000/api/v1'),
      );
      renderPanel();
      submitCode('AB12CD');

      const alert = await screen.findByRole('alert');
      expect(repairDisplayPairing).toHaveBeenCalledWith('disp-1', 'AB12CD');
      expect(alert).toHaveTextContent('Re-pairing failed');
      expect(document.body.textContent).not.toContain('10.0.0.4');
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
