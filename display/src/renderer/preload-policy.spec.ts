import {
  shouldDownloadOnCacheMiss,
  shouldReadCachedContent,
  shouldPreloadContentType,
} from './preload-policy';

describe('shouldPreloadContentType', () => {
  it('allows image preloads', () => {
    expect(shouldPreloadContentType('image')).toBe(true);
  });

  it('blocks video preloads so playback can use native range streaming', () => {
    expect(shouldPreloadContentType('video')).toBe(false);
  });

  it('blocks non-media and missing content types', () => {
    expect(shouldPreloadContentType('html')).toBe(false);
    expect(shouldPreloadContentType(undefined)).toBe(false);
  });
});

describe('playback cache policy', () => {
  it('allows video cache reads without allowing video cache-miss downloads', () => {
    expect(shouldReadCachedContent('video')).toBe(true);
    expect(shouldDownloadOnCacheMiss('video')).toBe(false);
  });

  it('allows image cache reads and cache-miss downloads', () => {
    expect(shouldReadCachedContent('image')).toBe(true);
    expect(shouldDownloadOnCacheMiss('image')).toBe(true);
  });
});
