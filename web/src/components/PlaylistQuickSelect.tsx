'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { Display, PlaylistSummary } from '@/lib/types';
import LoadingSpinner from './LoadingSpinner';

interface PlaylistQuickSelectProps {
  device: Display;
  playlists: PlaylistSummary[];
  onUpdate?: () => void;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
  disabled?: boolean;
}

export default function PlaylistQuickSelect({
  device,
  playlists,
  onUpdate,
  onError,
  onSuccess,
  disabled = false,
}: PlaylistQuickSelectProps) {
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (disabled) return;
    const playlistId = e.target.value || null;
    setLoading(true);
    try {
      await apiClient.updateDisplay(device.id, {
        currentPlaylistId: playlistId,
      });
      onSuccess?.();
      onUpdate?.();
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Failed to update playlist'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={device.currentPlaylistId || ''}
        onChange={handleChange}
        disabled={loading || disabled}
        className={`text-sm border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent min-w-[140px] ${
          loading ? 'opacity-50 cursor-wait' : disabled ? 'opacity-70 cursor-not-allowed' : ''
        }`}
        data-testid={`playlist-select-${device.id}`}
        aria-label={`Select playlist for ${device.nickname}`}
        title={disabled ? 'Playlist assignment requires manager or admin access' : undefined}
      >
        <option value="">No playlist</option>
        {playlists.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {loading && <LoadingSpinner size="sm" />}
    </div>
  );
}
