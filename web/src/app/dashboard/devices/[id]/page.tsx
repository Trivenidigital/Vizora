'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Display } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import DeviceStatusIndicator from '@/components/DeviceStatusIndicator';
import { Icon } from '@/theme/icons';

// Extended display type for fields the backend returns but the base type doesn't include
interface DisplayDetail extends Display {
  resolution?: string;
  description?: string;
  timezone?: string;
  metadata?: Record<string, any>;
  pairedAt?: string;
  deviceIdentifier?: string;
}

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.id as string;

  const [device, setDevice] = useState<DisplayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    const loadDevice = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.getDisplay(deviceId);
        setDevice(data as DisplayDetail);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load device');
      } finally {
        setLoading(false);
      }
    };

    loadDevice();
  }, [deviceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/devices"
          className="inline-flex items-center gap-2 text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition"
        >
          <Icon name="chevronLeft" size="sm" />
          Back to Devices
        </Link>
        <div className="bg-[var(--surface)] rounded-lg shadow p-12 text-center">
          <Icon name="error" size="2xl" className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">Device Not Found</h2>
          <p className="text-[var(--foreground-secondary)] mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard/devices')}
            className="px-6 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-medium"
          >
            Return to Devices
          </button>
        </div>
      </div>
    );
  }

  if (!device) return null;

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    return new Date(String(date)).toLocaleString();
  };

  const infoRows: { label: string; value: React.ReactNode }[] = [
    {
      label: 'Status',
      value: <DeviceStatusIndicator deviceId={device.id} showLabel showTime />,
    },
    {
      label: 'Location',
      value: device.location || '\u2014',
    },
    {
      label: 'Device ID',
      value: (
        <span className="font-mono text-xs bg-[var(--background-secondary)] px-2 py-1 rounded">
          {device.deviceIdentifier || device.deviceId || device.id}
        </span>
      ),
    },
    {
      label: 'Resolution',
      value: device.resolution || '\u2014',
    },
    {
      label: 'Orientation',
      value: device.orientation
        ? device.orientation.charAt(0).toUpperCase() + device.orientation.slice(1)
        : '\u2014',
    },
    {
      label: 'Timezone',
      value: device.timezone || '\u2014',
    },
    {
      label: 'Last Seen',
      value: formatDate(device.lastSeen || device.lastHeartbeat),
    },
    {
      label: 'Paired At',
      value: formatDate(device.pairedAt),
    },
    {
      label: 'Created',
      value: formatDate(device.createdAt),
    },
    {
      label: 'Updated',
      value: formatDate(device.updatedAt),
    },
  ];

  // Extract metadata fields if present (firmware, IP, OS, model, etc.)
  const metadata = device.metadata || {};
  const metadataRows: { label: string; value: string }[] = [];
  if (metadata.ipAddress) metadataRows.push({ label: 'IP Address', value: metadata.ipAddress });
  if (metadata.firmwareVersion) metadataRows.push({ label: 'Firmware Version', value: metadata.firmwareVersion });
  if (metadata.os) metadataRows.push({ label: 'Operating System', value: metadata.os });
  if (metadata.model) metadataRows.push({ label: 'Model', value: metadata.model });
  if (metadata.appVersion) metadataRows.push({ label: 'App Version', value: metadata.appVersion });
  if (metadata.userAgent) metadataRows.push({ label: 'User Agent', value: metadata.userAgent });

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/devices"
        className="inline-flex items-center gap-2 text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition"
      >
        <Icon name="chevronLeft" size="sm" />
        Back to Devices
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[var(--background-secondary)] rounded-lg">
            <Icon name="devices" size="2xl" className="text-[#00E5A0]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">{device.nickname || 'Unnamed Device'}</h1>
            {device.description && (
              <p className="text-sm text-[var(--foreground-secondary)] mt-1">{device.description}</p>
            )}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            device.status === 'online'
              ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200'
              : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)]'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              device.status === 'online' ? 'bg-success-500' : 'bg-[var(--foreground-tertiary)]'
            }`}
          />
          {device.status === 'online' ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Device Information */}
      <div className="bg-[var(--surface)] rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Device Information</h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {infoRows.map((row) => (
            <div key={row.label} className="px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--foreground-secondary)]">{row.label}</span>
              <span className="text-sm text-[var(--foreground)]">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata / Hardware Info */}
      {metadataRows.length > 0 && (
        <div className="bg-[var(--surface)] rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Hardware Details</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {metadataRows.map((row) => (
              <div key={row.label} className="px-6 py-4 flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--foreground-secondary)]">{row.label}</span>
                <span className="text-sm text-[var(--foreground)] font-mono">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Playlist */}
      {device.currentPlaylistId && (
        <div className="bg-[var(--surface)] rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Current Content</h2>
          </div>
          <div className="px-6 py-4">
            <Link
              href={`/dashboard/playlists/${device.currentPlaylistId}`}
              className="inline-flex items-center gap-2 text-[#00E5A0] hover:text-[#00CC8E] transition font-medium"
            >
              <Icon name="playlists" size="md" />
              View Assigned Playlist
              <Icon name="chevronRight" size="sm" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
