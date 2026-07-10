import { createHash, timingSafeEqual } from 'node:crypto';

export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Device-JWT 90d refresh (PR-8) — grace record for the in-flight token rotation.
 *
 * When the gateway mints a fresh 90d token for a near-expiry device it rotates
 * `Display.jwtToken` to hash(newToken) immediately, but the device may not have
 * persisted the new token yet (it could reconnect on its OLD token in the tiny
 * window before it processes `token:refresh`). This grace record keeps the old
 * token acceptable for a short window so that reconnect is not rejected:
 *   prev — hash of the token the device physically still holds (the old one)
 *   next — hash we rotated the stored token TO (must still equal Display.jwtToken)
 *
 * Binding acceptance to `next === Display.jwtToken` is what keeps revocation
 * honest: if the device is re-paired (new pairing token) or its stored hash is
 * otherwise changed, `next` no longer matches and the old token is rejected —
 * the grace only ever revives the exact prev→next rotation it recorded.
 */
export const DEVICE_TOKEN_GRACE_TTL_SECONDS = 300; // 5 minutes

export interface DeviceTokenGrace {
  prev: string;
  next: string;
}

export function deviceTokenGraceKey(deviceId: string): string {
  return `device:token:grace:${deviceId}`;
}

/**
 * Decide whether a presented token hash should be accepted via an active grace
 * record. Returns true only when the presented hash is the recorded `prev` AND
 * the DB still holds the recorded `next` (no re-pair/revoke happened since).
 */
export function isGraceAcceptedDeviceToken(
  graceRaw: string | null | undefined,
  presentedHash: string,
  storedHash: string | null | undefined,
): boolean {
  if (!graceRaw) return false;
  let grace: DeviceTokenGrace;
  try {
    grace = JSON.parse(graceRaw) as DeviceTokenGrace;
  } catch {
    return false;
  }
  if (!grace || typeof grace.prev !== 'string' || typeof grace.next !== 'string') {
    return false;
  }
  return (
    isCurrentDeviceToken(grace.prev, presentedHash) &&
    isCurrentDeviceToken(storedHash, grace.next)
  );
}

export function isCurrentDeviceToken(
  storedHash: string | null | undefined,
  presentedHash: string | null | undefined,
): boolean {
  if (
    !storedHash ||
    !presentedHash ||
    !SHA256_HEX_PATTERN.test(storedHash) ||
    !SHA256_HEX_PATTERN.test(presentedHash)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(storedHash, 'hex'),
    Buffer.from(presentedHash, 'hex'),
  );
}
