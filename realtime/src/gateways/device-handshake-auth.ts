import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { hashDeviceToken, isCurrentDeviceToken } from './device-token-hash';

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
}

export async function authenticateDeviceHandshake(
  token: string | undefined,
  deps: DeviceHandshakeDeps,
): Promise<DeviceHandshakeResult> {
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

  const tokenHash = hashDeviceToken(token);
  if (
    !display ||
    display.organizationId !== payload.organizationId ||
    display.isDisabled ||
    !isCurrentDeviceToken(display.jwtToken, tokenHash)
  ) {
    return { action: 'reject', message: 'device_token_stale', code: 'DEVICE_REVOKED' };
  }

  if (display.organization?.subscriptionStatus === 'suspended') {
    return { action: 'reject', message: 'tenant_suspended', code: 'TENANT_SUSPENDED' };
  }

  return { action: 'accept', payload, tokenHash };
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
