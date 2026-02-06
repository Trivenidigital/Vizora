'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlaylistItem } from '@/lib/types';
import { Icon } from '@/theme/icons';

interface PlaylistPreviewProps {
  items: PlaylistItem[];
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
    <div className="relative bg-black rounded-lg overflow-hidden">
      {/* Content Display */}
      <div className="relative aspect-video flex items-center justify-center bg-gray-900">
        {currentItem?.content?.thumbnailUrl ? (
          <img
            src={currentItem.content.thumbnailUrl}
            alt={currentItem.content?.title || 'Content'}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-center text-white">
            <div className="text-6xl mb-4">
              {currentItem?.content?.type === 'video' ? (
                <Icon name="video" size="6xl" className="text-white" />
              ) : currentItem?.content?.type === 'image' ? (
                <Icon name="image" size="6xl" className="text-white" />
              ) : (
                <Icon name="document" size="6xl" className="text-white" />
              )}
            </div>
            <p className="text-lg font-medium">
              {currentItem?.content?.title || `Item ${currentIndex + 1}`}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {currentItem?.content?.type || 'content'}
            </p>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-gray-700">
        <div
          className="h-full bg-[#00E5A0] transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={goToPrev}
            className="p-1 hover:bg-gray-700 rounded transition"
            title="Previous"
          >
            <Icon name="chevronLeft" size="sm" className="text-white" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 hover:bg-gray-700 rounded transition"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <Icon name={isPlaying ? 'clock' : 'power'} size="sm" className="text-white" />
          </button>
          <button
            onClick={goToNext}
            className="p-1 hover:bg-gray-700 rounded transition"
            title="Next"
          >
            <Icon name="chevronRight" size="sm" className="text-white" />
          </button>
        </div>

        <div className="text-sm">
          <span className="font-medium">
            {currentItem?.content?.title || `Item ${currentIndex + 1}`}
          </span>
          <span className="text-gray-400 ml-2">
            {currentIndex + 1} / {items.length}
          </span>
        </div>

        <div className="text-sm text-gray-400">
          {timeRemaining}s remaining
        </div>
      </div>

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition"
        >
          <Icon name="close" size="sm" className="text-white" />
        </button>
      )}
    </div>
  );
}
