export function shouldPreloadContentType(type: unknown): boolean {
  return type === 'image';
}

export function shouldReadCachedContent(type: unknown): boolean {
  return type === 'image' || type === 'video';
}

export function shouldDownloadOnCacheMiss(type: unknown): boolean {
  return type === 'image';
}
