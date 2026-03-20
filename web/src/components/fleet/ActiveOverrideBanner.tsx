'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/hooks/useToast';
import { Icon } from '@/theme/icons';

interface Override {
  commandId: string;
  contentId: string;
  contentTitle: string;
  targetType: string;
  targetId: string;
  targetName: string;
  duration: number;
  startedAt: string;
  expiresAt: string;
  startedBy: string;
}

function getTimeRemaining(expiresAt: string): string {
  const now = Date.now();
  const expires = new Date(expiresAt).getTime();
  const diff = expires - now;

  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  if (minutes > 0) return `${minutes}m ${seconds}s remaining`;
  return `${seconds}s remaining`;
}

export default function ActiveOverrideBanner() {
  const toast = useToast();
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [, setTick] = useState(0); // force re-render for countdown

  const fetchOverrides = useCallback(async () => {
    try {
      const data = await apiClient.getActiveOverrides();
      setOverrides(data || []);
    } catch {
      // Silently fail — banner just won't show
    }
  }, []);

  useEffect(() => {
    fetchOverrides();
    const pollInterval = setInterval(fetchOverrides, 30000);
    return () => clearInterval(pollInterval);
  }, [fetchOverrides]);

  // Countdown ticker (every second when overrides are active)
  useEffect(() => {
    if (overrides.length === 0) return;
    const ticker = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(ticker);
  }, [overrides.length]);

  const handleClear = async (commandId: string) => {
    try {
      const result = await apiClient.clearOverride(commandId);
      toast.success(`Override cleared, ${result.devicesNotified} devices notified`);
      fetchOverrides();
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear override');
    }
  };

  if (overrides.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="active-override-banner">
      {overrides.map((override) => (
        <div
          key={override.commandId}
          className="bg-error-600 text-white rounded-xl px-5 py-4 flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-3">
            <Icon name="warning" size="xl" className="text-white flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                Emergency Override Active: {override.contentTitle}
              </p>
              <p className="text-xs text-white/80">
                Target: {override.targetName} &middot; {getTimeRemaining(override.expiresAt)} &middot; Started by {override.startedBy}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleClear(override.commandId)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition flex-shrink-0"
          >
            Clear Override
          </button>
        </div>
      ))}
    </div>
  );
}
