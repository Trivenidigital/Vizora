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
