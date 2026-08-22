import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { DeviceGateway } from './device.gateway';
import { RedisService } from '../services/redis.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { PlaylistService } from '../services/playlist.service';
import { NotificationService } from '../services/notification.service';
import { MetricsService } from '../metrics/metrics.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { authenticateDeviceHandshake, DeviceHandshakeDeps } from './device-handshake-auth';
import { hashDeviceToken } from './device-token-hash';
import {
  resetClaimTelemetryState,
  CLAIM_TELEMETRY_MAX_PER_WINDOW,
} from './unverified-credential-claim';

/**
 * Diagnostics-only claim telemetry on the handshake path.
 *
 * The whole point of these tests is what must NOT happen. Decoding `sub` out of a
 * token that failed verification tells an operator which display is *claimed*; it
 * must not move the auth verdict one inch. So every case below pairs "the claim
 * was logged" with "the reject is unchanged, no DB row was read or written, and
 * no 410-shaped outcome became reachable".
 */
describe('unverified credential claim telemetry (realtime handshake)', () => {
  const DEVICE_SECRET = 'd'.repeat(32);
  const USER_SECRET = 'u'.repeat(32);
  const REAL_DEVICE = 'display-real-1';

  const b64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  /** A syntactically valid JWT whose signature is garbage — nothing verifies it. */
  const forgedToken = (sub: unknown, extra: Record<string, unknown> = {}) =>
    `eyJhbGciOiJIUzI1NiJ9.${b64url({ sub, type: 'device', organizationId: 'org-1', ...extra })}.AAAA`;

  const badSignature = () => {
    const e = new Error('invalid signature');
    e.name = 'JsonWebTokenError';
    throw e;
  };

  const makeDeps = (over: {
    verify?: jest.Mock;
    findUnique?: jest.Mock;
    update?: jest.Mock;
    updateMany?: jest.Mock;
    delete?: jest.Mock;
  } = {}) => {
    const display = {
      findUnique: over.findUnique ?? jest.fn(),
      update: over.update ?? jest.fn(),
      updateMany: over.updateMany ?? jest.fn(),
      delete: over.delete ?? jest.fn(),
      deleteMany: jest.fn(),
    };
    const deps: DeviceHandshakeDeps = {
      jwtService: { verify: over.verify ?? jest.fn(badSignature) } as never,
      databaseService: { display } as never,
      deviceSecret: DEVICE_SECRET,
      userSecret: USER_SECRET,
    };
    return { deps, display };
  };

  beforeEach(() => resetClaimTelemetryState());
  afterEach(() => resetClaimTelemetryState());

  // ---- the claim never becomes identity -------------------------------------

  it('a forged token naming a REAL device is still AUTH_INVALID and never authenticates', async () => {
    const { deps } = makeDeps();
    const result = await authenticateDeviceHandshake(forgedToken(REAL_DEVICE), deps);

    expect(result.action).toBe('reject');
    expect(result).toMatchObject({ message: 'auth_invalid', code: 'AUTH_INVALID' });
    // The claim is carried for logging, in its own field...
    expect((result as { unverifiedDeviceClaim?: string }).unverifiedDeviceClaim).toBe(
      REAL_DEVICE,
    );
    // ...and is NOT the trusted attribution field, which stays absent.
    expect((result as { deviceId?: string }).deviceId).toBeUndefined();
  });

  it('a fabricated sub naming a real device touches no row — no read, no write of any kind', async () => {
    const { deps, display } = makeDeps();
    await authenticateDeviceHandshake(forgedToken(REAL_DEVICE), deps);

    expect(display.findUnique).not.toHaveBeenCalled();
    expect(display.update).not.toHaveBeenCalled();
    expect(display.updateMany).not.toHaveBeenCalled();
    expect(display.delete).not.toHaveBeenCalled();
    expect(display.deleteMany).not.toHaveBeenCalled();
  });

  it('no invalid-token shape can reach DEVICE_REVOKED (the purge signal)', async () => {
    const shapes = [
      forgedToken(REAL_DEVICE),
      forgedToken(''),
      forgedToken(null),
      'a.b',
      'not-a-token',
      `eyJhbGciOiJIUzI1NiJ9..AAAA`,
      `eyJhbGciOiJIUzI1NiJ9.${'!'.repeat(20)}.AAAA`,
    ];
    for (const token of shapes) {
      const { deps, display } = makeDeps();
      const result = await authenticateDeviceHandshake(token, deps);
      expect(result).toMatchObject({
        action: 'reject',
        message: 'auth_invalid',
        code: 'AUTH_INVALID',
      });
      expect(display.findUnique).not.toHaveBeenCalled();
    }
  });

  it('a token with no decodable claim keeps the existing shape exactly (gateway logs device=unverified)', async () => {
    const { deps } = makeDeps();
    const result = await authenticateDeviceHandshake('not-a-token', deps);
    expect(result).toEqual({
      action: 'reject',
      message: 'auth_invalid',
      code: 'AUTH_INVALID',
    });
  });

  it('sanitises a claim carrying CR/LF so the reject cannot forge a log line', async () => {
    const { deps } = makeDeps();
    const result = await authenticateDeviceHandshake(
      forgedToken('display-1\r\nhandshake_reject device=display-2 code=DEVICE_REVOKED'),
      deps,
    );
    const claim = (result as { unverifiedDeviceClaim?: string }).unverifiedDeviceClaim as string;
    expect(claim).toMatch(/^[A-Za-z0-9_.:-]+$/);
    expect(claim).not.toContain('\n');
    expect(claim).not.toContain('\r');
  });

  // ---- everything else is untouched -----------------------------------------

  it('an EXPIRED token still yields AUTH_EXPIRED and carries no claim', async () => {
    const verify = jest.fn(() => {
      const e = new Error('jwt expired');
      e.name = 'TokenExpiredError';
      throw e;
    });
    const { deps } = makeDeps({ verify });
    const result = await authenticateDeviceHandshake(forgedToken(REAL_DEVICE), deps);
    // Expiry is a distinct, benign condition: the device holds a real credential
    // that simply aged out. It is not an AUTH_INVALID event, so it deliberately
    // emits no claim line — that log is for credentials that do not verify at all.
    expect(result).toEqual({
      action: 'reject',
      message: 'auth_expired',
      code: 'AUTH_EXPIRED',
    });
  });

  it('a VALID token is accepted exactly as before and carries no claim', async () => {
    const TOKEN = 'the.device.token';
    const payload = {
      sub: REAL_DEVICE,
      deviceIdentifier: 'dev-1',
      organizationId: 'org-1',
      type: 'device' as const,
    };
    const verify = jest.fn().mockReturnValue(payload);
    const findUnique = jest.fn().mockResolvedValue({
      organizationId: 'org-1',
      isDisabled: false,
      jwtToken: hashDeviceToken(TOKEN),
      organization: { subscriptionStatus: 'active' },
    });
    const { deps } = makeDeps({ verify, findUnique });
    const result = await authenticateDeviceHandshake(TOKEN, deps);
    expect(result).toEqual({
      action: 'accept',
      payload,
      tokenHash: hashDeviceToken(TOKEN),
      presentedTokenHash: hashDeviceToken(TOKEN),
      authenticatedViaGrace: false,
    });
  });

  it('a DB failure still passes through as transport-layer, never "credential invalid"', async () => {
    const verify = jest.fn().mockReturnValue({
      sub: REAL_DEVICE,
      deviceIdentifier: 'dev-1',
      organizationId: 'org-1',
      type: 'device' as const,
    });
    const findUnique = jest.fn().mockRejectedValue(new Error('db down'));
    const { deps } = makeDeps({ verify, findUnique });
    expect(await authenticateDeviceHandshake('a.b.c', deps)).toEqual({ action: 'pass' });
  });
});

