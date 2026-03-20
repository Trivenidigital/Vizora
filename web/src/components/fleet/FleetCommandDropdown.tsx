'use client';

import { useState, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/hooks/useToast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Icon } from '@/theme/icons';

interface FleetCommandDropdownProps {
  organizationId: string;
}

const FLEET_COMMANDS = [
  { command: 'reload', label: 'Reload All Devices', confirmTitle: 'Reload All Devices', confirmMessage: 'This will reload all devices in your organization. Currently playing content may briefly interrupt.' },
  { command: 'restart', label: 'Restart All Devices', confirmTitle: 'Restart All Devices', confirmMessage: 'This will restart all device applications. Devices will be temporarily offline during restart.' },
  { command: 'clear_cache', label: 'Clear All Caches', confirmTitle: 'Clear All Caches', confirmMessage: 'This will clear the content cache on all devices. Devices may need to re-download content.' },
] as const;

export default function FleetCommandDropdown({ organizationId }: FleetCommandDropdownProps) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmCommand, setConfirmCommand] = useState<typeof FLEET_COMMANDS[number] | null>(null);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConfirm = async () => {
    if (!confirmCommand) return;
    try {
      setLoading(true);
      const result = await apiClient.sendFleetCommand({
        command: confirmCommand.command,
        target: { type: 'organization', id: organizationId },
      });
      toast.success(
        `Command sent to ${result.devicesTargeted} devices (${result.devicesOnline} online, ${result.devicesQueued} queued)`
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to send command');
    } finally {
      setLoading(false);
      setConfirmCommand(null);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="eh-btn-ghost rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-medium"
        aria-label="Fleet commands"
      >
        <Icon name="settings" size="lg" />
        <span>Fleet Commands</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 eh-dash-card shadow-lg rounded-xl z-50 py-1">
          {FLEET_COMMANDS.map((cmd) => (
            <button
              key={cmd.command}
              onClick={() => {
                setConfirmCommand(cmd);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition"
            >
              {cmd.label}
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmCommand}
        onClose={() => setConfirmCommand(null)}
        onConfirm={handleConfirm}
        title={confirmCommand?.confirmTitle || ''}
        message={confirmCommand?.confirmMessage || ''}
        confirmText={loading ? 'Sending...' : 'Send Command'}
        type="warning"
      />
    </div>
  );
}
