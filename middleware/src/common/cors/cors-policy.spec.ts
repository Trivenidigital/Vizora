import {
  resolveCorsOptions,
  createCorsDelegate,
  isDeviceCorsPath,
  isDeviceContentPath,
  isNullOriginCorsEnabled,
  NULL_ORIGIN,
} from './cors-policy';

const BROWSER_ORIGIN = 'https://dashboard.vizora.io';

const enabledEnv = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  CORS_ORIGIN: BROWSER_ORIGIN,
  DEVICE_NULL_ORIGIN_CORS: 'enabled',
  ...extra,
});

const disabledEnv = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  CORS_ORIGIN: BROWSER_ORIGIN,
  ...extra,
});

const DEVICE_PATHS = [
  '/api/v1/devices/pairing/request',
  '/api/v1/devices/pairing/status/ABC123',
  '/api/v1/devices/auth/check',
  '/api/v1/device-content/abc/file',
  // legacy /api prefix form
  '/api/devices/pairing/request',
  '/api/devices/auth/check',
];

const EXCLUDED_PATHS = [
  '/api/v1/devices/pairing/complete',
  '/api/v1/devices/pairing/active',
  '/api/v1/displays',
  '/api/v1/displays/abc/heartbeat',
  '/api/v1/auth/login',
  '/api/v1/content',
];

describe('isNullOriginCorsEnabled (fail-closed)', () => {
  it('is disabled when the flag is absent', () => {
    expect(isNullOriginCorsEnabled({})).toBe(false);
  });

  it.each(['', 'true', '1', 'yes', 'ENABLED', 'disabled', 'enabled '])(
    'is disabled for non-exact value %p',
    (value) => {
      expect(isNullOriginCorsEnabled({ DEVICE_NULL_ORIGIN_CORS: value })).toBe(false);
    },
  );

  it('is enabled only for the exact string "enabled"', () => {
    expect(isNullOriginCorsEnabled({ DEVICE_NULL_ORIGIN_CORS: 'enabled' })).toBe(true);
  });
});

describe('isDeviceCorsPath', () => {
  it.each(DEVICE_PATHS)('matches device path %s', (path) => {
    expect(isDeviceCorsPath(path)).toBe(true);
  });

  it.each(EXCLUDED_PATHS)('does not match excluded path %s', (path) => {
    expect(isDeviceCorsPath(path)).toBe(false);
  });

  it.each([
    '/evil/api/v1/devices/auth/check',
    '/api/v1/devices/pairing/requestX',
    '/api/v1/devices/auth/checkX',
    '/api/v1/device-contentX/abc',
    '/api/v2/devices/auth/check',
    '',
    undefined,
  ])('rejects bypass shape %p', (path) => {
    expect(isDeviceCorsPath(path as string | undefined)).toBe(false);
  });

  it('ignores query strings and fragments when matching', () => {
    expect(isDeviceCorsPath('/api/v1/devices/auth/check?x=1')).toBe(true);
    // A device path smuggled into the query of a non-device path must not match
    expect(isDeviceCorsPath('/api/v1/displays?next=/api/v1/devices/auth/check')).toBe(false);
  });
});

describe('isDeviceContentPath (CORP scope)', () => {
  it('matches only the device-content route', () => {
    expect(isDeviceContentPath('/api/v1/device-content/abc/file')).toBe(true);
    expect(isDeviceContentPath('/api/v1/devices/auth/check')).toBe(false);
    expect(isDeviceContentPath('/api/v1/content/abc/file')).toBe(false);
    expect(isDeviceContentPath('/evil/api/v1/device-content/abc')).toBe(false);
  });
});

