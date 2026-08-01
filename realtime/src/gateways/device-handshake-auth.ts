import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import {
  hashDeviceToken,
  isCurrentDeviceToken,
  isGraceAcceptedDeviceToken,
  deviceTokenGraceKey,
} from './device-token-hash';
import { isNullOrigin, isNullOriginCorsEnabled } from '../common/cors/cors-policy';

/**
 * Device Revocation Contract v1.1 item 2 — device handshake authentication.
 *
 * Produces the structured rejection the contract requires: on the client, a
 * rejected handshake surfaces as `connect_error.data.code`. Socket.IO only
 * populates that when a CONNECTION MIDDLEWARE calls next(err) with err.data —
 * which is why device auth must run here (a middleware), not only in
 * handleConnection (post-connection, which can emit a custom `error` event but
 * never a structured connect_error).
 *
 * Transport-vs-application split (dimension 3, contract §3): a transient server
 * condition must NEVER surface to a device as a structured terminal code.
 *  - expired token            → AUTH_EXPIRED   (device keeps cached, re-auths)
 *  - bad signature / malformed→ AUTH_INVALID   (device keeps cached, re-auths)
 *  - deleted/disabled/stale/  → DEVICE_REVOKED (device confirms via auth/check
 *    org-reassigned                            410 before purging — never purges
 *                                              on this signal alone)
 *  - org suspended            → TENANT_SUSPENDED (device holds, keeps creds)
 *  - DB / infra failure       → 'pass' with NO code → the device sees a plain
 *                               connect error → transport-layer → keeps playing
 *
 * The result is a discriminated union so the middleware wiring is trivial and
 * this decision logic is unit-testable in isolation.
 */

export interface DeviceHandshakeDeps {
  jwtService: JwtService;
  databaseService: DatabaseService;
  deviceSecret: string | undefined;
  userSecret: string | undefined;
  // Handshake Origin header, present on BOTH transports. `'null'` selects the
  // device-only authentication path (cookies ignored, device JWT required).
  // Undefined for non-browser clients (native Android, curl) — unchanged path.
  origin?: string;
  // Optional grace lookup (PR-8). When provided, a device presenting the
  // immediately-previous token during a 90d-refresh rotation is accepted via
  // the grace record instead of being rejected DEVICE_REVOKED. Omitted in unit
  // contexts that don't exercise refresh — behaviour is then unchanged.
  redis?: { get(key: string): Promise<string | null> };
}

export type DeviceHandshakeResult =
  // Not a device handshake (no auth.token) or a valid user token, or a transient
  // infra failure — let the existing handleConnection path classify it. No code.
  | { action: 'pass' }
  // Verified device — hand the payload + token hash to handleConnection so it
  // does NOT re-verify or re-query (single auth authority, no handler-stacking).
  | { action: 'accept'; payload: DeviceHandshakePayload; tokenHash: string }
  // Structured rejection. `message` carries the legacy string (so the Electron
  // client's connect_error.message logic still works); `code` is the contract code.
  | { action: 'reject'; message: string; code: DeviceHandshakeCode };

export type DeviceHandshakeCode =
  | 'AUTH_EXPIRED'
  | 'AUTH_INVALID'
  | 'DEVICE_REVOKED'
  | 'TENANT_SUSPENDED';

export interface DeviceHandshakePayload {
  sub: string;
  deviceIdentifier: string;
  organizationId: string;
  type: 'device';
  // Standard JWT expiry claim (epoch seconds), present on all 90d device tokens.
  // Carried through so the gateway can decide whether to mint a fresh token
  // without having to re-decode the raw handshake token (PR-8).
  exp?: number;
}

