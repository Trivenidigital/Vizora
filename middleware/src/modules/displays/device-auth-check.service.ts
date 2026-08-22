import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import {
  DeviceJwtPayload,
  deviceTokenGraceKey,
  hashDeviceToken,
  isCurrentDeviceToken,
  isGraceAcceptedDeviceToken,
} from '../common/device-token-auth.util';
import {
  extractUnverifiedDeviceClaim,
  shouldEmitClaimTelemetry,
  takeClaimSuppressionNotice,
} from './unverified-credential-claim';

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
  private readonly logger = new Logger(DeviceAuthCheckService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
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
      //
      // The 401 is already decided, from the verification failure alone. Logging
      // WHICH display the sender claims to be is diagnostics only: the value is
      // decoded from a token that failed verification, so it is attacker-controlled
      // metadata, never identity. It reaches no query, no write, no branch here,
      // and — critically — no response body: the wire response stays exactly
      // `401 {"code":"AUTH_INVALID"}`.
      this.logUnverifiedClaim(token);
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
      // Signature verified here, but the token is not a usable device credential,
      // so the request is still unauthenticated and the same diagnostics-only rule
      // applies: the claim is logged, never trusted, never used for a lookup.
      this.logUnverifiedClaim(token);
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

    // Genuinely-revoked states → 410. All are durable (never transient), and all are
    // evaluated BEFORE any grace lookup so a grace record can never revive a device that
    // was deleted, moved tenants, or disabled:
    //  - row gone (deleted, incl. tenant-cascade delete)
    //  - org reassigned (device moved tenants; old binding dead)
    //  - admin-disabled (block == revoke per contract §3.1 DEVICE_REVOKED)
    if (
      !display ||
      display.organizationId !== payload.organizationId ||
      display.isDisabled
    ) {
      return { httpStatus: 410, body: { code: 'DEVICE_REVOKED' } };
    }

    // The token is not the one currently stored. That is either a genuine rotation-away
    // (re-pair / unpair → revoked) or the device is mid-rotation and still physically
    // holds the PREVIOUS token, which realtime deliberately keeps handshake-valid
    // (device-handshake-auth.ts) while it waits for `token:refresh` to be persisted.
    //
    // Without this branch the two authorities disagreed: realtime accepted the old token
    // on the socket while this endpoint answered 410, and a 410 is the one response that
    // makes the player purge its pairing state. A normal, intended rotation could
    // therefore unpair a healthy device — the mass-unpair primitive this service's own
    // header warns about.
    if (!isCurrentDeviceToken(display.jwtToken, presentedHash)) {
      // Deliberately NOT wrapped in a catch. Realtime fails CLOSED here (treats a Redis
      // error as "no grace") because rejecting a socket is harmless and retried. The same
      // posture would be actively destructive here: it would turn a Redis blip into a
      // fleet-wide 410 and unpair every device mid-rotation. So a grace-lookup failure
      // propagates as 500, exactly like the DB read above — the device reads a 5xx as
      // transport-layer and keeps its credentials. Same grace MODEL as realtime; opposite
      // failure posture, because the consequence of being wrong is not symmetric.
      // getOrThrow, NOT get: the comment above promises a lookup failure surfaces as a
      // 5xx the device reads as transport-layer. `get()` swallows errors and returns
      // null, which this code cannot distinguish from "no grace record" — so the promise
      // was not being kept and a Redis outage produced 410s instead.
      const graceRaw = await this.redis.getOrThrow(deviceTokenGraceKey(payload.sub));

      // Accepts only when the presented hash is the recorded `prev` AND the DB still
      // holds the recorded `next` — so a re-paired device (whose stored hash moved on)
      // cannot be resurrected by a stale record.
      if (!isGraceAcceptedDeviceToken(graceRaw, presentedHash, display.jwtToken)) {
        return { httpStatus: 410, body: { code: 'DEVICE_REVOKED' } };
      }
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

  /**
   * Diagnostics-only. Emits at most one line per distinct claim per 15 minutes and
   * at most 20 lines per 15 minutes overall, so an attacker cannot flood the log by
   * minting invalid tokens with varying `sub`. Never the `device=<id> AUTH_INVALID`
   * shape — that reads as authenticated attribution, which this value is not.
   * Only the sanitised claim is logged: never the token, a segment of it, or a hash.
   */
  private logUnverifiedClaim(token: string): void {
    const claim = extractUnverifiedDeviceClaim(token);
    if (!claim) return; // nothing decodable — the existing 401 line stands alone
    const now = Date.now();
    if (shouldEmitClaimTelemetry(claim, now)) {
      this.logger.warn(
        `unverified_credential_claim deviceClaim=${claim} reason=AUTH_INVALID note=unauthenticated-claim-not-attribution`,
      );
    } else if (takeClaimSuppressionNotice(now)) {
      this.logger.warn(
        'unverified_credential_claim_suppressed reason=rate-limit note=claim-values-withheld',
      );
    }
  }
}
