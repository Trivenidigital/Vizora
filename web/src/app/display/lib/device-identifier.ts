const STORAGE_KEY = 'vizora_device_identifier';

/**
 * Generate or retrieve a persistent browser device identifier.
 * Format: web-{screenWidth}x{screenHeight}-{randomSuffix}
 */
export function getDeviceIdentifier(): string {
  if (typeof window === 'undefined') return '';

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  const suffix = Math.random().toString(36).substring(2, 10);
  const id = `web-${screen.width}x${screen.height}-${suffix}`;
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}

export function getDeviceMetadata() {
  return {
    platform: 'web_display',
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    timestamp: new Date().toISOString(),
  };
}
