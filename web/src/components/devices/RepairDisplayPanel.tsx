'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/lib/error-handler';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDashboardPermissions } from '@/lib/permissions';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Icon } from '@/theme/icons';

const PAIRING_CODE_LENGTH = 6;

interface RepairDisplayPanelProps {
  displayId: string;
  displayName?: string | null;
  /**
   * Re-read the row after a successful rebind so the operator sees the
   * rebound display. May reject; a refresh failure is reported as a refresh
   * failure and never as a re-pair failure.
   */
  onRepaired?: () => void | Promise<void>;
}

export interface RepairFailure {
  /** Names the class of failure. */
  title: string;
  /** The server's own words. Never rewritten, never genericised. */
  detail: string;
  /** What to do next about THIS class of failure. */
  hint: string;
  /** Same-org display already holding the device identifier (409 only). */
  conflictingDisplayId?: string;
}

/**
 * The 409 the server raises from `assertDeviceIdentifierFree` names the row
 * that already holds the identifier, because the remedy is to deal with that
 * display first. Pull the id back out so it can be linked rather than left
 * buried in prose. The other 409 (a concurrent re-pair of this same display)
 * carries no id and correctly yields undefined.
 */
function parseConflictingDisplayId(message: string): string | undefined {
  return /^Display (\S+) already uses/.exec(message)?.[1];
}

/**
 * Map a failed re-pair onto the outcomes the server actually distinguishes.
 *
 * The server's message is always shown verbatim in `detail` — the generic
 * per-status text `ApiError.userMessage` carries ("Invalid request. Please
 * check your input.") throws away the only information the operator needs.
 *
 * 404 is deliberately ambiguous at the source: an unknown code, an expired
 * code and a target display in ANOTHER org all answer identically so a rebind
 * cannot be used to probe for display ids. Do not try to tell them apart here.
 */
export function describeRepairFailure(error: unknown): RepairFailure {
  if (isApiError(error)) {
    switch (error.statusCode) {
      case 404:
        return {
          title: 'Pairing code not found or expired',
          detail: error.message,
          hint: 'Check the code on the screen. Codes expire — restart pairing on the display to get a new one.',
        };
      case 400:
        return {
          title: 'That pairing code cannot be used',
          detail: error.message,
          hint: 'Restart pairing on the display to get a fresh code, then try again.',
        };
      case 409: {
        const conflictingDisplayId = parseConflictingDisplayId(error.message);
        return {
          title: 'Re-pair refused — conflict',
          detail: error.message,
          hint: conflictingDisplayId
            ? 'Open that display and remove or re-pair it first, then restart pairing on this screen.'
            : 'Another re-pair of this display is still in flight. Wait for it to finish, then try again.',
          conflictingDisplayId,
        };
      }
      case 403:
        return {
          title: 'Your role cannot re-pair displays',
          detail: error.message,
          hint: 'Ask an admin or a manager to re-pair this display.',
        };
      default:
        return {
          title: 'Re-pairing failed',
          detail: error.message,
          hint: 'Reload this page to check the display before retrying.',
        };
    }
  }

  return {
    title: 'Re-pairing failed',
    detail: error instanceof Error ? error.message : 'An unexpected error occurred.',
    hint: 'Reload this page to check the display before retrying.',
  };
}

/**
 * Re-pair an EXISTING display onto the screen currently showing a pairing
 * code. Posts `targetDisplayId` to `POST /devices/pairing/complete`, which
 * rebinds rather than creating a row: the display keeps its id, playlist,
 * schedules, groups, tags, history and quota slot, and only the fields
 * describing the physical client are replaced.
 *
 * The replacement credential is never returned to this caller and is never
 * rendered, logged or stored here. Keep it that way.
 */
