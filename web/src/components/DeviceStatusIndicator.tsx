'use client';

import { useEffect, useState } from 'react';
import { useDeviceStatus, DeviceStatus } from '@/lib/context/DeviceStatusContext';
import { Icon } from '@/theme/icons';

interface DeviceStatusIndicatorProps {
  deviceId: string;
  showLabel?: boolean;
  showTime?: boolean;
  className?: string;
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
  error: {
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900',
    dotColor: 'bg-orange-500',
    label: 'Error',
    icon: 'alertTriangle',
  },
};

export default function DeviceStatusIndicator({
  deviceId,
  showLabel = true,
  showTime = false,
  className = '',
}: DeviceStatusIndicatorProps) {
  const { getDeviceStatus, subscribeToDevice } = useDeviceStatus();
  const [status, setStatus] = useState<DeviceStatus>('offline');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
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
    // Only depend on deviceId - subscribeToDevice and getDeviceStatus are stable from context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const config = statusConfig[status] || statusConfig.offline;

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
