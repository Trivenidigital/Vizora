/**
 * Cryptographic helpers for MFA (auth #2). Standalone (no NestJS imports) so
 * the service and its tests can import without a DI graph.
 *
 * Two independent secrets:
 *  1. TOTP secret encryption — AES-256-GCM keyed off MFA_ENCRYPTION_KEY. The
 *     base32 TOTP secret is encrypted at rest; plaintext exists only transiently
 *     in memory during enroll/verify. FAIL-CLOSED: a missing/short key throws,
 *     so any MFA operation refuses to run rather than persist a plaintext secret.
 *  2. MFA challenge/enrollment token signing — a key DERIVED from JWT_SECRET via
 *     HMAC with a fixed label. Tokens signed with this key can NEVER be verified
 *     under JWT_SECRET, so an MFA token presented as an access token fails
 *     signature verification in JwtStrategy before `validate()` is even reached.
 *     This is the PRIMARY guarantee that a challenge/enrollment token cannot be
 *     used as a session token (the explicit type check in JwtStrategy is
 *     belt-and-suspenders on top).
 */
import * as crypto from 'crypto';

const MIN_ENCRYPTION_KEY_LENGTH = 32;
const GCM_IV_BYTES = 12;
const MFA_TOKEN_SECRET_LABEL = 'vizora-mfa-token-v1';

/**
 * Resolve the 32-byte AES key from MFA_ENCRYPTION_KEY. Fail-closed: throws if
 * the env var is missing or shorter than 32 chars. sha256 normalizes any
 * sufficiently-long input to exactly 32 bytes.
 */
function getEncryptionKey(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw || raw.length < MIN_ENCRYPTION_KEY_LENGTH) {
    throw new Error(
      `MFA_ENCRYPTION_KEY must be set and at least ${MIN_ENCRYPTION_KEY_LENGTH} characters to use MFA`,
    );
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

/** True when a usable MFA_ENCRYPTION_KEY is configured (for fail-closed guards). */
export function isMfaEncryptionConfigured(): boolean {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  return typeof raw === 'string' && raw.length >= MIN_ENCRYPTION_KEY_LENGTH;
}

/** Encrypt a TOTP secret. Returns `iv:tag:ciphertext` (all hex). */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(GCM_IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

/** Decrypt an `iv:tag:ciphertext` payload produced by encryptSecret. */
export function decryptSecret(payload: string): string {
  const key = getEncryptionKey();
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted MFA secret');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * Signing secret for MFA challenge/enrollment JWTs, derived from JWT_SECRET.
 * Cryptographically independent of the access-token key: an attacker cannot
 * derive it without JWT_SECRET, and JwtStrategy (which verifies with JWT_SECRET)
 * cannot verify a token signed with it.
 */
export function getMfaTokenSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < MIN_ENCRYPTION_KEY_LENGTH) {
    throw new Error('JWT_SECRET must be set to issue MFA tokens');
  }
  return crypto.createHmac('sha256', jwtSecret).update(MFA_TOKEN_SECRET_LABEL).digest('hex');
}

/** Normalize a backup code (strip separators, lowercase) before hashing/compare. */
export function normalizeBackupCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/** SHA-256 hex of a normalized backup code (what we store — never the plaintext). */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(normalizeBackupCode(code)).digest('hex');
}
