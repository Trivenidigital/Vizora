import { DeviceCommand } from '../types';

/**
 * Absolute lifetime of a queued device command, measured from its CREATION time
 * (`DeviceCommand.timestamp`, stamped once by `DeviceGateway.sendCommand`).
 *
 * This is the real invariant: a command older than this is never emitted and never
 * requeued, however many times delivery was retried. The Redis queue TTL
 * (`RedisService.addDeviceCommand`) is only garbage collection — it used to be refreshed
 * on every requeue, which let a device that kept reconnecting and failing inside 5-minute
 * windows keep a stale (possibly disruptive, e.g. `reboot`) command alive indefinitely.
 */
export const DEVICE_COMMAND_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * A creation time further in the future than this cannot be proven fresh (clock skew or
 * a forged/garbled record), so the command is treated as expired.
 */
export const DEVICE_COMMAND_MAX_FUTURE_SKEW_MS = 60 * 1000;

export type DeviceCommandExpiry =
  | { expired: false; ageMs: number }
  | { expired: true; reason: 'too_old'; ageMs: number }
  | { expired: true; reason: 'no_valid_timestamp' };

/**
 * Fail closed: a missing, non-string, unparseable or far-future `timestamp` is EXPIRED —
 * such a command may be disruptive and cannot be proven fresh. A command exactly at the
 * age limit is expired (the same instant the Redis TTL would have reaped it).
 */
export function getDeviceCommandExpiry(command: Pick<DeviceCommand, 'timestamp'>, nowMs: number): DeviceCommandExpiry {
  const timestamp: unknown = command?.timestamp;
  if (typeof timestamp !== 'string') {
    return { expired: true, reason: 'no_valid_timestamp' };
  }
  const createdAtMs = Date.parse(timestamp);
  if (!Number.isFinite(createdAtMs)) {
    return { expired: true, reason: 'no_valid_timestamp' };
  }
  const ageMs = nowMs - createdAtMs;
  if (ageMs < -DEVICE_COMMAND_MAX_FUTURE_SKEW_MS) {
    return { expired: true, reason: 'no_valid_timestamp' };
  }
  if (ageMs >= DEVICE_COMMAND_MAX_AGE_MS) {
    return { expired: true, reason: 'too_old', ageMs };
  }
  return { expired: false, ageMs };
}

export function isDeviceCommandExpired(command: Pick<DeviceCommand, 'timestamp'>, nowMs: number): boolean {
  return getDeviceCommandExpiry(command, nowMs).expired;
}
