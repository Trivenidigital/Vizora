import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { hashDeviceToken } from '../common/device-token-auth.util';

/**
 * Per-device-token rate limiter for GET /devices/me/content.
 *
 * Same reasoning as DeviceAuthCheckThrottlerGuard, and the same trap: the default
 * ThrottlerGuard keys on client IP, so every screen in a store shares one bucket. This
 * endpoint's limit is defined per device — a device pulls on connect and again whenever
 * the reconcile signal fires — so the bucket must be keyed on the device, not the site.
 *
 * The arithmetic is not hypothetical. On a deploy every device pulls twice inside one
 * 60s window (pull-on-connect, then the empty-version reconcile one heartbeat later), so
 * 24 devices behind a single NAT produce 48 requests against a limit of 40 and the last
 * of them are throttled. The client treats a 429 exactly like any other non-2xx — warn,
 * keep last-known-good, no retry — so the failure is silent until the next reconcile.
 *
 * Requests with no bearer token fall back to IP so unauthenticated floods stay bounded.
 * This composes with the global IP-keyed ThrottlerGuard; both must pass.
 */
@Injectable()
export class DeviceMeThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        return `device-me:${hashDeviceToken(token)}`;
      }
    }
    return `device-me-ip:${req.ip ?? 'unknown'}`;
  }
}
