'use client';

import type { ReactNode } from 'react';
import { Icon } from '@/theme/icons';
import type { IconName } from '@/theme/icons';

export interface DeviceStatusPresentation {
  ink: string;
  fill: string;
  label: string;
  icon: IconName;
  dashed?: boolean;
  description: string;
}

/**
 * Status presentation.
 *
 * Three carriers per state — GLYPH, WORD and fill — and the first two survive a
 * greyscale screenshot on their own. Colour is the redundant one: a fleet
 * operator with a colour-vision deficiency, a dimmed panel or a printed report
 * still separates Online from Offline. `unknown` additionally takes a DASHED
 * ring, because "we have no reading" is a different claim from every other
 * state here and is the one an operator is most likely to misread as a fact.
 *
 * Every ink/fill pair is a token pair computed for both themes; see the
 * `--status-*-bg` block in globals.css for the measured ratios.
 */
const statusConfig: Record<string, DeviceStatusPresentation> = {
  online: {
    ink: 'var(--success-ink)',
    fill: 'var(--status-online-bg)',
    label: 'Online',
    icon: 'check',
    description: 'Reported in within the offline threshold',
  },
  offline: {
    ink: 'var(--error-ink)',
    fill: 'var(--status-offline-bg)',
    label: 'Offline',
    icon: 'close',
    description: 'Has not reported in past the offline threshold',
  },
  /**
   * Unreachable today — `idle` is a client-side extension of the status union
   * and the gateway only ever emits online/offline/pairing/error. It is
   * described the day someone adds it server-side, so the copy has to be safe
   * NOW: "connected but not currently playing" is a playback assertion in
   * negative form, and nothing in the schema can back a claim about what a
   * screen is or is not showing. All this bucket actually knows is that the
   * server sent the string.
   */
  idle: {
    ink: 'var(--foreground-secondary)',
    fill: 'var(--status-neutral-bg)',
    label: 'Idle',
    icon: 'clock',
    description: 'Reported as idle by the device',
  },
  pairing: {
    ink: 'var(--info-ink)',
    fill: 'var(--status-pairing-bg)',
    label: 'Pairing',
    icon: 'refresh',
    description: 'Waiting to complete pairing',
  },
  error: {
    ink: 'var(--warning-ink)',
    fill: 'var(--status-error-bg)',
    label: 'Error',
    icon: 'warning',
    description: 'The device reported a fault',
  },
  /**
   * "We have no status for this device" is NOT the same claim as "this device
   * is offline", and it must not look like one.
   *
   * This component used to initialise to 'offline' and fall back to the offline
   * config for anything unrecognised, so a device merely missing from the status
   * map - including the case where the whole bootstrap fetch failed - rendered a
   * red Offline badge indistinguishable from a device verified to be down. An
   * operator would go looking for a screen that is, as far as anyone knows, fine.
   */
  unknown: {
    ink: 'var(--foreground-secondary)',
    fill: 'transparent',
    label: 'Unknown',
    icon: 'help',
    dashed: true,
    description: 'No status reading — this is not the same as offline',
  },
};

/**
 * The single place a display status string becomes words, glyph and colour.
 *
 * Anything this table does not recognise - including null/undefined - reads as
 * Unknown, never as Offline: an unexpected string is not evidence the screen is
 * down. Callers that only have a raw `display.status` (detail-page header,
 * preview modal, push-to-screens picker) use this instead of an
 * "online ? Online : Offline" ternary, which mislabelled pairing and error.
 */
export function getDeviceStatusPresentation(
  status: string | null | undefined,
): DeviceStatusPresentation {
  return (status && statusConfig[status]) || statusConfig.unknown;
}

interface DeviceStatusBadgeProps {
  status: string | null | undefined;
  showLabel?: boolean;
  /** Extra, visually hidden content (e.g. a "status just changed" cue). */
  children?: ReactNode;
}

/**
 * Pure status pill. No context, no subscription - the caller supplies the
 * status. DeviceStatusIndicator renders this for its live value.
 */
export default function DeviceStatusBadge({
  status,
  showLabel = true,
  children,
}: DeviceStatusBadgeProps) {
  const config = getDeviceStatusPresentation(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        color: config.ink,
        background: config.fill,
        // The dashed ring is unknown's alone; every other state is flat-filled.
        border: config.dashed ? '1px dashed currentColor' : '1px solid transparent',
      }}
      title={config.description}
    >
      <Icon name={config.icon} size="xs" aria-hidden />
      {showLabel ? config.label : <span className="sr-only">{config.label}</span>}
      {children}
    </span>
  );
}
