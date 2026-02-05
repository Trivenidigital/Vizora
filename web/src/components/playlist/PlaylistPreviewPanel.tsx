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
      <div className="flex flex-col h-full bg-gray-50 border-l border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="preview" size="xl" className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">Add items to preview</p>
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
    <div className="flex flex-col h-full bg-gray-50 border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
        <p className="text-sm text-gray-600 mt-1">
          {currentIndex + 1} of {items.length}
        </p>
      </div>

      {/* Preview Display */}
      <div className="flex-1 flex flex-col p-4">
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
          {/* Content Display */}
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
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
                <p className="text-xs text-gray-400 mt-1 capitalize">
                  {currentItem?.content?.type || 'content'}
                </p>
              </div>
            )}
          </div>

          {/* Current Item Progress */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
            <div
              className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Content Info */}
        <div className="bg-white rounded-lg p-4 mb-4">
          <div className="text-sm font-medium text-gray-900 mb-1 truncate">
            {currentItem?.content?.title || `Item ${currentIndex + 1}`}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="capitalize">{currentItem?.content?.type || 'unknown'}</span>
            <span>•</span>
            <span>{timeRemaining}s remaining</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="bg-white rounded-lg p-4 space-y-3">
          {/* Total Playlist Progress */}
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Playlist Progress</span>
              <span>{Math.round(totalProgressPercent)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${totalProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={goToPrev}
              disabled={items.length <= 1}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous"
            >
              <Icon name="chevronLeft" size="md" className="text-gray-700" />
            </button>

            <button
              onClick={togglePlayPause}
              className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Icon name="clock" size="md" className="text-white" />
              ) : (
                <Icon name="power" size="md" className="text-white" />
              )}
            </button>

            <button
              onClick={goToNext}
              disabled={items.length <= 1}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next"
            >
              <Icon name="chevronRight" size="md" className="text-gray-700" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
