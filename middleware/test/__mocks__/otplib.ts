/**
 * Faithful RFC-6238 TOTP test double for `otplib` (auth #2).
 *
 * Why this exists: otplib v13 and its transitive deps (@scure/base, @noble/*)
 * are pure ESM and, under pnpm's `.pnpm/` layout, cannot be loaded by Jest's
 * CommonJS runtime. Rather than reconfigure the shared transform pipeline for
 * the whole suite, jest.config.js maps `otplib` to this module for tests only.
 * Production code uses the real otplib.
 *
 * This implements the SAME standard algorithm the real library uses (HMAC-SHA1,
 * 6 digits, 30s step, symmetric epochTolerance in seconds), so enroll -> enable
 * -> challenge round-trips behave exactly as in production.
 */
import * as crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number, digits: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // big-endian 64-bit counter (high 32 bits are 0 for our epochs)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, '0');
}

interface GenOpts {
  secret: string;
  digits?: number;
  period?: number;
  epoch?: number; // seconds
  algorithm?: string;
}

interface VerifyOpts extends GenOpts {
  token: string;
  epochTolerance?: number | [number, number]; // seconds
}

export function generateSecret(opts?: { length?: number }): string {
  return base32Encode(crypto.randomBytes(opts?.length ?? 20));
}

export function generateURI(opts: {
  strategy?: string;
  issuer: string;
  label: string;
  secret: string;
  algorithm?: string;
  digits?: number;
  period?: number;
}): string {
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
  });
  return `otpauth://totp/${encodeURIComponent(opts.issuer)}:${encodeURIComponent(
    opts.label,
  )}?${params.toString()}`;
}

export function generateSync(opts: GenOpts): string {
  const period = opts.period ?? 30;
  const digits = opts.digits ?? 6;
  const epoch = opts.epoch ?? Math.floor(Date.now() / 1000);
  return hotp(opts.secret, Math.floor(epoch / period), digits);
}

export async function generate(opts: GenOpts): Promise<string> {
  return generateSync(opts);
}

export function verifySync(opts: VerifyOpts): { valid: boolean; delta?: number } {
  const period = opts.period ?? 30;
  const digits = opts.digits ?? 6;
  const epoch = opts.epoch ?? Math.floor(Date.now() / 1000);
  const tol = opts.epochTolerance ?? 0;
  const [past, future] = Array.isArray(tol) ? tol : [tol, tol];
  const counter = Math.floor(epoch / period);
  const backSteps = Math.floor(past / period);
  const fwdSteps = Math.floor(future / period);
  const tokenBuf = Buffer.from(opts.token);
  for (let d = -backSteps; d <= fwdSteps; d++) {
    const candidate = Buffer.from(hotp(opts.secret, counter + d, digits));
    // timingSafeEqual throws on length mismatch — guard it (a wrong-length token
    // simply can't match).
    if (candidate.length === tokenBuf.length && crypto.timingSafeEqual(candidate, tokenBuf)) {
      return { valid: true, delta: d };
    }
  }
  return { valid: false };
}

export async function verify(opts: VerifyOpts): Promise<{ valid: boolean; delta?: number }> {
  return verifySync(opts);
}