/**
 * Gateway log site. Drives the production middleware body so the log wording and
 * the emission budget are exercised together.
 */
describe('unverified credential claim telemetry (gateway log site)', () => {
  let gateway: DeviceGateway;
  let warn: jest.SpyInstance;
  let display: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock; delete: jest.Mock };

  const b64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  const forgedToken = (sub: unknown) =>
    `eyJhbGciOiJIUzI1NiJ9.${b64url({ sub, type: 'device', organizationId: 'org-1' })}.AAAA`;

  beforeEach(async () => {
    resetClaimTelemetryState();
    display = {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceGateway,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(() => {
              const e = new Error('invalid signature');
              e.name = 'JsonWebTokenError';
              throw e;
            }),
          },
        },
        { provide: RedisService, useValue: { get: jest.fn().mockResolvedValue(null) } },
        {
          provide: HeartbeatService,
          useValue: { processHeartbeat: jest.fn(), forgetDevice: jest.fn() },
        },
        { provide: PlaylistService, useValue: {} },
        { provide: NotificationService, useValue: {} },
        {
          provide: MetricsService,
          useValue: { recordHeartbeat: jest.fn(), updateDeviceMetrics: jest.fn() },
        },
        { provide: DatabaseService, useValue: { display } },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();

    gateway = mod.get(DeviceGateway);
    (gateway as unknown as { server: unknown }).server = {
      emit: jest.fn(),
      sockets: { sockets: new Map() },
    };
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetClaimTelemetryState();
    (
      (gateway as unknown as { cleanupIntervals?: NodeJS.Timeout[] }).cleanupIntervals || []
    ).forEach(clearInterval);
  });

  const handshake = async (token: string) => {
    const socket = {
      id: 'socket-1',
      handshake: { auth: { token }, address: '127.0.0.1' },
      data: {} as Record<string, unknown>,
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
    };
    let rejected: Error | null = null;
    await (
      gateway as unknown as {
        runDeviceHandshake: (s: unknown, n: (e?: Error) => void) => Promise<void>;
      }
    ).runDeviceHandshake(socket, (err?: Error) => {
      rejected = err ?? null;
    });
    return rejected;
  };

  const warnings = () => warn.mock.calls.map((c) => String(c[0]));
  const claimLines = () =>
    warnings().filter((l) => l.startsWith('unverified_credential_claim '));

  it('emits the operator line in the mandated shape, and never as authenticated attribution', async () => {
    const err = await handshake(forgedToken('display-real-1'));
    expect((err as unknown as { data?: { code: string } })?.data?.code).toBe('AUTH_INVALID');

    expect(claimLines()).toEqual([
      'unverified_credential_claim deviceClaim=display-real-1 reason=AUTH_INVALID note=unauthenticated-claim-not-attribution',
    ]);
    // The `device=<id> CODE` shape reads as verified attribution — it must never
    // be produced for a credential that did not verify.
    expect(warnings().some((l) => /device=display-real-1/.test(l))).toBe(false);
  });

  it('logs no token, no token segment and no hash', async () => {
    const token = forgedToken('display-real-1');
    const [header, payloadSegment, signature] = token.split('.');
    await handshake(token);
    const emitted = warnings().join('\n');
    expect(emitted).not.toContain(token);
    expect(emitted).not.toContain(header);
    expect(emitted).not.toContain(payloadSegment);
    expect(emitted).not.toContain(signature);
    expect(emitted).not.toContain(hashDeviceToken(token));
  });

  it('deduplicates the same claim inside the window', async () => {
    await handshake(forgedToken('display-real-1'));
    await handshake(forgedToken('display-real-1'));
    await handshake(forgedToken('display-real-1'));
    expect(claimLines()).toHaveLength(1);
  });

  it('stops emitting past the global ceiling and says so once, with no claim value', async () => {
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_PER_WINDOW + 25; i++) {
      await handshake(forgedToken(`flood-${i}`));
    }
    expect(claimLines()).toHaveLength(CLAIM_TELEMETRY_MAX_PER_WINDOW);
    const suppressed = warnings().filter((l) =>
      l.startsWith('unverified_credential_claim_suppressed'),
    );
    expect(suppressed).toEqual([
      'unverified_credential_claim_suppressed reason=rate-limit note=claim-values-withheld',
    ]);
    expect(suppressed[0]).not.toContain('flood-');
  });

  it('emits nothing when no claim can be decoded — the existing line stands alone', async () => {
    await handshake('not-a-token');
    expect(claimLines()).toHaveLength(0);
  });

  it('never reads or writes a device row on this path', async () => {
    await handshake(forgedToken('display-real-1'));
    expect(display.findUnique).not.toHaveBeenCalled();
    expect(display.update).not.toHaveBeenCalled();
    expect(display.updateMany).not.toHaveBeenCalled();
    expect(display.delete).not.toHaveBeenCalled();
  });
});
