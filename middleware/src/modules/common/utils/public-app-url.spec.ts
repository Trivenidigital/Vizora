import {
  DEFAULT_PUBLIC_APP_URL,
  resolvePublicAppUrl,
  resolvePublicAppUrlWithSource,
} from './public-app-url';

describe('public app URL resolver', () => {
  const KEYS = ['APP_URL', 'FRONTEND_URL', 'WEB_URL'] as const;
  let originalEnv: Partial<Record<(typeof KEYS)[number], string | undefined>>;

  beforeEach(() => {
    originalEnv = {};
    for (const key of KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('prefers APP_URL before legacy fallbacks', () => {
    process.env.APP_URL = 'https://app.vizora.test/';
    process.env.FRONTEND_URL = 'https://legacy.vizora.test';
    process.env.WEB_URL = 'https://web.vizora.test';

    expect(resolvePublicAppUrl()).toBe('https://app.vizora.test');
    expect(resolvePublicAppUrlWithSource()).toEqual({
      source: 'APP_URL',
      url: 'https://app.vizora.test',
    });
  });

  it('falls back from FRONTEND_URL to WEB_URL before localhost', () => {
    process.env.WEB_URL = 'https://web.vizora.test';

    expect(resolvePublicAppUrl()).toBe('https://web.vizora.test');

    process.env.FRONTEND_URL = 'https://frontend.vizora.test';

    expect(resolvePublicAppUrl()).toBe('https://frontend.vizora.test');
  });

  it('uses the provided fallback when no public URL env var is set', () => {
    expect(resolvePublicAppUrl()).toBe(DEFAULT_PUBLIC_APP_URL);
    expect(resolvePublicAppUrlWithSource('https://fallback.vizora.test')).toEqual({
      source: 'fallback',
      url: 'https://fallback.vizora.test',
    });
  });
});
