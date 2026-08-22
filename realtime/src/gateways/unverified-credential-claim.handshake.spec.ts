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
 * Spy EVERY Logger level, not just warn/debug.
 *
 * The specs used to build their "everything that was logged" view from `warn` and
 * `debug` alone, which meant a `logger.log(`leak tok=${token}`)` inserted at either
 * log site left the whole suite green — a full raw credential in prod logs, invisible
 * to the tests whose stated job is bounding what reaches them. The argument in the
 * source (prod runs with debug enabled) is precisely why the bound has to cover all
 * levels rather than the two we happen to use.
 */
const LOGGER_LEVELS = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const;

const spyAllLoggerLevels = (): Record<string, jest.SpyInstance> => {
  const spies: Record<string, jest.SpyInstance> = {};
  for (const level of LOGGER_LEVELS) {
    const proto = Logger.prototype as unknown as Record<string, unknown>;
    if (typeof proto[level] !== 'function') continue; // level not in this Nest version
    spies[level] = jest
      .spyOn(Logger.prototype, level as 'warn')
      .mockImplementation(() => undefined);
  }
  // Non-vacuous: if Nest ever renames these, the suite must fail loudly rather than
  // silently watch nothing.
  expect(Object.keys(spies)).toEqual(expect.arrayContaining(['log', 'warn', 'debug', 'error']));
  return spies;
};

