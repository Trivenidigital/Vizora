'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Playlist, PlaylistItem, PushContent } from '../lib/types';

interface UsePlaylistPlayerOptions {
  onImpression?: (data: {
    contentId: string;
    playlistId?: string;
    duration?: number;
    completionPercentage?: number;
    timestamp: number;
  }) => void;
}

export function usePlaylistPlayer({ onImpression }: UsePlaylistPlayerOptions = {}) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentItem, setCurrentItem] = useState<PlaylistItem | null>(null);
  const [temporaryContent, setTemporaryContent] = useState<PushContent | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentStartRef = useRef(0);
  const savedStateRef = useRef<{ playlist: Playlist; index: number } | null>(null);
  const playlistRef = useRef(playlist);
  const indexRef = useRef(currentIndex);

  // Keep refs in sync
  playlistRef.current = playlist;
  indexRef.current = currentIndex;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const logImpression = useCallback((item: PlaylistItem, expectedDurationMs: number) => {
    if (!onImpression || !item.content || contentStartRef.current === 0) return;
    const actualMs = Date.now() - contentStartRef.current;
    const completion = Math.min(100, Math.round((actualMs / expectedDurationMs) * 100));
    onImpression({
      contentId: item.content.id,
      playlistId: playlistRef.current?.id,
      duration: Math.round(actualMs / 1000),
      completionPercentage: completion,
      timestamp: Date.now(),
    });
  }, [onImpression]);

  const advanceToNext = useCallback(() => {
    const pl = playlistRef.current;
    if (!pl?.items?.length) return;

    // Log impression for completed item
    const prevItem = pl.items[indexRef.current];
    if (prevItem?.content) {
      const expectedMs = (prevItem.duration || 10) * 1000;
      logImpression(prevItem, expectedMs);
    }

    let nextIndex = indexRef.current + 1;
    if (nextIndex >= pl.items.length) {
      if (pl.loopPlaylist !== false) {
        nextIndex = 0;
      } else {
        return; // Playlist ended
      }
    }

    setCurrentIndex(nextIndex);
    indexRef.current = nextIndex;
    const nextItem = pl.items[nextIndex];
    setCurrentItem(nextItem || null);
    contentStartRef.current = Date.now();

    // Schedule next advance for non-video content
    if (nextItem?.content?.type !== 'video') {
      const duration = (nextItem?.duration || 10) * 1000;
      clearTimer();
      timerRef.current = setTimeout(advanceToNext, duration);
    }
  }, [clearTimer, logImpression]);

  const handleVideoEnded = useCallback(() => {
    advanceToNext();
  }, [advanceToNext]);

  const updatePlaylist = useCallback((newPlaylist: Playlist) => {
    clearTimer();
    setPlaylist(newPlaylist);
    playlistRef.current = newPlaylist;
    setTemporaryContent(null);

    if (newPlaylist.items?.length > 0) {
      setCurrentIndex(0);
      indexRef.current = 0;
      const firstItem = newPlaylist.items[0];
      setCurrentItem(firstItem);
      contentStartRef.current = Date.now();

      if (firstItem?.content?.type !== 'video') {
        const duration = (firstItem.duration || 10) * 1000;
        timerRef.current = setTimeout(advanceToNext, duration);
      }
    } else {
      setCurrentIndex(0);
      setCurrentItem(null);
    }
  }, [clearTimer, advanceToNext]);

  const pushContent = useCallback((content: PushContent, duration: number) => {
    // Save current state
    if (playlistRef.current && !temporaryContent) {
      savedStateRef.current = {
        playlist: playlistRef.current,
        index: indexRef.current,
      };
    }

    clearTimer();
    setTemporaryContent(content);
    contentStartRef.current = Date.now();

    // Resume after duration
    timerRef.current = setTimeout(() => {
      setTemporaryContent(null);
      if (savedStateRef.current) {
        const { playlist: savedPl, index } = savedStateRef.current;
        savedStateRef.current = null;
        setPlaylist(savedPl);
        playlistRef.current = savedPl;
        setCurrentIndex(index);
        indexRef.current = index;
        const item = savedPl.items[index];
        setCurrentItem(item || null);
        contentStartRef.current = Date.now();

        if (item?.content?.type !== 'video') {
          const dur = (item?.duration || 10) * 1000;
          timerRef.current = setTimeout(advanceToNext, dur);
        }
      }
    }, duration * 1000);
  }, [clearTimer, advanceToNext, temporaryContent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    playlist,
    currentItem,
    currentIndex,
    temporaryContent,
    updatePlaylist,
    pushContent,
    advanceToNext,
    handleVideoEnded,
    currentContentId: temporaryContent?.id || currentItem?.content?.id || null,
  };
}
