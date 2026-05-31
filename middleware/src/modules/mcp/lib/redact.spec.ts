import { redactSecrets } from './redact';

describe('redactSecrets', () => {
  it.each([
    'token', 'secret', 'password', 'apiKey', 'api_key', 'webhook',
    'jwt', 'credential', 'cookie', 'sessionId', 'privateKey',
    'accessToken', 'refreshToken', 'authHeader', 'authorization',
    'email', 'phone', 'address', 'fullName',
  ])('redacts top-level key %s', (key) => {
    const out = redactSecrets({ [key]: 'sensitive', safe: 'ok' }) as Record<string, unknown>;
    expect(out[key]).toBe('[REDACTED]');
    expect(out.safe).toBe('ok');
  });

  it.each(['apiToken', 'clientSecret', 'authorType', 'monkey', 'key'])(
    'does NOT redact non-allowlisted key %s (anchored regex)',
    (key) => {
      const out = redactSecrets({ [key]: 'kept' }) as Record<string, unknown>;
      expect(out[key]).toBe('kept');
    },
  );

  it('redacts recursively inside nested objects', () => {
    const out = redactSecrets({ a: { b: { password: 'p', ok: 1 } } }) as {
      a: { b: { password: string; ok: number } };
    };
    expect(out.a.b.password).toBe('[REDACTED]');
    expect(out.a.b.ok).toBe(1);
  });

  it('redacts forbidden keys inside arrays of objects', () => {
    const out = redactSecrets({ items: [{ secret: 'a' }, { secret: 'b' }, { ok: 'c' }] }) as {
      items: Array<Record<string, unknown>>;
    };
    expect(out.items[0].secret).toBe('[REDACTED]');
    expect(out.items[1].secret).toBe('[REDACTED]');
    expect(out.items[2].ok).toBe('c');
  });

  it('leaves primitives untouched', () => {
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets('hello')).toBe('hello');
    expect(redactSecrets(null)).toBe(null);
    expect(redactSecrets(true)).toBe(true);
  });

  it('matches case-insensitively (PASSWORD == password)', () => {
    const out = redactSecrets({ PASSWORD: 'p', Token: 't' }) as Record<string, unknown>;
    expect(out.PASSWORD).toBe('[REDACTED]');
    expect(out.Token).toBe('[REDACTED]');
  });
});
