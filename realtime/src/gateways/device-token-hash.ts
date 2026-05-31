import { createHash, timingSafeEqual } from 'node:crypto';

export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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