export function RepairDisplayPanel({
  displayId,
  displayName,
  onRepaired,
}: RepairDisplayPanelProps) {
  const { user, loading: authLoading } = useAuth();
  const permissions = getDashboardPermissions(user);

  const [formOpen, setFormOpen] = useState(false);
  const [code, setCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<RepairFailure | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);

  // `POST /devices/pairing/complete` is @Roles('admin','manager'). Showing the
  // affordance to anyone else only produces a 403 they cannot act on.
  if (authLoading || !permissions.canPairDevices) return null;

  const label = displayName?.trim() || 'this display';
  const codeIsComplete = code.length === PAIRING_CODE_LENGTH;

  const openForm = () => {
    setFormOpen(true);
    setFailure(null);
    setSucceeded(false);
    setRefreshFailed(false);
  };

  const closeForm = () => {
    setFormOpen(false);
    setCode('');
    setFailure(null);
  };

  const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCode(
      event.target.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, PAIRING_CODE_LENGTH),
    );
  };

  const repair = async () => {
    setSubmitting(true);
    setFailure(null);

    try {
      // The response is discarded on purpose — it carries no credential, and
      // nothing in it belongs on screen. The refreshed row is the source of
      // truth for what the operator sees next.
      await apiClient.repairDisplayPairing(displayId, code);
    } catch (error) {
      setFailure(describeRepairFailure(error));
      return;
    } finally {
      setSubmitting(false);
    }

    setSucceeded(true);
    setFormOpen(false);
    setCode('');

    try {
      await onRepaired?.();
    } catch {
      // The rebind already committed; only the re-read failed. Say so rather
      // than swallowing it or reporting a successful re-pair as a failure.
      setRefreshFailed(true);
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Re-pair Display
        </h2>
      </div>
      <div className="px-6 py-4 space-y-4">
        <p className="text-sm text-[var(--foreground-secondary)]">
          Bind this display to the screen that is showing a pairing code right
          now. Use it when the paired device was replaced, reset, or lost its
          credential. The display keeps its name, playlist, schedules and
          history — only the screen behind it changes.
        </p>

        {succeeded && (
          <div
            role="status"
            className="rounded-lg border border-success-500/30 bg-success-500/10 px-4 py-3 space-y-1"
          >
            <p className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
              <Icon name="success" size="md" className="text-success-600" />
              Display re-paired
            </p>
            <p className="text-sm text-[var(--foreground-secondary)]">
              The screen showing that code is now bound to this display. Its
              playlist, schedules and history are unchanged, and the device
              paired to it before has stopped working.
            </p>
            {refreshFailed && (
              <p className="text-sm text-[var(--foreground-secondary)]">
                This page could not be refreshed afterwards — reload it to see
                the current state of the display.
              </p>
            )}
          </div>
        )}

        {failure && (
          <div
            role="alert"
            className="rounded-lg border border-error-500/30 bg-error-500/10 px-4 py-3 space-y-1"
          >
            <p className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
              <Icon name="warning" size="md" className="text-error-600" />
              {failure.title}
            </p>
            <p className="text-sm text-[var(--foreground-secondary)]">
              {failure.detail}
            </p>
            {failure.conflictingDisplayId && (
              <p className="text-sm">
                <Link
                  href={`/dashboard/devices/${failure.conflictingDisplayId}`}
                  className="text-[#00E5A0] hover:text-[#00CC8E] transition font-medium"
                >
                  Open display {failure.conflictingDisplayId}
                </Link>
              </p>
            )}
            <p className="text-sm text-[var(--foreground-secondary)]">
              {failure.hint}
            </p>
          </div>
        )}

        {!formOpen ? (
          <button
            type="button"
            onClick={openForm}
            className="px-4 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
          >
            Re-pair display
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="repair-pairing-code"
                className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2"
              >
                Pairing code
              </label>
              <input
                id="repair-pairing-code"
                type="text"
                value={code}
                onChange={handleCodeChange}
                className="eh-input text-center text-2xl font-bold tracking-widest uppercase"
                placeholder="ABC123"
                maxLength={PAIRING_CODE_LENGTH}
                autoComplete="off"
                autoFocus
              />
              <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
                Enter the 6-character code currently shown on the screen you
                want to bind to {label}.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={!codeIsComplete || submitting}
                className="eh-btn-danger px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Re-pairing…' : 'Continue'}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirming}
        title={`Re-pair ${label}?`}
        message={
          `${label} keeps its name, playlist, schedules and history — nothing it is assigned changes. ` +
          `Its current credential is replaced, so the device paired to it now stops working immediately. ` +
          `Code ${code} must be the one showing on the screen you want to bind.`
        }
        confirmText="Re-pair display"
        type="danger"
        onConfirm={repair}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