const linesFrom = (spies: Record<string, jest.SpyInstance>): string[] =>
  Object.values(spies).flatMap((spy) => spy.mock.calls.map((c) => String(c[0])));

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
    const result = await authenticateDeviceHandshake(forgedToken(REAL_DEVICE), deps);

    // Non-vacuous: assert the path actually ran and produced the verdict. Without
    // this, stubbing the handshake to return immediately would leave the
    // not-called assertions below green while proving nothing.
    expect(result).toMatchObject({ action: 'reject', code: 'AUTH_INVALID' });
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

  it('carries NO claim on the payload-shape rejection — that sub is signature-backed', async () => {
    // The signature verified; only the payload shape is wrong. `payload.sub` here is
    // trusted, so it must not travel in the untrusted field or be logged under the
    // `attribution=unauthenticated-claim` marker — that would blur the distinction this
    // telemetry exists to keep sharp. Telemetry for structurally-invalid-but-SIGNED
    // tokens would need its own trusted-attribution marker; this is not it.
    const verify = jest.fn().mockReturnValue({
      sub: REAL_DEVICE,
      deviceIdentifier: 'dev-1',
      organizationId: '', // verified, but unusable
      type: 'device' as const,
    });
    const { deps, display } = makeDeps({ verify });
    const result = await authenticateDeviceHandshake(forgedToken(REAL_DEVICE), deps);
    expect(result).toEqual({
      action: 'reject',
      message: 'auth_invalid',
      code: 'AUTH_INVALID',
    });
    expect(
      (result as { unverifiedDeviceClaim?: string }).unverifiedDeviceClaim,
    ).toBeUndefined();
    expect(display.findUnique).not.toHaveBeenCalled();
  });

  it('the claim appears ONLY when verification actually failed', async () => {
    // Same token, same 401-equivalent verdict; the only difference is whether verify threw.
    const verified = jest.fn().mockReturnValue({
      sub: REAL_DEVICE,
      deviceIdentifier: 'dev-1',
      organizationId: '',
      type: 'device' as const,
    });
    const signed = await authenticateDeviceHandshake(
      forgedToken(REAL_DEVICE),
      makeDeps({ verify: verified }).deps,
    );
    expect(
      (signed as { unverifiedDeviceClaim?: string }).unverifiedDeviceClaim,
    ).toBeUndefined();

    const unsigned = await authenticateDeviceHandshake(
      forgedToken(REAL_DEVICE),
      makeDeps().deps,
    );
    expect((unsigned as { unverifiedDeviceClaim?: string }).unverifiedDeviceClaim).toBe(
      REAL_DEVICE,
    );
  });

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
  let debug: jest.SpyInstance;
  let spies: Record<string, jest.SpyInstance>;
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
    spies = spyAllLoggerLevels();
    warn = spies.warn;
    debug = spies.debug;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetClaimTelemetryState();
    (
      (gateway as unknown as { cleanupIntervals?: NodeJS.Timeout[] }).cleanupIntervals || []
    ).forEach(clearInterval);
  });

  const handshakeFrom = async (
    token: string,
    address: string | undefined,
    headers: Record<string, string | string[]> = {},
  ) => {
    const socket = {
      id: 'socket-1',
      handshake: { auth: { token }, address, headers },
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

  const handshake = (token: string) => handshakeFrom(token, '127.0.0.1');

  const warnings = () => warn.mock.calls.map((c) => String(c[0]));
  const debugs = () => debug.mock.calls.map((c) => String(c[0]));
  /** EVERY level, so a leak at `log`/`error`/`verbose` cannot hide from these tests. */
  const allLines = () => linesFrom(spies);
  const rejectLines = () => allLines().filter((l) => l.startsWith('handshake_reject '));
  const warnRejects = () => warnings().filter((l) => l.startsWith('handshake_reject '));

  it('enriches the ONE handshake_reject line — never a second line', async () => {
    const err = await handshake(forgedToken('display-real-1'));
    expect((err as unknown as { data?: { code: string } })?.data?.code).toBe('AUTH_INVALID');

    expect(rejectLines()).toEqual([
      'handshake_reject device=unverified code=AUTH_INVALID claimedDeviceId=display-real-1' +
        ' attribution=unauthenticated-claim peer=127.0.0.1',
    ]);
    // Exactly one log line in total for this rejection: the enriched one.
    expect(allLines()).toHaveLength(1);
    // The TRUSTED field keeps its meaning — the claim never populates it.
    expect(rejectLines()[0]).toContain('device=unverified ');
    expect(rejectLines()[0]).not.toContain('device=display-real-1');
  });

  it('reads X-Real-IP, which prod nginx OVERWRITES, so the source cannot be forged', async () => {
    // This path has NO rate limit — validateConnectionRate lives in handleConnection,
    // which a rejected handshake never reaches — so anyone can put any customer's
    // display id into this warn line. Without a source it is indistinguishable from
    // that display genuinely misbehaving.
    await handshakeFrom(forgedToken('display-real-1'), '127.0.0.1', {
      'x-real-ip': '203.0.113.9',
    });
    const line = warnRejects()[0];
    expect(line).toContain(' peer=203.0.113.9');
    // The socket address behind nginx is the proxy and is useless as a discriminator.
    expect(line).not.toContain('127.0.0.1');
    expect(line).not.toContain('clientIp='); // named for what it holds, not what we wish
  });

  it('NEVER reads X-Forwarded-For — its head is attacker-supplied', async () => {
    // nginx sets XFF with $proxy_add_x_forwarded_for, which APPENDS: the value is
    // `<whatever the client sent>, <real peer>`. Taking [0] would let an attacker name
    // an innocent third party's IP in our logs — a worse version of the bug the peer
    // field exists to fix.
    await handshakeFrom(forgedToken('display-real-1'), '127.0.0.1', {
      'x-forwarded-for': '198.51.100.7, 203.0.113.9',
      'x-real-ip': '203.0.113.9',
    });
    expect(warnRejects()[0]).toContain(' peer=203.0.113.9');
    expect(allLines().join('\n')).not.toContain('198.51.100.7');
  });

  it('falls back to the socket address ONLY when X-Real-IP is absent, never to XFF', async () => {
    // No X-Real-IP means the connection did not come through nginx, and in exactly
    // that case the socket address IS the real peer.
    await handshakeFrom(forgedToken('display-real-1'), '198.51.100.20', {
      'x-forwarded-for': '198.51.100.7',
    });
    const line = warnRejects()[0];
    expect(line).toContain(' peer=198.51.100.20');
    expect(allLines().join('\n')).not.toContain('198.51.100.7');
  });

  it('sanitises X-Real-IP — spaces and `=` are legal in a header and arrive intact', async () => {
    // Node's parser rejects CR/LF, so a forged second LINE is unreachable; same-line
    // field forgery is not, and this is what closes it.
    await handshakeFrom(forgedToken('display-real-1'), '127.0.0.1', {
      'x-real-ip': '1.2.3.4 attribution=verified claimedDeviceId=victim',
    });
    const line = warnRejects()[0];
    // The forged text survives as inert characters — what must NOT survive is its
    // structure: one `claimedDeviceId=` and one `attribution=`, both ours.
    expect(line.match(/claimedDeviceId=/g)).toHaveLength(1);
    expect(line.match(/attribution=/g)).toHaveLength(1);
    expect(line).not.toContain('attribution=verified');
    expect(line).not.toContain('=victim');
    expect(line.split(' peer=')[1]).not.toContain(' '); // no new fields after peer
    expect(line).toMatch(
      /^handshake_reject device=unverified code=AUTH_INVALID claimedDeviceId=display-real-1 attribution=unauthenticated-claim peer=[A-Za-z0-9_.:-]+$/,
    );
  });

  it('caps an over-long X-Real-IP — the parser accepts thousands of characters', async () => {
    await handshakeFrom(forgedToken('display-real-1'), '127.0.0.1', {
      'x-real-ip': '9'.repeat(4000),
    });
    const peer = warnRejects()[0].split(' peer=')[1];
    expect(peer).toHaveLength(64);
  });

  it('takes the last value when the header arrives more than once', async () => {
    await handshakeFrom(forgedToken('display-real-1'), '127.0.0.1', {
      'x-real-ip': ['198.51.100.7', '203.0.113.9'],
    });
    expect(warnRejects()[0]).toContain(' peer=203.0.113.9');
  });

  it('falls back to `unknown` rather than omitting the field', async () => {
    await handshakeFrom(forgedToken('display-real-1'), undefined, {});
    expect(warnRejects()[0]).toContain(' peer=unknown');
  });

  it('promotes the attributable rejection to warn so an operator actually sees it', async () => {
    await handshake(forgedToken('display-real-1'));
    expect(warnRejects()).toHaveLength(1);
    expect(debugs()).toHaveLength(0);
  });

  it('logs no token, no token segment and no hash', async () => {
    const token = forgedToken('display-real-1');
    const [header, payloadSegment, signature] = token.split('.');
    await handshake(token);
    const emitted = allLines().join('\n');
    expect(emitted).not.toContain(token);
    expect(emitted).not.toContain(header);
    expect(emitted).not.toContain(payloadSegment);
    expect(emitted).not.toContain(signature);
    expect(emitted).not.toContain(hashDeviceToken(token));
  });

  it('drops the claim fields entirely once the gate closes — not merely the level', async () => {
    // Prod runs with debug enabled, so demoting an over-budget line to debug would
    // still let anyone write unbounded attacker-controlled text into the logs.
    await handshake(forgedToken('display-real-1'));
    await handshake(forgedToken('display-real-1'));
    await handshake(forgedToken('display-real-1'));

    // Non-vacuous: the first one DID emit the enriched line.
    expect(warnRejects()).toEqual([
      'handshake_reject device=unverified code=AUTH_INVALID claimedDeviceId=display-real-1' +
        ' attribution=unauthenticated-claim peer=127.0.0.1',
    ]);
    // The line count is unchanged — the base line still fires per rejection...
    expect(rejectLines()).toHaveLength(3);
    // ...but the over-budget ones carry nothing attacker-controlled.
    expect(debugs()).toEqual([
      'handshake_reject device=unverified code=AUTH_INVALID',
      'handshake_reject device=unverified code=AUTH_INVALID',
    ]);
    expect(debugs().join('\n')).not.toContain('claimedDeviceId');
    expect(debugs().join('\n')).not.toContain('display-real-1');
  });

  it('past the global ceiling no claim value reaches the log at ANY level', async () => {
    const total = CLAIM_TELEMETRY_MAX_PER_WINDOW + 25;
    for (let i = 0; i < total; i++) {
      await handshake(forgedToken(`flood-${i}`));
    }
    // Non-vacuous: the budget's worth of enriched lines was emitted...
    expect(warnRejects()).toHaveLength(CLAIM_TELEMETRY_MAX_PER_WINDOW);
    expect(rejectLines()).toHaveLength(total);
    // ...and every over-budget rejection is the plain line, carrying no `flood-N`.
    const overBudget = debugs();
    expect(overBudget).toHaveLength(total - CLAIM_TELEMETRY_MAX_PER_WINDOW);
    expect(
      overBudget.every((l) => l === 'handshake_reject device=unverified code=AUTH_INVALID'),
    ).toBe(true);
    for (let i = CLAIM_TELEMETRY_MAX_PER_WINDOW; i < total; i++) {
      expect(allLines().join('\n')).not.toContain(`flood-${i}`);
    }

    const suppressed = warnings().filter((l) =>
      l.startsWith('unverified_credential_claim_suppressed'),
    );
    // A count, so an operator can tell incidental budget exhaustion from a flood.
    expect(suppressed).toEqual([
      'unverified_credential_claim_suppressed reason=rate-limit suppressed=1 note=claim-values-withheld',
      'unverified_credential_claim_suppressed reason=rate-limit suppressed=10 note=claim-values-withheld',
    ]);
    expect(suppressed.join('\n')).not.toContain('flood-');
  });

  it('a throwing logger cannot turn a REJECT into a PASS', async () => {
    // Everything on this path sits inside the middleware's outer try, whose catch
    // calls next() — so an unguarded logger throw would ADMIT the connection.
    warn.mockImplementation(() => {
      throw new Error('EPIPE');
    });
    debug.mockImplementation(() => {
      throw new Error('EPIPE');
    });
    const err = await handshake(forgedToken('display-real-1'));
    expect(err).not.toBeNull();
    expect((err as unknown as { data?: { code: string } })?.data?.code).toBe('AUTH_INVALID');
    expect((err as unknown as Error).message).toBe('auth_invalid');
  });

  it('a throwing logger cannot change the unattributed rejection either', async () => {
    // No claim decodes here, so this exercises the pre-existing plain-line log site.
    warn.mockImplementation(() => {
      throw new Error('EPIPE');
    });
    debug.mockImplementation(() => {
      throw new Error('EPIPE');
    });
    const err = await handshake('not-a-token');
    expect(err).not.toBeNull();
    expect((err as unknown as { data?: { code: string } })?.data?.code).toBe('AUTH_INVALID');
  });

  it('leaves the line exactly as it was when no claim can be decoded', async () => {
    await handshake('not-a-token');
    expect(rejectLines()).toEqual(['handshake_reject device=unverified code=AUTH_INVALID']);
    expect(allLines()).toHaveLength(1);
    expect(warnings()).toHaveLength(0); // unattributable churn stays at debug
  });

  it('never reads or writes a device row on this path', async () => {
    await handshake(forgedToken('display-real-1'));
    expect(display.findUnique).not.toHaveBeenCalled();
    expect(display.update).not.toHaveBeenCalled();
    expect(display.updateMany).not.toHaveBeenCalled();
    expect(display.delete).not.toHaveBeenCalled();
  });
});
