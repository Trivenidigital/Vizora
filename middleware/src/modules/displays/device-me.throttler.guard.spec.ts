import { DeviceMeThrottlerGuard } from './device-me.throttler.guard';
import { hashDeviceToken } from '../common/device-token-auth.util';

/**
 * The bucket must be keyed on the DEVICE, not the site. Two screens in one shop share a
 * public IP; an IP-keyed bucket makes them compete for the same allowance, and a deploy
 * has every device pulling twice inside one window (pull-on-connect, then the
 * empty-version reconcile a heartbeat later). 24 devices behind one NAT is 48 requests
 * against a limit of 40, and the client treats the resulting 429 exactly like any other
 * non-2xx — warn, keep last-known-good, no retry.
 */
describe('DeviceMeThrottlerGuard — per-device-token, not per-IP', () => {
  const guard = new DeviceMeThrottlerGuard({} as any, {} as any, {} as any);
  const tracker = (req: any) => (guard as any).getTracker(req);

  it('keys on the presented device token, so two devices behind one IP get separate buckets', async () => {
    const ip = '203.0.113.7';
    const a = await tracker({ headers: { authorization: 'Bearer token-device-a' }, ip });
    const b = await tracker({ headers: { authorization: 'Bearer token-device-b' }, ip });

    expect(a).not.toBe(b);
    expect(a).toContain(hashDeviceToken('token-device-a'));
    expect(b).toContain(hashDeviceToken('token-device-b'));
  });

  it('gives the same device the same bucket even when its IP changes', async () => {
    const first = await tracker({ headers: { authorization: 'Bearer token-device-a' }, ip: '203.0.113.7' });
    const second = await tracker({ headers: { authorization: 'Bearer token-device-a' }, ip: '198.51.100.2' });
    expect(first).toBe(second);
  });

  it('never puts the raw token in the bucket key', async () => {
    const key = await tracker({ headers: { authorization: 'Bearer super-secret-token' }, ip: '203.0.113.7' });
    expect(key).not.toContain('super-secret-token');
  });

  it('falls back to IP when there is no bearer token, so unauthenticated floods stay bounded', async () => {
    const key = await tracker({ headers: {}, ip: '203.0.113.7' });
    expect(key).toBe('device-me-ip:203.0.113.7');
  });

  it('falls back to IP for a malformed or empty bearer', async () => {
    expect(await tracker({ headers: { authorization: 'Bearer   ' }, ip: '203.0.113.7' })).toBe('device-me-ip:203.0.113.7');
    expect(await tracker({ headers: { authorization: 'Basic abc' }, ip: '203.0.113.7' })).toBe('device-me-ip:203.0.113.7');
  });
});
