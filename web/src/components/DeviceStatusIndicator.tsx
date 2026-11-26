'use client';

import { useEffect, useState } from 'react';
import { useDeviceStatus, DeviceStatus } from '@/lib/context/DeviceStatusContext';
import DeviceStatusBadge from './DeviceStatusBadge';

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
      <DeviceStatusBadge status={effectiveStatus} showLabel={showLabel}>
        {isUpdating && <span className="sr-only">status just changed</span>}
      </DeviceStatusBadge>

      {/* Time since update */}
      {showTime && lastUpdate && (
        <span className="text-xs text-[var(--foreground-tertiary)]">{formatTime()}</span>
      )}
    </div>
  );
}
