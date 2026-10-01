'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import {
  readConflictingDisplayId,
  readRepairPairingErrorCode,
} from '@/lib/api/displays';
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
  /** Names the class of failure. Curated here, never server text. */
  title: string;
  /** What happened, in our words. Curated here, never server text. */
  detail: string;
  /** What to do next about THIS class of failure. */
  hint: string;
  /**
   * Same-org display already holding the device identifier. Read from the
   * STRUCTURED `conflictingDisplayId` field, never scraped out of a sentence.
   */
  conflictingDisplayId?: string;
}

/**
 * A generic failure. Everything that is not a recognised 4xx lands here —
 * 5xx, an unmapped status, a transport error, a thrown non-Error. Nothing
 * from the response reaches the operator on this path.
 *
 * `AllExceptionsFilter` already replaces a non-`HttpException` body with a
 * flat 'Internal server error' outside `NODE_ENV=development`, so stack
 * traces, SQL and Redis strings should never arrive here in the first place.
 * This is the second lock: even if one did, the UI has no path that renders
 * it.
 */
const GENERIC_FAILURE: RepairFailure = {
  title: 'Re-pairing failed',
  detail: 'Something went wrong and the re-pair did not complete.',
  hint: 'Reload this page to check the display, then try again. If it keeps failing, contact support.',
};

/** Curated copy for each 409 in the published contract. */
const CONFLICT_COPY: Record<string, Omit<RepairFailure, 'conflictingDisplayId'>> = {
  DEVICE_IDENTIFIER_IN_USE: {
    title: 'Another display is already using that screen',
    detail:
      'The screen showing that code is already bound to a different display in this organization.',
    hint: 'Remove or re-pair that display first, then restart pairing on this screen.',
  },
  DEVICE_IDENTIFIER_TAKEN_DURING_REBIND: {
    title: 'Another display claimed that screen first',
    detail:
      'The screen was bound to a different display while this re-pair was still in flight.',
    hint: 'Restart pairing on the display to get a fresh code, then try again.',
  },
  DISPLAY_REBIND_IN_PROGRESS: {
    title: 'This display is already being re-paired',
    detail: 'Another re-pair of this display has not finished yet.',
    hint: 'Wait for it to finish, then try again.',
  },
  ORG_PAIRING_IN_PROGRESS: {
    title: 'Another pairing is in progress',
    detail:
      'Someone else in this organization is completing a pairing right now.',
    hint: 'Wait a moment, then try again.',
  },
};

/** A 409 whose body carries no code we recognise. */
const UNKNOWN_CONFLICT: RepairFailure = {
  title: 'Re-pair refused — conflict',
  detail: 'Something else is already using that screen or this display.',
  hint: 'Reload this page to check the display, then try again.',
};

/**
 * Map a failed re-pair onto the outcomes the server distinguishes, selecting
 * on `statusCode` + the published `code` — NEVER on message text.
 *
 * Every string the operator reads is written here. The server's `message` is
 * curated today, but binding copy to prose means a reworded sentence silently
 * changes behaviour, and it forces a rendering path for arbitrary backend
 * exception text that must not exist at all. The only server value that
 * reaches the DOM is `conflictingDisplayId`, and only after id-shape
 * validation in `readConflictingDisplayId`.
 *
 * 404 is deliberately ambiguous at the source: an unknown code, an expired
 * code and a target display in ANOTHER org all answer identically so a rebind
 * cannot be used to probe for display ids. Do not try to tell them apart.
 */
export function describeRepairFailure(error: unknown): RepairFailure {
  if (!isApiError(error)) return GENERIC_FAILURE;

  switch (error.statusCode) {
    case 404:
      return {
        title: 'Pairing code not found or expired',
        detail:
          'That code is not valid for this organization, or it has already expired.',
        hint: 'Check the code on the screen. Codes expire — restart pairing on the display to get a new one.',
      };
    case 400:
      return {
        title: 'That pairing code cannot be used',
        detail:
          'The code has already been used, has expired, or is being completed by someone else right now.',
        hint: 'Restart pairing on the display to get a fresh code, then try again.',
      };
    case 403:
      return {
        title: 'Your role cannot re-pair displays',
        detail: 'Re-pairing a display is limited to admins and managers.',
        hint: 'Ask an admin or a manager to re-pair this display.',
      };
    case 409: {
      const code = readRepairPairingErrorCode(error.code);
      if (!code) return UNKNOWN_CONFLICT;
      return {
        ...CONFLICT_COPY[code],
        // Only this one code carries an id, and only when the server sent a
        // well-formed one. Absent or malformed → the no-link variant.
        conflictingDisplayId:
          code === 'DEVICE_IDENTIFIER_IN_USE'
            ? readConflictingDisplayId(error.details)
            : undefined,
      };
    }
    default:
      return GENERIC_FAILURE;
  }
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
                  className="text-[var(--primary-ink)] hover:text-[var(--foreground)] transition font-medium"
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
