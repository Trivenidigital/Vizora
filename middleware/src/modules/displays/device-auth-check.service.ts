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
  sanitiseUnverifiedPeer,
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

  /**
   * `clientIp` is diagnostics-only and OPTIONAL — it reaches nothing but a log line
   * and no verdict depends on it. Callers pass `req.ip`, which Express resolves
   * through `trust proxy` (TRUST_PROXY_HOPS), so unlike realtime's socket address it
   * is the client rather than nginx.
   */
  async evaluate(token: string, clientIp?: string): Promise<DeviceAuthCheckResult> {
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
      this.logUnverifiedClaim(token, clientIp);
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
      // Deliberately NO claim telemetry here, and this is not an oversight. The
      // signature verified on this branch, so `payload.sub` is signature-backed —
      // logging it under the `attribution=unauthenticated-claim` marker would file a
      // trusted value under the untrusted one, blurring the distinction this telemetry
      // exists to keep sharp, and inviting a future reader to generalise from it.
      // (It matches realtime, which also emits nothing on its equivalent branch.)
      // Telemetry for structurally-invalid-but-SIGNED tokens would need its own
      // marker with trusted-attribution semantics; that is not this mechanism.
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
   * Diagnostics-only, and the realtime handshake's counterpart line (same fields,
   * same trust rules, same sanitisation, same budget).
   *
   * Called from ONE site: the `jwt.verify` catch block, i.e. verification actually
   * failed. Never from the payload-shape branch below it, where the signature DID
   * verify — see the comment there.
   *
   * There is deliberately no trusted `device=` field here: this endpoint has no
   * verified identity to report on an AUTH_INVALID, and `claimedDeviceId` must never
   * be mistaken for one — which is what `attribution=unauthenticated-claim` states in
   * the line itself. Nothing is logged when no claim decodes, so an undecodable token
   * leaves behaviour exactly as it was.
   *
   * The budget bounds how much attacker-controlled text reaches the logs AT ALL, not
   * merely at what level: over budget nothing is emitted here, because prod runs with
   * debug enabled and "log it at debug instead" would still let anyone write unbounded
   * `claimedDeviceId=` values by minting invalid tokens. Only the sanitised claim is
   * ever logged — never the token, a segment of it, or a hash.
   *
   * The budget is PER PROCESS: state is module-level and middleware runs 2 PM2 cluster
   * instances, so the effective ceiling is ~40 per 15 minutes fleet-wide and the dedupe
   * maps are independent — the same claim can legitimately be warned once per worker in
   * one window. Same caveat as the MCP in-memory rate limit. A duplicate line is not a
   * bug.
   */
  private logUnverifiedClaim(token: string, clientIp?: string): void {
    // Diagnostics must never fail the auth path. This is the first statement in the
    // `jwt.verify` catch block that could throw, and a logger CAN throw (EPIPE on a
    // closed stdout, a future custom transport) — which would turn a settled
    // `401 AUTH_INVALID` into a 5xx for a whole class of input. Same promise the
    // extraction module makes one layer down.
    try {
      // A USER access token presented here fails the DEVICE verify and lands in this
      // branch, so without this check a dashboard or mobile client pointed at the wrong
      // endpoint would put REAL USER IDS into warn logs under a field named
      // `claimedDeviceId` — and one misconfigured client would burn the shared budget.
      // Realtime never has this problem: it returns `pass` for a valid user token
      // before extraction. This mirrors that, and is the one input where the two copies
      // of this mechanism would otherwise diverge. The 401 is unaffected: a user token
      // is still not a device credential.
      if (this.isValidUserToken(token)) return;

      const claim = extractUnverifiedDeviceClaim(token);
      if (!claim) return;
      const now = Date.now();
      if (shouldEmitClaimTelemetry(claim, now)) {
        // `clientIp=` (not realtime's `peer=`): Express resolves `req.ip` through
        // `trust proxy`, so this is the client rather than the nginx in front of it.
        // The source matters because a forged `claimedDeviceId` naming a real customer
        // display is otherwise indistinguishable from that display misbehaving.
        const peer = sanitiseUnverifiedPeer(clientIp);
        this.logger.warn(
          `device_auth_check_reject code=AUTH_INVALID claimedDeviceId=${claim}` +
            ` attribution=unauthenticated-claim clientIp=${peer ?? 'unknown'}`,
        );
        return;
      }
      const suppressedCount = takeClaimSuppressionNotice(now);
      if (suppressedCount !== null) {
        // No claim value, and a COUNT so an operator can tell incidental budget
        // exhaustion from an active flood — without it, a quiet warn stream is
        // ambiguous between "nothing is happening" and "attribution is degraded".
        this.logger.warn(
          `unverified_credential_claim_suppressed reason=rate-limit suppressed=${suppressedCount} note=claim-values-withheld`,
        );
      }
    } catch {
      // Intentionally empty — the 401 is the contract, not the log.
    }
  }

  /**
   * Mirrors `isValidUserToken` in realtime's `device-handshake-auth.ts`. Used ONLY to
   * suppress diagnostics — it grants nothing and changes no verdict.
   */
  private isValidUserToken(token: string): boolean {
    try {
      const user = this.jwtService.verify<{ type?: string }>(token, {
        secret: process.env.JWT_SECRET,
        algorithms: ['HS256'],
      });
      return user.type !== 'device';
    } catch {
      return false;
    }
  }
}
