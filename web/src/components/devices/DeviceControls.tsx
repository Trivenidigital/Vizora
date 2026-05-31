'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/hooks/useToast';
import ConfirmDialog from '@/components/ConfirmDialog';

type DeviceControlCommand = 'reload' | 'restart' | 'clear_cache';

interface DeviceControlsProps {
  deviceId: string;
}

interface CommandMeta {
  command: DeviceControlCommand;
  label: string;
  description: string;
  /** Present for disruptive commands that require a confirmation step. */
  confirm?: { title: string; message: string };
}

// Intentionally a safe subset of the gateway's DeviceCommandType — only the
// reversible screen controls are exposed here (no disable/enable, no push).
const COMMANDS: CommandMeta[] = [
  {
    command: 'reload',
    label: 'Reload Screen',
    description: 'Refresh the current content without restarting the app.',
  },
  {
    command: 'restart',
    label: 'Restart App',
    description: 'Relaunch the player application on the device.',
    confirm: {
      title: 'Restart device app?',
      message:
        'The player application will relaunch. The screen will be briefly blank while it restarts.',
    },
  },
  {
    command: 'clear_cache',
    label: 'Clear Cache',
    description:
      'Clear cached content and reload. Use if the screen shows stale content.',
    confirm: {
      title: 'Clear cache?',
      message:
        'Cached content will be cleared and the screen reloaded. The next load may be slower than usual.',
    },
  },
];

/**
 * Remote control panel for a single device. Wired to the existing fleet
 * command endpoint (POST /fleet/commands) via apiClient.sendFleetCommand with
 * a single-device target. The realtime gateway delivers the command to online
 * devices immediately and QUEUES it in Redis for offline devices (delivered on
 * reconnect), so we report the backend's online/queued counts rather than
 * blocking when the device is offline.
 */
export function DeviceControls({ deviceId }: DeviceControlsProps) {
  const toast = useToast();
  const [confirming, setConfirming] = useState<CommandMeta | null>(null);
  const [loadingCommand, setLoadingCommand] = useState<DeviceControlCommand | null>(
    null,
  );

  const send = async (meta: CommandMeta) => {
    try {
      setLoadingCommand(meta.command);
      const result = await apiClient.sendFleetCommand({
        command: meta.command,
        target: { type: 'device', id: deviceId },
      });
      const devicesDelivered = result.devicesDelivered ?? result.devicesOnline;
      if ((result.devicesFailed ?? 0) > 0 && devicesDelivered === 0 && result.devicesQueued === 0) {
        toast.error(`${meta.label} failed to reach the device`);
      } else if (result.devicesQueued > 0 && devicesDelivered === 0) {
        toast.success(
          `Device is offline — ${meta.label} queued and will run when it reconnects`,
        );
      } else {
        toast.success(`${meta.label} sent`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to send command to device',
      );
    } finally {
      setLoadingCommand(null);
      setConfirming(null);
    }
  };

  const handleClick = (meta: CommandMeta) => {
    if (meta.confirm) {
      setConfirming(meta);
    } else {
      void send(meta);
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Device Controls
        </h2>
      </div>
      <div className="px-6 py-4">
        <p className="text-sm text-[var(--foreground-secondary)] mb-4">
          Send a remote command to this screen. Commands run immediately on online
          devices and are queued for offline devices until they reconnect.
        </p>
        <div className="flex flex-wrap gap-3">
          {COMMANDS.map((meta) => (
            <button
              key={meta.command}
              type="button"
              onClick={() => handleClick(meta)}
              disabled={loadingCommand !== null}
              title={meta.description}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingCommand === meta.command ? 'Sending…' : meta.label}
            </button>
          ))}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirming !== null}
        title={confirming?.confirm?.title ?? ''}
        message={confirming?.confirm?.message ?? ''}
        confirmText="Send Command"
        type="warning"
        onConfirm={() => {
          if (confirming) void send(confirming);
        }}
        onClose={() => setConfirming(null)}
      />
    </div>
  );
}
