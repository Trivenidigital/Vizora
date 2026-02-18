'use client';

import { useCallback, useRef } from 'react';

const CACHE_NAME = 'vizora-display-content';
const MAX_CACHE_SIZE = 200 * 1024 * 1024; // 200MB

export function useBrowserCache() {
  const cacheRef = useRef<Cache | null>(null);

  const getCache = useCallback(async (): Promise<Cache | null> => {
    if (cacheRef.current) return cacheRef.current;
    if (typeof caches === 'undefined') return null;
    try {
      cacheRef.current = await caches.open(CACHE_NAME);
      return cacheRef.current;
    } catch {
      return null;
    }
  }, []);

  const getCachedUrl = useCallback(async (url: string): Promise<string | null> => {
    const cache = await getCache();
    if (!cache) return null;
    try {
      const response = await cache.match(url);
      if (!response) return null;
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }, [getCache]);

  const cacheContent = useCallback(async (url: string): Promise<void> => {
    const cache = await getCache();
    if (!cache) return;
    try {
      // Check storage quota before caching
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        const used = est.usage || 0;
        if (used > MAX_CACHE_SIZE) {
          // Evict oldest entries
          const keys = await cache.keys();
          if (keys.length > 0) {
            await cache.delete(keys[0]);
          }
        }
      }
      await cache.add(url);
    } catch {
      // Cache failure is non-critical
    }
  }, [getCache]);

  const preloadItems = useCallback(async (urls: string[]) => {
    for (const url of urls) {
      if (!url) continue;
      const cache = await getCache();
      if (!cache) return;
      try {
        const existing = await cache.match(url);
        if (!existing) {
          await cache.add(url);
        }
      } catch {
        // Non-critical
      }
    }
  }, [getCache]);

  const clearCache = useCallback(async () => {
    if (typeof caches === 'undefined') return;
    try {
      await caches.delete(CACHE_NAME);
      cacheRef.current = null;
    } catch {
      // Ignore
    }
  }, []);

  return { getCachedUrl, cacheContent, preloadItems, clearCache };
}
