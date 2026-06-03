export const DEFAULT_PUBLIC_APP_URL = 'http://localhost:3001';

const PUBLIC_APP_URL_ENV_KEYS = ['APP_URL', 'FRONTEND_URL', 'WEB_URL'] as const;

export type PublicAppUrlSource =
  | (typeof PUBLIC_APP_URL_ENV_KEYS)[number]
  | 'fallback';

export interface ResolvedPublicAppUrl {
  url: string;
  source: PublicAppUrlSource;
}

function normalizePublicAppUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function resolvePublicAppUrl(
  fallback = DEFAULT_PUBLIC_APP_URL,
): string {
  return resolvePublicAppUrlWithSource(fallback).url;
}

export function resolvePublicAppUrlWithSource(
  fallback = DEFAULT_PUBLIC_APP_URL,
): ResolvedPublicAppUrl {
  for (const source of PUBLIC_APP_URL_ENV_KEYS) {
    const value = process.env[source];
    if (value?.trim()) {
      return { source, url: normalizePublicAppUrl(value) };
    }
  }

  return {
    source: 'fallback',
    url: normalizePublicAppUrl(fallback),
  };
}
