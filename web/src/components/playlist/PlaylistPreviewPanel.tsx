'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlaylistItem } from '@/lib/types';
import { Icon } from '@/theme/icons';

interface PlaylistPreviewPanelProps {
  items: PlaylistItem[];
}

export default function PlaylistPreviewPanel({ items }: PlaylistPreviewPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const currentItem = items[currentIndex];
  const duration = currentItem?.duration || 30;

  // Reset to first item when items change
  useEffect(() => {
    setCurrentIndex(0);
    setTimeRemaining(duration);
  }, [items.length]);

  // Update time remaining when index or duration changes
  useEffect(() => {
    setTimeRemaining(duration);
  }, [currentIndex, duration]);

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying || items.length === 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setCurrentIndex((i) => (i + 1) % items.length);
          return duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, items.length, duration, currentIndex]);

  const goToNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % items.length);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + items.length) % items.length);
  }, [items.length]);

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[var(--background)] border-l border-[var(--border)]">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-[var(--background-tertiary)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="preview" size="xl" className="text-[var(--foreground-tertiary)]" />
            </div>
            <p className="text-sm text-[var(--foreground-tertiary)]">Add items to preview</p>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = ((duration - timeRemaining) / duration) * 100;
  const totalPlaylistDuration = items.reduce((sum, item) => sum + (item.duration || 30), 0);
  const elapsedDuration = items
    .slice(0, currentIndex)
    .reduce((sum, item) => sum + (item.duration || 30), 0) + (duration - timeRemaining);
  const totalProgressPercent = (elapsedDuration / totalPlaylistDuration) * 100;

  return (
    <div className="flex flex-col h-full bg-[var(--background)] border-l border-[var(--border)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)]">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Preview</h3>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">
          {currentIndex + 1} of {items.length}
        </p>
      </div>

      {/* Preview Display */}
      <div className="flex-1 flex flex-col p-4">
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
          {/* Content Display */}
          <div className="absolute inset-0 flex items-center justify-center bg-[#061A21]">
            {currentItem?.content?.thumbnailUrl ? (
              <img
                src={currentItem.content.thumbnailUrl}
                alt={currentItem.content?.title || 'Content'}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-center text-white">
                <div className="text-5xl mb-3">
                  {currentItem?.content?.type === 'video' ? (
                    <Icon name="video" size="6xl" className="text-white" />
                  ) : currentItem?.content?.type === 'image' ? (
                    <Icon name="image" size="6xl" className="text-white" />
                  ) : (
                    <Icon name="document" size="6xl" className="text-white" />
                  )}
                </div>
                <p className="text-base font-medium">
                  {currentItem?.content?.title || `Item ${currentIndex + 1}`}
                </p>
                <p className="text-xs text-[#8A8278] mt-1 capitalize">
                  {currentItem?.content?.type || 'content'}
                </p>
              </div>
            )}
          </div>

          {/* Current Item Progress */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1B3D47]">
            <div
              className="h-full bg-[#00E5A0] transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Content Info */}
        <div className="bg-[var(--surface)] rounded-lg p-4 mb-4">
          <div className="text-sm font-medium text-[var(--foreground)] mb-1 truncate">
            {currentItem?.content?.title || `Item ${currentIndex + 1}`}
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--foreground-tertiary)]">
            <span className="capitalize">{currentItem?.content?.type || 'unknown'}</span>
            <span>•</span>
            <span>{timeRemaining}s remaining</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="bg-[var(--surface)] rounded-lg p-4 space-y-3">
          {/* Total Playlist Progress */}
          <div>
            <div className="flex justify-between text-xs text-[var(--foreground-secondary)] mb-1">
              <span>Playlist Progress</span>
              <span>{Math.round(totalProgressPercent)}%</span>
            </div>
            <div className="h-2 bg-[var(--background-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00E5A0] transition-all duration-300"
                style={{ width: `${totalProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={goToPrev}
              disabled={items.length <= 1}
              className="p-2 bg-[var(--background-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous"
            >
              <Icon name="chevronLeft" size="md" className="text-[var(--foreground-secondary)]" />
            </button>

            <button
              onClick={togglePlayPause}
              className="p-3 bg-[#00E5A0] hover:bg-[#00CC8E] text-[#061A21] rounded-lg transition"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Icon name="clock" size="md" className="text-[#061A21]" />
              ) : (
                <Icon name="power" size="md" className="text-[#061A21]" />
              )}
            </button>

            <button
              onClick={goToNext}
              disabled={items.length <= 1}
              className="p-2 bg-[var(--background-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next"
            >
              <Icon name="chevronRight" size="md" className="text-[var(--foreground-secondary)]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