describe('resolveCorsOptions — null origin', () => {
  it.each(DEVICE_PATHS)('grants an uncredentialed echo on device path %s', (url) => {
    const opts = resolveCorsOptions({ origin: NULL_ORIGIN, url }, enabledEnv());
    expect(opts.origin).toBe(NULL_ORIGIN);
    expect(opts.credentials).toBe(false);
  });

  it.each(EXCLUDED_PATHS)('grants nothing on excluded path %s', (url) => {
    const opts = resolveCorsOptions({ origin: NULL_ORIGIN, url }, enabledEnv());
    expect(opts.origin).toBe(false);
    expect(opts.credentials).toBe(false);
  });

  it('grants nothing anywhere when the flag is disabled', () => {
    for (const url of [...DEVICE_PATHS, ...EXCLUDED_PATHS]) {
      const opts = resolveCorsOptions({ origin: NULL_ORIGIN, url }, disabledEnv());
      expect(opts.origin).toBe(false);
      expect(opts.credentials).toBe(false);
    }
  });

  // THE core invariant.
  it('NEVER sets credentials for a null origin — any path, any flag state', () => {
    for (const env of [enabledEnv(), disabledEnv(), {} as NodeJS.ProcessEnv]) {
      for (const url of [...DEVICE_PATHS, ...EXCLUDED_PATHS, '/', undefined as unknown as string]) {
        expect(resolveCorsOptions({ origin: NULL_ORIGIN, url }, env).credentials).toBe(false);
      }
    }
  });

  it('does not treat file:// or other origins as null', () => {
    for (const origin of ['file://', 'file:///', 'FILE://x', 'NULL', 'nullish.example']) {
      const opts = resolveCorsOptions(
        { origin, url: '/api/v1/devices/auth/check' },
        enabledEnv(),
      );
      // Falls through to the browser policy (allowlist), not the device policy
      expect(opts.credentials).toBe(true);
      expect(opts.origin).toEqual([BROWSER_ORIGIN]);
    }
  });
});

describe('resolveCorsOptions — browser origins unchanged', () => {
  it('keeps the allowlist and credentials in production', () => {
    const opts = resolveCorsOptions(
      { origin: BROWSER_ORIGIN, url: '/api/v1/displays' },
      enabledEnv(),
    );
    expect(opts.origin).toEqual([BROWSER_ORIGIN]);
    expect(opts.credentials).toBe(true);
    expect(opts.allowedHeaders).toContain('X-CSRF-Token');
  });

  it('keeps credentials for a browser origin on a device path', () => {
    const opts = resolveCorsOptions(
      { origin: BROWSER_ORIGIN, url: '/api/v1/devices/pairing/status/A1' },
      enabledEnv(),
    );
    expect(opts.origin).toEqual([BROWSER_ORIGIN]);
    expect(opts.credentials).toBe(true);
  });

  it('allows all origins in development, as before', () => {
    const opts = resolveCorsOptions(
      { origin: 'http://localhost:3001', url: '/api/v1/displays' },
      { NODE_ENV: 'development', CORS_ORIGIN: BROWSER_ORIGIN },
    );
    expect(opts.origin).toBe(true);
    expect(opts.credentials).toBe(true);
  });

  it('applies the browser policy when no Origin header is present', () => {
    const opts = resolveCorsOptions(
      { origin: undefined, url: '/api/v1/devices/auth/check' },
      enabledEnv(),
    );
    expect(opts.credentials).toBe(true);
  });
});

describe('createCorsDelegate', () => {
  it('reads the origin header and url from the request', (done) => {
    const delegate = createCorsDelegate(enabledEnv());
    delegate(
      { headers: { origin: NULL_ORIGIN }, originalUrl: '/api/v1/devices/auth/check?x=1' },
      (err, options) => {
        expect(err).toBeNull();
        expect(options?.origin).toBe(NULL_ORIGIN);
        expect(options?.credentials).toBe(false);
        done();
      },
    );
  });

  it('falls back to req.url when originalUrl is absent', (done) => {
    const delegate = createCorsDelegate(enabledEnv());
    delegate({ headers: { origin: NULL_ORIGIN }, url: '/api/v1/devices/auth/check' }, (_e, options) => {
      expect(options?.origin).toBe(NULL_ORIGIN);
      done();
    });
  });

  it('ignores a non-string origin header', (done) => {
    const delegate = createCorsDelegate(enabledEnv());
    delegate(
      { headers: { origin: ['null', 'null'] }, url: '/api/v1/devices/auth/check' },
      (_e, options) => {
        expect(options?.credentials).toBe(true); // browser policy, not device policy
        done();
      },
    );
  });
});
