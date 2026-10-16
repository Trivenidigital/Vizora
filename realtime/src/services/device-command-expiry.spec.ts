import {
  DEVICE_COMMAND_MAX_AGE_MS,
  DEVICE_COMMAND_MAX_FUTURE_SKEW_MS,
  deviceCommandRemainingTtlSeconds,
  getDeviceCommandExpiry,
  isDeviceCommandExpired,
} from './device-command-expiry';

describe('device command expiry', () => {
  const now = Date.parse('2026-10-16T12:00:00.000Z');
  const createdAgo = (ms: number) => ({ timestamp: new Date(now - ms).toISOString() });

  it('matches the 300s Redis queue TTL', () => {
    expect(DEVICE_COMMAND_MAX_AGE_MS).toBe(300_000);
  });

  it('a just-created command is fresh', () => {
    expect(getDeviceCommandExpiry(createdAgo(0), now)).toEqual({ expired: false, ageMs: 0 });
  });

  it('just under the limit is fresh', () => {
    expect(isDeviceCommandExpired(createdAgo(DEVICE_COMMAND_MAX_AGE_MS - 1), now)).toBe(false);
  });

  it('exactly at the limit is expired', () => {
    expect(getDeviceCommandExpiry(createdAgo(DEVICE_COMMAND_MAX_AGE_MS), now)).toEqual({
      expired: true,
      reason: 'too_old',
      ageMs: DEVICE_COMMAND_MAX_AGE_MS,
    });
  });

  it('just over the limit is expired', () => {
    expect(isDeviceCommandExpired(createdAgo(DEVICE_COMMAND_MAX_AGE_MS + 1), now)).toBe(true);
  });

  it.each([
    ['missing', {}],
    ['undefined', { timestamp: undefined }],
    ['non-string (epoch number)', { timestamp: now as unknown as string }],
    ['unparseable', { timestamp: 'not-a-date' }],
    ['empty string', { timestamp: '' }],
  ])('a %s timestamp is expired as no_valid_timestamp (fail closed)', (_label, command) => {
    expect(getDeviceCommandExpiry(command, now)).toEqual({ expired: true, reason: 'no_valid_timestamp' });
  });

  it('a timestamp beyond the future-skew guard is expired as no_valid_timestamp', () => {
    expect(getDeviceCommandExpiry(createdAgo(-(DEVICE_COMMAND_MAX_FUTURE_SKEW_MS + 1)), now)).toEqual({
      expired: true,
      reason: 'no_valid_timestamp',
    });
  });

  it.each([
    [0, 300],
    [200_000, 100],
    [200_001, 100], // rounds UP: never reaps a command before its age limit
    [299_500, 1],
    [DEVICE_COMMAND_MAX_AGE_MS, 1], // floor of 1s — EXPIRE 0 would delete the key
    [-30_000, 330], // within the future-skew guard: the age check keeps it for 330s
  ])('remaining TTL for a command aged %dms is %ds', (ageMs, ttl) => {
    expect(deviceCommandRemainingTtlSeconds(ageMs)).toBe(ttl);
  });

  it('a timestamp within the future-skew guard is fresh', () => {
    expect(isDeviceCommandExpired(createdAgo(-DEVICE_COMMAND_MAX_FUTURE_SKEW_MS), now)).toBe(false);
  });
});
