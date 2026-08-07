import {
  resolveRealtimeCorsOptions,
  createRealtimeCorsDelegate,
  isNullOrigin,
  isNullOriginCorsEnabled,
  NULL_ORIGIN,
} from './cors-policy';

const BROWSER_ORIGIN = 'https://dashboard.vizora.io';

const enabled: NodeJS.ProcessEnv = {
  CORS_ORIGIN: BROWSER_ORIGIN,
  DEVICE_NULL_ORIGIN_CORS: 'enabled',
};
const disabled: NodeJS.ProcessEnv = { CORS_ORIGIN: BROWSER_ORIGIN };

// These mirror middleware/src/common/cors/cors-policy.spec.ts on purpose: the
// two services own separate copies of the policy, so the shared invariants are
// asserted in BOTH suites and cannot silently diverge.
describe('isNullOriginCorsEnabled (fail-closed)', () => {
  it('is disabled when absent', () => {
    expect(isNullOriginCorsEnabled({})).toBe(false);
  });

  it.each(['', 'true', '1', 'ENABLED', 'disabled'])('is disabled for %p', (value) => {
    expect(isNullOriginCorsEnabled({ DEVICE_NULL_ORIGIN_CORS: value })).toBe(false);
  });

  it('is enabled only for the exact string', () => {
    expect(isNullOriginCorsEnabled({ DEVICE_NULL_ORIGIN_CORS: 'enabled' })).toBe(true);
  });
});

describe('isNullOrigin', () => {
  it('matches only the exact value "null"', () => {
    expect(isNullOrigin('null')).toBe(true);
    expect(isNullOrigin('file://')).toBe(false);
    expect(isNullOrigin('NULL')).toBe(false);
    expect(isNullOrigin(undefined)).toBe(false);
    expect(isNullOrigin('')).toBe(false);
  });
});

describe('resolveRealtimeCorsOptions', () => {
  it('echoes a null origin without credentials when enabled', () => {
    const opts = resolveRealtimeCorsOptions(NULL_ORIGIN, enabled);
    expect(opts.origin).toBe(NULL_ORIGIN);
    expect(opts.credentials).toBe(false);
  });

  it('refuses a null origin when disabled', () => {
    const opts = resolveRealtimeCorsOptions(NULL_ORIGIN, disabled);
    expect(opts.origin).toBe(false);
    expect(opts.credentials).toBe(false);
  });

  it('NEVER credentials a null origin, in either flag state', () => {
    for (const env of [enabled, disabled, {} as NodeJS.ProcessEnv]) {
      expect(resolveRealtimeCorsOptions(NULL_ORIGIN, env).credentials).toBe(false);
    }
  });

  it('keeps the credentialed allowlist for browser origins', () => {
    const opts = resolveRealtimeCorsOptions(BROWSER_ORIGIN, enabled);
    expect(opts.origin).toEqual([BROWSER_ORIGIN]);
    expect(opts.credentials).toBe(true);
  });

  it('keeps credentials when no Origin header is present', () => {
    expect(resolveRealtimeCorsOptions(undefined, enabled).credentials).toBe(true);
  });

  it('falls back to the localhost list when CORS_ORIGIN is unset', () => {
    const opts = resolveRealtimeCorsOptions(BROWSER_ORIGIN, {});
    expect(opts.origin).toEqual(
      expect.arrayContaining(['http://localhost:3001', 'http://localhost:3002']),
    );
    expect(opts.credentials).toBe(true);
  });

  it('does not treat file:// as null', () => {
    const opts = resolveRealtimeCorsOptions('file://', enabled);
    expect(opts.credentials).toBe(true);
    expect(opts.origin).toEqual([BROWSER_ORIGIN]);
  });
});

describe('createRealtimeCorsDelegate', () => {
  it('resolves per request from the origin header', (done) => {
    const delegate = createRealtimeCorsDelegate(enabled);
    delegate({ headers: { origin: NULL_ORIGIN } }, (err, options) => {
      expect(err).toBeNull();
      expect(options?.origin).toBe(NULL_ORIGIN);
      expect(options?.credentials).toBe(false);
      done();
    });
  });

  it('gives browser origins the credentialed policy', (done) => {
    const delegate = createRealtimeCorsDelegate(enabled);
    delegate({ headers: { origin: BROWSER_ORIGIN } }, (_err, options) => {
      expect(options?.credentials).toBe(true);
      done();
    });
  });
});
