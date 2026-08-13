'use client';

import { useEffect, useState } from 'react';
import { useDeviceStatus, DeviceStatus } from '@/lib/context/DeviceStatusContext';

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

const statusConfig = {
  online: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900',
    dotColor: 'bg-green-500',
    label: 'Online',
    icon: 'check',
  },
  offline: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900',
    dotColor: 'bg-red-500',
    label: 'Offline',
    icon: 'x',
  },
  idle: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    dotColor: 'bg-yellow-500',
    label: 'Idle',
    icon: 'pause',
  },
  pairing: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    dotColor: 'bg-blue-500',
    label: 'Pairing',
    icon: 'clock',
  },
  error: {
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900',
    dotColor: 'bg-orange-500',
    label: 'Error',
    icon: 'alertTriangle',
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
    color: 'text-[var(--foreground-tertiary)]',
    bgColor: 'bg-[var(--surface-hover)]',
    dotColor: 'bg-[var(--foreground-tertiary)]',
    label: 'Unknown',
    icon: 'help',
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
  const config = statusConfig[effectiveStatus as keyof typeof statusConfig] || statusConfig.unknown;

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
      {/* Animated pulse dot */}
      <div className={`relative w-3 h-3 rounded-full ${config.dotColor}`}>
        {status === 'online' && (
          <div className={`absolute inset-0 rounded-full ${config.dotColor} animate-pulse opacity-75`} />
        )}
        {isUpdating && (
          <div className={`absolute inset-0 rounded-full ${config.dotColor} animate-pulse`} />
        )}
      </div>

      {/* Status badge */}
      {showLabel && (
        <div className={`px-2 py-1 rounded-md text-xs font-semibold ${config.bgColor} ${config.color}`}>
          {config.label}
        </div>
      )}

      {/* Time since update */}
      {showTime && lastUpdate && (
        <div className="text-xs text-[var(--foreground-tertiary)] ml-1">
          {formatTime()}
        </div>
      )}
    </div>
  );
}
