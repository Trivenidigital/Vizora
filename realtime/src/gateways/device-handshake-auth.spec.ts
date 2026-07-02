import { authenticateDeviceHandshake, DeviceHandshakeDeps } from './device-handshake-auth';
import { hashDeviceToken } from './device-token-hash';

/**
 * Contract v1.1 item 2 — handshake auth decision. Asserts the transport-vs-
 * application split: a transient condition NEVER yields a structured terminal
 * code, expiry != revocation, and a DB failure passes through (transport-layer).
 */
describe('authenticateDeviceHandshake', () => {
  const DEVICE_SECRET = 'd'.repeat(32);
  const USER_SECRET = 'u'.repeat(32);
  const TOKEN = 'the.device.token';
  const devicePayload = {
    sub: 'display-1',
    deviceIdentifier: 'dev-1',
    organizationId: 'org-1',
    type: 'device' as const,
  };

  const makeDeps = (over: {
    verify?: jest.Mock;
    findUnique?: jest.Mock;
  } = {}): DeviceHandshakeDeps => ({
    jwtService: { verify: over.verify ?? jest.fn() } as any,
    databaseService: {
      display: { findUnique: over.findUnique ?? jest.fn() },
    } as any,
    deviceSecret: DEVICE_SECRET,
    userSecret: USER_SECRET,
  });

  const currentDisplay = (o: Record<string, unknown> = {}) => ({
    organizationId: 'org-1',
    isDisabled: false,
    jwtToken: hashDeviceToken(TOKEN),
    organization: { subscriptionStatus: 'active' },
    ...o,
  });

  it('passes through when there is no auth.token (dashboard/cookie path)', async () => {
    const r = await authenticateDeviceHandshake(undefined, makeDeps());
    expect(r).toEqual({ action: 'pass' });
  });

  it('accepts a valid, current device and returns payload + token hash', async () => {
    const verify = jest.fn().mockReturnValue(devicePayload);
    const findUnique = jest.fn().mockResolvedValue(currentDisplay());
    const r = await authenticateDeviceHandshake(TOKEN, makeDeps({ verify, findUnique }));
    expect(r).toEqual({
      action: 'accept',
      payload: devicePayload,
      tokenHash: hashDeviceToken(TOKEN),
    });
  });

  it('rejects an expired device token with AUTH_EXPIRED (never DEVICE_REVOKED)', async () => {
    const verify = jest.fn().mockImplementation((_t, opts) => {
      // device secret path throws expired; user secret path also throws
      const e = new Error('jwt expired');
      e.name = 'TokenExpiredError';
      throw e;
    });
    const r = await authenticateDeviceHandshake(TOKEN, makeDeps({ verify }));
    expect(r).toEqual({ action: 'reject', message: 'auth_expired', code: 'AUTH_EXPIRED' });
  });

  it('rejects a bad-signature token with AUTH_INVALID (never DEVICE_REVOKED)', async () => {
    const verify = jest.fn().mockImplementation(() => {
      const e = new Error('invalid signature');
      e.name = 'JsonWebTokenError';
      throw e;
    });
    const r = await authenticateDeviceHandshake('garbage', makeDeps({ verify }));
    expect(r).toEqual({ action: 'reject', message: 'auth_invalid', code: 'AUTH_INVALID' });
  });

  it('NO structured-rejection message contains a pre-fix-APK wipe substring', async () => {
    // The pre-fix TV build wiped credentials on
    // connect_error.message.includes('unauthorized' | 'invalid token').
    // Every legacy message we emit for a structured rejection must be clear of
    // both, so a pre-fix APK (if one ever connected) would not self-de-pair.
    const WIPE_SUBSTRINGS = ['unauthorized', 'invalid token'];
    const rejections = await Promise.all([
      // expired
      authenticateDeviceHandshake(TOKEN, makeDeps({
        verify: jest.fn().mockImplementation(() => { const e = new Error('x'); e.name = 'TokenExpiredError'; throw e; }),
      })),
      // bad signature
      authenticateDeviceHandshake('garbage', makeDeps({
        verify: jest.fn().mockImplementation(() => { const e = new Error('x'); e.name = 'JsonWebTokenError'; throw e; }),
      })),
      // revoked
      authenticateDeviceHandshake(TOKEN, makeDeps({
        verify: jest.fn().mockReturnValue(devicePayload),
        findUnique: jest.fn().mockResolvedValue(null),
      })),
      // suspended
      authenticateDeviceHandshake(TOKEN, makeDeps({
        verify: jest.fn().mockReturnValue(devicePayload),
        findUnique: jest.fn().mockResolvedValue(currentDisplay({ organization: { subscriptionStatus: 'suspended' } })),
      })),
    ]);
    for (const r of rejections) {
      expect(r.action).toBe('reject');
      const msg = (r as { message: string }).message.toLowerCase();
      for (const bad of WIPE_SUBSTRINGS) {
        expect(msg.includes(bad)).toBe(false);
      }
    }
  });

  it('rejects a deleted device with DEVICE_REVOKED', async () => {
    const verify = jest.fn().mockReturnValue(devicePayload);
    const findUnique = jest.fn().mockResolvedValue(null);
    const r = await authenticateDeviceHandshake(TOKEN, makeDeps({ verify, findUnique }));
    expect(r).toEqual({ action: 'reject', message: 'device_token_stale', code: 'DEVICE_REVOKED' });
  });

  it('rejects a disabled device with DEVICE_REVOKED', async () => {
    const verify = jest.fn().mockReturnValue(devicePayload);
    const findUnique = jest.fn().mockResolvedValue(currentDisplay({ isDisabled: true }));
    const r = await authenticateDeviceHandshake(TOKEN, makeDeps({ verify, findUnique }));
    expect((r as any).code).toBe('DEVICE_REVOKED');
  });

  it('rejects a rotated-away token with DEVICE_REVOKED', async () => {
    const verify = jest.fn().mockReturnValue(devicePayload);
    const findUnique = jest.fn().mockResolvedValue(
      currentDisplay({ jwtToken: hashDeviceToken('newer-token') }),
    );
    const r = await authenticateDeviceHandshake(TOKEN, makeDeps({ verify, findUnique }));
    expect((r as any).code).toBe('DEVICE_REVOKED');
  });

  it('rejects a suspended tenant with TENANT_SUSPENDED (device still valid)', async () => {
    const verify = jest.fn().mockReturnValue(devicePayload);
    const findUnique = jest.fn().mockResolvedValue(
      currentDisplay({ organization: { subscriptionStatus: 'suspended' } }),
    );
    const r = await authenticateDeviceHandshake(TOKEN, makeDeps({ verify, findUnique }));
    expect(r).toEqual({ action: 'reject', message: 'tenant_suspended', code: 'TENANT_SUSPENDED' });
  });

  it('does NOT suspend active/free/canceled tenants (accept)', async () => {
    for (const status of ['active', 'free', 'canceled', 'past_due', 'trial']) {
      const verify = jest.fn().mockReturnValue(devicePayload);
      const findUnique = jest.fn().mockResolvedValue(
        currentDisplay({ organization: { subscriptionStatus: status } }),
      );
      const r = await authenticateDeviceHandshake(TOKEN, makeDeps({ verify, findUnique }));
      expect(r.action).toBe('accept');
    }
  });

  it('TRANSPORT-LAYER: a DB failure passes through (no terminal code)', async () => {
    const verify = jest.fn().mockReturnValue(devicePayload);
    const findUnique = jest.fn().mockRejectedValue(new Error('DB down'));
    const r = await authenticateDeviceHandshake(TOKEN, makeDeps({ verify, findUnique }));
    expect(r).toEqual({ action: 'pass' }); // device sees a plain connect error → transient
  });

  it('passes a valid USER token sent via auth.token to the user path (no false device reject)', async () => {
    // device-secret verify throws; user-secret verify succeeds with a non-device token
    const verify = jest.fn().mockImplementation((_t: string, opts: { secret: string }) => {
      if (opts.secret === DEVICE_SECRET) {
        const e = new Error('invalid signature');
        e.name = 'JsonWebTokenError';
        throw e;
      }
      return { sub: 'user-1', type: 'user' };
    });
    const r = await authenticateDeviceHandshake('a-user-token', makeDeps({ verify }));
    expect(r).toEqual({ action: 'pass' });
  });
});
