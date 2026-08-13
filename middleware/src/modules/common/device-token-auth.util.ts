import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';

export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export interface DeviceJwtPayload {
  sub: string;
  deviceIdentifier: string;
  organizationId: string;
  type: 'device';
}

export interface VerifiedCurrentDeviceToken {
  payload: DeviceJwtPayload;
  token: string;
  tokenHash: string;
}

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isCurrentDeviceToken(
  storedHash: string | null | undefined,
  presentedHash: string,
): boolean {
  if (
    !storedHash ||
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

/**
 * Device-JWT rotation grace (PR-8) — the record realtime writes when it rotates a
 * near-expiry device token.
 *
 * The gateway rotates `Display.jwtToken` to hash(newToken) IMMEDIATELY, but the device
 * may not have persisted the new token yet. The record keeps the old token acceptable
 * for a bounded window:
 *   prev — hash of the token the device physically still holds (the old one)
 *   next — hash the stored token was rotated TO (must still equal Display.jwtToken)
 *
 * Binding acceptance to `next === Display.jwtToken` is what keeps revocation honest: a
 * re-pair (or any other change to the stored hash) makes `next` stale, and the old token
 * is rejected again. The grace only ever revives the exact prev→next rotation it recorded.
 *
 * These are a deliberate mirror of realtime/src/gateways/device-token-hash.ts — the SAME
 * model, not a second one. `device-token-auth.util.spec.ts` imports realtime's
 * implementation directly and asserts both agree case for case, so a divergence fails a
 * test rather than stranding a fleet. (The two copies exist because consolidating into
 * @vizora/database would force realtime to rebuild and redeploy; see the PR body.)
 */
export interface DeviceTokenGrace {
  prev: string;
  next: string;
}

export function deviceTokenGraceKey(deviceId: string): string {
  return `device:token:grace:${deviceId}`;
}

/**
 * True only when the presented hash is the recorded `prev` AND the DB still holds the
 * recorded `next`. Any malformed/absent record is simply "no grace" — this function is
 * pure and never decides revocation on its own; the caller does, and only after the
 * durable revocation checks have already passed.
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

export function getDeviceTokenFromRequest(
  req: Request,
  options: { allowQueryToken?: boolean } = {},
): string {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : undefined;
  const queryToken = options.allowQueryToken && typeof req.query?.token === 'string'
    ? req.query.token
    : undefined;
  const token = bearerToken || queryToken;

  if (!token) {
    throw new UnauthorizedException('Device authentication required');
  }

  return token;
}

export async function verifyCurrentDeviceToken(params: {
  jwtService: JwtService;
  databaseService: DatabaseService;
  token: string;
  expectedDisplayId?: string;
}): Promise<VerifiedCurrentDeviceToken> {
  let payload: DeviceJwtPayload;
  try {
    payload = params.jwtService.verify<DeviceJwtPayload>(params.token, {
      secret: process.env.DEVICE_JWT_SECRET,
      algorithms: ['HS256'],
    });
  } catch {
    throw new UnauthorizedException('Invalid or expired device token');
  }

  if (
    payload.type !== 'device' ||
    typeof payload.sub !== 'string' ||
    payload.sub.trim() === '' ||
    typeof payload.deviceIdentifier !== 'string' ||
    payload.deviceIdentifier.trim() === '' ||
    typeof payload.organizationId !== 'string' ||
    payload.organizationId.trim() === ''
  ) {
    throw new UnauthorizedException('Invalid token type');
  }

  if (params.expectedDisplayId && payload.sub !== params.expectedDisplayId) {
    throw new UnauthorizedException('Device token does not match requested display');
  }

  const tokenHash = hashDeviceToken(params.token);
  const display = await params.databaseService.display.findUnique({
    where: { id: payload.sub },
    select: { id: true, organizationId: true, isDisabled: true, jwtToken: true },
  });

  if (
    !display ||
    display.organizationId !== payload.organizationId ||
    display.isDisabled ||
    !isCurrentDeviceToken(display.jwtToken, tokenHash)
  ) {
    throw new UnauthorizedException('Device is not authorized');
  }

  return { payload, token: params.token, tokenHash };
}
