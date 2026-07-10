import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { hashDeviceToken } from '../common/device-token-auth.util';

/**
 * Per-device-token rate limiter for GET /devices/auth/check (Contract v1.1 item 4).
 *
 * The default ThrottlerGuard keys on client IP, which would let many devices
 * behind one NAT share (and exhaust) a single bucket, and would let one device
 * dodge the limit by changing IP. The auth/check endpoint's rate is defined
 * *per token* (1/30s, burst 2), so we key the bucket on the presented token's
 * SHA-256. Requests with no bearer token fall back to IP so unauthenticated
 * floods are still bounded.
 *
 * This composes with the global IP-keyed ThrottlerGuard (aggregate protection
 * against reconnect-storm thundering herds) — both must pass.
 */
@Injectable()
export class DeviceAuthCheckThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        return `device-authcheck:${hashDeviceToken(token)}`;
      }
    }
    return `device-authcheck-ip:${req.ip ?? 'unknown'}`;
  }
}
