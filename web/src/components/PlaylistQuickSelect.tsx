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

/**
 * Assigns a playlist to one device.
 *
 * ASSIGNMENT, not playback. The write sets `currentPlaylistId` and the realtime
 * notify is fire-and-forget; nothing here observes what the screen renders. The
 * surrounding column is headed "Assigned Playlist" for the same reason — do not
 * relabel either of them as what is playing.
 */
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
      <div className="relative min-w-[132px] flex-1">
        <select
          value={device.currentPlaylistId || ''}
          onChange={handleChange}
          disabled={loading || disabled}
          className={`eh-select-inline w-full ${loading ? 'cursor-wait opacity-50' : ''}`}
          data-testid={`playlist-select-${device.id}`}
          aria-label={`Assigned playlist for ${device.nickname}`}
          title={disabled ? 'Playlist assignment requires manager or admin access' : undefined}
        >
          <option value="">No playlist</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {/* A real element in currentColor, not a data-URI: `.eh-select` bakes
            its chevron colour into the URL, which is why that one arrow can
            never follow the theme. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--foreground-tertiary)]"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M8 11L3 6h10l-5 5z" />
        </svg>
      </div>
      {loading && <LoadingSpinner size="sm" />}
    </div>
  );
}
