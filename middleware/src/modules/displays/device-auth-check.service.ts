import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import {
  DeviceJwtPayload,
  hashDeviceToken,
  isCurrentDeviceToken,
} from '../common/device-token-auth.util';

/**
 * Device Revocation Contract v1.1 item 4 — the SOLE authority for device
 * credential destruction. The device purges its credentials only on a `410`
 * from this evaluation, so a false/forged 410 is a remote mass-unpair primitive.
 *
 * Invariants (each is negatively tested):
 *  - `410 DEVICE_REVOKED` is reachable ONLY when the specific device named by the
 *    presented token is genuinely revoked (deleted / disabled / org reassigned /
 *    token rotated away). Never for a transient condition.
 *  - A merely expired token → `401 AUTH_EXPIRED`, never 410.
 *  - A malformed / bad-signature / wrong-type token → `401 AUTH_INVALID`, never 410.
 *  - Any infrastructure failure (DB down, timeout) MUST propagate as an exception
 *    → 500, so the device treats it as transport-layer and keeps its credentials.
 *    This service therefore never wraps the DB read in a catch that returns a code.
 */

export type DeviceAuthCheckResult =
  | { httpStatus: 200; body: { status: 'ok' } }
  | { httpStatus: 401; body: { code: 'AUTH_EXPIRED' | 'AUTH_INVALID' } }
  | { httpStatus: 403; body: { code: 'TENANT_SUSPENDED' } }
  | { httpStatus: 410; body: { code: 'DEVICE_REVOKED' } };

@Injectable()
export class DeviceAuthCheckService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
  ) {}

  async evaluate(token: string): Promise<DeviceAuthCheckResult> {
    // 1. Signature / expiry. Only jwt.verify is caught — expiry vs invalid.
    let payload: DeviceJwtPayload;
    try {
      payload = this.jwtService.verify<DeviceJwtPayload>(token, {
        secret: process.env.DEVICE_JWT_SECRET,
        algorithms: ['HS256'],
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'TokenExpiredError') {
        return { httpStatus: 401, body: { code: 'AUTH_EXPIRED' } };
      }
      // NotBeforeError, JsonWebTokenError (bad signature/malformed), etc.
      return { httpStatus: 401, body: { code: 'AUTH_INVALID' } };
    }

    // 2. Payload shape. A structurally wrong token is invalid, not revoked.
    if (
      payload.type !== 'device' ||
      typeof payload.sub !== 'string' ||
      payload.sub.trim() === '' ||
      typeof payload.organizationId !== 'string' ||
      payload.organizationId.trim() === ''
    ) {
      return { httpStatus: 401, body: { code: 'AUTH_INVALID' } };
    }

    // 3. Live DB state. NOT wrapped in try/catch — a DB failure must surface as
    //    500 so the device treats it as transport-layer (no purge).
    const display = await this.db.display.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        organizationId: true,
        isDisabled: true,
        jwtToken: true,
        organization: { select: { subscriptionStatus: true } },
      },
    });

    const presentedHash = hashDeviceToken(token);

    // Genuinely-revoked states → 410. All are durable (never transient):
    //  - row gone (deleted, incl. tenant-cascade delete)
    //  - org reassigned (device moved tenants; old binding dead)
    //  - admin-disabled (block == revoke per contract §3.1 DEVICE_REVOKED)
    //  - token rotated away (re-pair/unpair issued a new hash)
    if (
      !display ||
      display.organizationId !== payload.organizationId ||
      display.isDisabled ||
      !isCurrentDeviceToken(display.jwtToken, presentedHash)
    ) {
      return { httpStatus: 410, body: { code: 'DEVICE_REVOKED' } };
    }

    // 4. Device is genuinely valid. Entitlement suspension is a REVERSIBLE state
    //    that keeps credentials (device holds, does not purge). Gated on an
    //    explicit 'suspended' status that today's enum does not contain, so this
    //    never fires until the entitlement slice introduces it — avoiding false
    //    darkening of free/canceled-but-downgraded tenants that still get service.
    if (display.organization?.subscriptionStatus === 'suspended') {
      return { httpStatus: 403, body: { code: 'TENANT_SUSPENDED' } };
    }

    return { httpStatus: 200, body: { status: 'ok' } };
  }
}
