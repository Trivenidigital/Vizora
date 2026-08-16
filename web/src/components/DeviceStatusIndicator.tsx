'use client';

import { useEffect, useState } from 'react';
import { useDeviceStatus, DeviceStatus } from '@/lib/context/DeviceStatusContext';
import { Icon } from '@/theme/icons';
import type { IconName } from '@/theme/icons';

interface DeviceStatusIndicatorProps {
  deviceId: string;
  showLabel?: boolean;
  showTime?: boolean;
  className?: string;
  /**
   * Authoritative status supplied by the caller.
   *
   * When present this component does NOT consult DeviceStatusContext. The
   * devices table keeps `device.status` on each row (realtime updates land
   * there via handleDeviceStatusChange) and sorts, filters and writes its
   * assign-toast copy from it — while the badge read a SECOND, independently
   * bootstrapped store. The two could disagree, so a row could sort as offline
   * while displaying Online. Passing the row's own value makes one source
   * authoritative for both what is shown and what is sorted.
   *
   * Callers with no row data (e.g. the device detail page) omit it and keep
   * using the context.
   */
  status?: DeviceStatus | 'unknown' | null;
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
const statusConfig: Record<
  string,
  { ink: string; fill: string; label: string; icon: IconName; dashed?: boolean; description: string }
> = {
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
  idle: {
    ink: 'var(--foreground-secondary)',
    fill: 'var(--status-neutral-bg)',
    label: 'Idle',
    icon: 'clock',
    description: 'Connected but not currently playing',
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

export default function DeviceStatusIndicator({
  deviceId,
  showLabel = true,
  showTime = false,
  className = '',
  status: statusProp,
}: DeviceStatusIndicatorProps) {
  const { getDeviceStatus, subscribeToDevice } = useDeviceStatus();
  const [status, setStatus] = useState<DeviceStatus | 'unknown'>('unknown');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Caller owns the status: do not open a second subscription whose result
    // would be computed and then discarded, once per row.
    if (statusProp !== undefined) return undefined;

    // Subscribe to device status updates
    const unsubscribe = subscribeToDevice(deviceId, (update) => {
      setStatus(update.status);
      setLastUpdate(new Date(update.timestamp));
      setIsUpdating(true);

      // Remove animation after a brief moment
      setTimeout(() => setIsUpdating(false), 600);
    });

    // Get initial status
    const currentStatus = getDeviceStatus(deviceId);
    if (currentStatus) {
      setStatus(currentStatus.status);
      setLastUpdate(new Date(currentStatus.timestamp));
    }

    return unsubscribe;
  }, [deviceId, statusProp]);

  // A caller-supplied status wins outright; `null` is a deliberate "no evidence"
  // and must render Unknown rather than falling through to the subscription.
  const effectiveStatus = statusProp !== undefined ? (statusProp ?? 'unknown') : status;
  const config = statusConfig[effectiveStatus as string] || statusConfig.unknown;

  const formatTime = () => {
    if (!lastUpdate) return '';

    const now = new Date();
    const diff = now.getTime() - lastUpdate.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;

    return lastUpdate.toLocaleDateString();
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
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
        {isUpdating && <span className="sr-only">status just changed</span>}
      </span>

      {/* Time since update */}
      {showTime && lastUpdate && (
        <span className="text-xs text-[var(--foreground-tertiary)]">{formatTime()}</span>
      )}
    </div>
  );
}
