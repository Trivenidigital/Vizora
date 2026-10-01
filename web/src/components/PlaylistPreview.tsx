'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlaylistItemSummary } from '@/lib/types';
import { Icon } from '@/theme/icons';

interface PlaylistPreviewProps {
  items: PlaylistItemSummary[];
  autoPlay?: boolean;
  onClose?: () => void;
}

export default function PlaylistPreview({ items, autoPlay = true, onClose }: PlaylistPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const currentItem = items[currentIndex];
  const duration = currentItem?.duration || currentItem?.content?.duration || 10;

  useEffect(() => {
    setTimeRemaining(duration);
  }, [currentIndex, duration]);

  useEffect(() => {
    if (!isPlaying || items.length === 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setCurrentIndex(i => (i + 1) % items.length);
          return duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, items.length, duration, currentIndex]);

  const goToNext = useCallback(() => {
    setCurrentIndex(i => (i + 1) % items.length);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(i => (i - 1 + items.length) % items.length);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-[var(--background-secondary)] rounded-lg">
        <p className="text-[var(--foreground-tertiary)]">No items to preview</p>
      </div>
    );
  }

  const progressPercent = ((duration - timeRemaining) / duration) * 100;

  return (
    <div className="relative bg-[var(--viewport-bg)] rounded-lg overflow-hidden">
      {/* Content Display */}
      <div className="relative aspect-video flex items-center justify-center bg-[var(--viewport-bg)]">
        {currentItem?.content?.thumbnailUrl ? (
          <img
            src={currentItem.content.thumbnailUrl}
            alt={currentItem.content?.title || 'Content'}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-center text-[var(--viewport-ink)]">
            <div className="text-6xl mb-4">
              {currentItem?.content?.type === 'video' ? (
                <Icon name="video" size="6xl" className="text-[var(--viewport-ink)]" />
              ) : currentItem?.content?.type === 'image' ? (
                <Icon name="image" size="6xl" className="text-[var(--viewport-ink)]" />
              ) : (
                <Icon name="document" size="6xl" className="text-[var(--viewport-ink)]" />
              )}
            </div>
            <p className="text-lg font-medium">
              {currentItem?.content?.title || `Item ${currentIndex + 1}`}
            </p>
            <p className="text-sm text-[var(--viewport-ink-muted)] mt-1">
              {currentItem?.content?.type || 'content'}
            </p>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-[var(--viewport-border)]">
        <div
          className="h-full bg-[var(--viewport-ink)] transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--viewport-surface)] text-[var(--viewport-ink)]">
        <div className="flex items-center gap-3">
          <button
            onClick={goToPrev}
            className="p-1 hover:bg-[var(--viewport-hover)] rounded transition"
            title="Previous"
          >
            <Icon name="chevronLeft" size="sm" className="text-[var(--viewport-ink)]" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 hover:bg-[var(--viewport-hover)] rounded transition"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <Icon name={isPlaying ? 'clock' : 'power'} size="sm" className="text-[var(--viewport-ink)]" />
          </button>
          <button
            onClick={goToNext}
            className="p-1 hover:bg-[var(--viewport-hover)] rounded transition"
            title="Next"
          >
            <Icon name="chevronRight" size="sm" className="text-[var(--viewport-ink)]" />
          </button>
        </div>

        <div className="text-sm">
          <span className="font-medium">
            {currentItem?.content?.title || `Item ${currentIndex + 1}`}
          </span>
          <span className="text-[var(--viewport-ink-muted)] ml-2">
            {currentIndex + 1} / {items.length}
          </span>
        </div>

        <div className="text-sm text-[var(--viewport-ink-muted)]">
          {timeRemaining}s remaining
        </div>
      </div>

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-[var(--viewport-ink)] transition"
        >
          <Icon name="close" size="sm" className="text-[var(--viewport-ink)]" />
        </button>
      )}
    </div>
  );
}