export async function authenticateDeviceHandshake(
  token: string | undefined,
  deps: DeviceHandshakeDeps,
): Promise<DeviceHandshakeResult> {
  // ── Null-origin rule (packaged Tizen/webOS clients) ────────────────────────
  // TRANSPORT-INDEPENDENT: this runs as Socket.IO handshake middleware, which
  // executes before connection for BOTH the websocket and polling transports,
  // and `handshake.headers.origin` is populated on both.
  //
  // This — not CORS — is the security boundary on realtime. The native
  // WebSocket handshake is not subject to CORS at all, and a cross-origin
  // connection still delivers the Cookie header on both transports. Without
  // this rule a hostile null-origin page could reach getTokenFromClient()'s
  // cookie fallback and authenticate AS THE VICTIM USER.
  //
  // For Origin: null we therefore ignore cookies entirely (never consulted on
  // this path), require handshake.auth.token, verify it ONLY as a device JWT,
  // and reject dashboard/user tokens explicitly rather than passing them on.
  //
  // FAIL-CLOSED: when the flag is disabled a null origin is rejected here,
  // ahead of every cookie, user-token, and device-token authentication path.
  if (isNullOrigin(deps.origin)) {
    if (!isNullOriginCorsEnabled()) {
      return { action: 'reject', message: 'auth_invalid', code: 'AUTH_INVALID' };
    }
    if (!token) {
      // Cookie-only (or credential-less) null-origin handshake: refused
      // outright, never falling through to the dashboard cookie path.
      return { action: 'reject', message: 'auth_invalid', code: 'AUTH_INVALID' };
    }
    let devicePayload: DeviceHandshakePayload;
    try {
      devicePayload = deps.jwtService.verify<DeviceHandshakePayload>(token, {
        secret: deps.deviceSecret,
        algorithms: ['HS256'],
      });
    } catch (err) {
      // Deliberately does NOT consult isValidUserToken: a valid dashboard/user
      // JWT presented from a null origin is a rejection, not a pass.
      const name = (err as { name?: string })?.name;
      if (name === 'TokenExpiredError') {
        return { action: 'reject', message: 'auth_expired', code: 'AUTH_EXPIRED' };
      }
      return { action: 'reject', message: 'auth_invalid', code: 'AUTH_INVALID' };
    }
    if (devicePayload.type !== 'device' || !devicePayload.sub || !devicePayload.organizationId) {
      return { action: 'reject', message: 'auth_invalid', code: 'AUTH_INVALID' };
    }
    return finishDeviceHandshake(devicePayload, token, deps);
  }

  // No auth.token → cookie/dashboard handshake — unchanged path.
  if (!token) return { action: 'pass' };

  let payload: DeviceHandshakePayload;
  try {
    payload = deps.jwtService.verify<DeviceHandshakePayload>(token, {
      secret: deps.deviceSecret,
      algorithms: ['HS256'],
    });
  } catch (err) {
    // Could be an expired/invalid DEVICE token, or a USER token sent via
    // auth.token. If it's a valid user token, let the user path handle it.
    if (isValidUserToken(token, deps)) return { action: 'pass' };
    const name = (err as { name?: string })?.name;
    if (name === 'TokenExpiredError') {
      return { action: 'reject', message: 'auth_expired', code: 'AUTH_EXPIRED' };
    }
    // NB: 'auth_invalid', NOT 'invalid_token' — the pre-fix TV APK wiped
    // credentials on connect_error.message.includes('invalid token'). These
    // legacy strings must never contain that substring or 'unauthorized'
    // (see the assertion in device-handshake-auth.spec.ts).
    return { action: 'reject', message: 'auth_invalid', code: 'AUTH_INVALID' };
  }

  // A non-device token that happens to verify under DEVICE_JWT_SECRET → not our
  // concern; let handleConnection classify it.
  if (payload.type !== 'device' || !payload.sub || !payload.organizationId) {
    if (payload.type !== 'device') return { action: 'pass' };
    return { action: 'reject', message: 'auth_invalid', code: 'AUTH_INVALID' };
  }

  return finishDeviceHandshake(payload, token, deps);
}

/**
 * Shared tail of the device handshake: DB token-hash match, revocation,
 * 90d grace rotation, tenant suspension. Extracted so the null-origin path
 * and the normal path run byte-identical revocation logic — a null-origin
 * device gets NO weaker checks, only a stricter route in.
 */
async function finishDeviceHandshake(
  payload: DeviceHandshakePayload,
  token: string,
  deps: DeviceHandshakeDeps,
): Promise<DeviceHandshakeResult> {
  let display: {
    organizationId: string;
    isDisabled: boolean;
    jwtToken: string | null;
    organization: { subscriptionStatus: string } | null;
  } | null;
  try {
    display = await deps.databaseService.display.findUnique({
      where: { id: payload.sub },
      select: {
        organizationId: true,
        isDisabled: true,
        jwtToken: true,
        organization: { select: { subscriptionStatus: true } },
      },
    });
  } catch {
    // Transport-layer: an infra failure must not become a terminal code.
    return { action: 'pass' };
  }

  // Revocation checks that are independent of which token the device holds run
  // FIRST and are never softened by the grace window: a deleted row, an
  // org-reassignment, or an operator disable is always DEVICE_REVOKED.
  if (
    !display ||
    display.organizationId !== payload.organizationId ||
    display.isDisabled
  ) {
    return { action: 'reject', message: 'device_token_stale', code: 'DEVICE_REVOKED' };
  }

  const tokenHash = hashDeviceToken(token);
  // Hash reported back to the gateway for the live socket's delivery-time checks.
  // Normally the presented hash (which equals the stored hash); on grace accept
  // it is overridden to the stored (rotated-to) hash so delivery keeps matching
  // Display.jwtToken.
  let resolvedHash = tokenHash;

  if (!isCurrentDeviceToken(display.jwtToken, tokenHash)) {
    // Not the current stored token. Accept ONLY if this is the immediately-
    // previous token of an in-flight 90d refresh rotation (PR-8) — i.e. the
    // device reconnected on its old token before it persisted the new one.
    // `isGraceAcceptedDeviceToken` additionally requires the DB to still hold
    // the rotation's `next` hash, so a re-paired/revoked device's old token is
    // NOT revived. A missing/failed grace lookup fails closed (DEVICE_REVOKED).
    let graceRaw: string | null = null;
    if (deps.redis) {
      try {
        graceRaw = await deps.redis.get(deviceTokenGraceKey(payload.sub));
      } catch {
        graceRaw = null; // fail closed — device confirms via auth/check 410 backstop
      }
    }
    if (!isGraceAcceptedDeviceToken(graceRaw, tokenHash, display.jwtToken)) {
      return { action: 'reject', message: 'device_token_stale', code: 'DEVICE_REVOKED' };
    }
    resolvedHash = display.jwtToken ?? tokenHash;
  }

  if (display.organization?.subscriptionStatus === 'suspended') {
    return { action: 'reject', message: 'tenant_suspended', code: 'TENANT_SUSPENDED' };
  }

  return { action: 'accept', payload, tokenHash: resolvedHash };
}

function isValidUserToken(token: string, deps: DeviceHandshakeDeps): boolean {
  try {
    const user = deps.jwtService.verify<{ type?: string }>(token, {
      secret: deps.userSecret,
      algorithms: ['HS256'],
    });
    return user.type !== 'device';
  } catch {
    return false;
  }
}
