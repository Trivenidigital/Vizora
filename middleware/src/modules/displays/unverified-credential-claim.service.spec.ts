import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { DeviceAuthCheckService } from './device-auth-check.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { hashDeviceToken } from '../common/device-token-auth.util';
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
 * Diagnostics-only claim telemetry on `GET /devices/auth/check`.
 *
 * This endpoint is the SOLE authority for device credential destruction, so the
 * bar for adding anything to it is: the new value must be incapable of changing
 * the answer. These tests assert that from both directions — the decoded claim
 * reaches the log and nothing else, and every existing verdict (200 / 401
 * AUTH_EXPIRED / 401 AUTH_INVALID / 410 / 5xx) comes out byte-identical.
 */
describe('unverified credential claim telemetry (device auth/check)', () => {
  let service: DeviceAuthCheckService;
  let jwt: { verify: jest.Mock };
  let display: {
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  let redis: { get: jest.Mock; getOrThrow: jest.Mock };
  let warn: jest.SpyInstance;
  let debug: jest.SpyInstance;
  let spies: Record<string, jest.SpyInstance>;

  const REAL_DEVICE = 'display-real-1';

  const b64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  /** Syntactically valid JWT, garbage signature — nothing verifies it. */
  const forgedToken = (sub: unknown, extra: Record<string, unknown> = {}) =>
    `eyJhbGciOiJIUzI1NiJ9.${b64url({ sub, type: 'device', organizationId: 'org-1', ...extra })}.AAAA`;

  const badSignature = () => {
    const e = new Error('invalid signature');
    e.name = 'JsonWebTokenError';
    throw e;
  };

  beforeEach(async () => {
    resetClaimTelemetryState();
    jwt = { verify: jest.fn(badSignature) };
    display = {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      getOrThrow: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceAuthCheckService,
        { provide: JwtService, useValue: jwt },
        { provide: DatabaseService, useValue: { display } },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get(DeviceAuthCheckService);
    process.env.DEVICE_JWT_SECRET = 'x'.repeat(32);
    process.env.JWT_SECRET = 'u'.repeat(32); // distinct, so the user-token check is real
    spies = spyAllLoggerLevels();
    warn = spies.warn;
    debug = spies.debug;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetClaimTelemetryState();
  });

  const warnings = () => warn.mock.calls.map((c) => String(c[0]));
  const debugs = () => debug.mock.calls.map((c) => String(c[0]));
  /** EVERY level, so a leak at `log`/`error`/`verbose` cannot hide from these tests. */
  const allLines = () => linesFrom(spies);
  const claimLines = () =>
    allLines().filter((l) => l.startsWith('device_auth_check_reject '));
  const warnClaimLines = () =>
    warnings().filter((l) => l.startsWith('device_auth_check_reject '));

  const currentDisplay = (over: Record<string, unknown> = {}) => ({
    id: REAL_DEVICE,
    organizationId: 'org-1',
    isDisabled: false,
    jwtToken: null,
    organization: { subscriptionStatus: 'active' },
    ...over,
  });

  const assertNoWrites = () => {
    expect(display.update).not.toHaveBeenCalled();
    expect(display.updateMany).not.toHaveBeenCalled();
    expect(display.delete).not.toHaveBeenCalled();
    expect(display.deleteMany).not.toHaveBeenCalled();
  };

  // ---- the claim is logged and does nothing else ----------------------------

  it('emits one structured line in the mandated shape for a bad-signature token', async () => {
    const result = await service.evaluate(forgedToken(REAL_DEVICE));

    expect(result).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
    expect(claimLines()).toEqual([
      `device_auth_check_reject code=AUTH_INVALID claimedDeviceId=${REAL_DEVICE}` +
        ' attribution=unauthenticated-claim clientIp=unknown',
    ]);
    expect(allLines()).toHaveLength(1);
    // Never the trusted-attribution shape — this endpoint has no verified identity
    // to report on an AUTH_INVALID, and the claim must not be dressed as one.
    expect(allLines().some((l) => /(^|\s)device=/.test(l))).toBe(false);
  });

  it('drops the claim entirely once the gate closes — not merely the level', async () => {
    // Prod runs with debug enabled, so demoting an over-budget line to debug would
    // still let anyone write unbounded attacker-controlled text into the logs.
    await service.evaluate(forgedToken(REAL_DEVICE));
    // Non-vacuous: the first one DID emit.
    expect(warnClaimLines()).toHaveLength(1);
    expect(debugs()).toHaveLength(0);

    await service.evaluate(forgedToken(REAL_DEVICE));
    await service.evaluate(forgedToken(REAL_DEVICE));
    expect(warnClaimLines()).toHaveLength(1); // still just the first
    expect(allLines()).toHaveLength(1); // the repeats emit nothing at any level
    expect(debugs()).toHaveLength(0);
  });

  it('names the source, from the trust-proxy-resolved client IP', async () => {
    // Without a source, a forged `claimedDeviceId` naming a real customer display is
    // indistinguishable from that display genuinely misbehaving.
    await service.evaluate(forgedToken(REAL_DEVICE), '203.0.113.9');
    expect(warnClaimLines()[0]).toContain(' clientIp=203.0.113.9');
  });

  it('sanitises the client IP and cannot have a second field injected through it', async () => {
    await service.evaluate(
      forgedToken(REAL_DEVICE),
      '203.0.113.9 claimedDeviceId=victim attribution=verified',
    );
    const line = warnClaimLines()[0];
    expect(line.match(/claimedDeviceId=/g)).toHaveLength(1);
    expect(line).not.toContain('attribution=verified');
    expect(line).toMatch(
      /^device_auth_check_reject code=AUTH_INVALID claimedDeviceId=[A-Za-z0-9_:-]+ attribution=unauthenticated-claim clientIp=[A-Za-z0-9_.:-]+$/,
    );
  });

  it('emits NOTHING for a valid USER token — real user ids never enter these logs', async () => {
    // A dashboard/mobile bearer fails the DEVICE verify and lands in the same catch.
    // Its `sub` is a real user id, and logging it as `claimedDeviceId` would be both
    // wrong and a way for one misconfigured client to burn the shared budget.
    // Realtime avoids this by returning `pass` before extraction; this mirrors it.
    const USER_TOKEN = forgedToken('user-abc-123');
    jwt.verify.mockImplementation((_token: string, opts: { secret?: string }) => {
      if (opts?.secret === process.env.JWT_SECRET) return { sub: 'user-abc-123', type: 'user' };
      throw Object.assign(new Error('invalid signature'), { name: 'JsonWebTokenError' });
    });

    const result = await service.evaluate(USER_TOKEN, '203.0.113.9');
    // The verdict is unchanged — a user token is still not a device credential.
    expect(result).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
    expect(allLines()).toHaveLength(0);
    expect(allLines().join('\n')).not.toContain('user-abc-123');
  });

  it('a user token does not consume the shared budget', async () => {
    const realSignature = jwt.verify.getMockImplementation();
    jwt.verify.mockImplementation((_token: string, opts: { secret?: string }) => {
      if (opts?.secret === process.env.JWT_SECRET) return { sub: 'user-abc-123', type: 'user' };
      throw Object.assign(new Error('invalid signature'), { name: 'JsonWebTokenError' });
    });
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_PER_WINDOW + 5; i++) {
      await service.evaluate(forgedToken(`user-${i}`), '203.0.113.9');
    }
    expect(allLines()).toHaveLength(0);

    // The budget is untouched: a genuine device claim still gets its line.
    jwt.verify.mockImplementation(realSignature as never);
    await service.evaluate(forgedToken(REAL_DEVICE), '203.0.113.9');
    expect(warnClaimLines()).toHaveLength(1);
  });

  it('the 401 response body is byte-identical and carries no claim', async () => {
    const result = await service.evaluate(forgedToken(REAL_DEVICE));
    expect(JSON.stringify(result.body)).toBe('{"code":"AUTH_INVALID"}');
    expect(JSON.stringify(result.body)).not.toContain(REAL_DEVICE);
  });

  it('a fabricated sub naming a real device reads and writes NOTHING', async () => {
    const result = await service.evaluate(forgedToken(REAL_DEVICE));
    // Non-vacuous: prove the path ran and produced the verdict, so the not-called
    // assertions below cannot pass merely because nothing happened.
    expect(result).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
    expect(display.findUnique).not.toHaveBeenCalled();
    assertNoWrites();
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.getOrThrow).not.toHaveBeenCalled();
  });

  it('logs no token, no token segment and no hash', async () => {
    const token = forgedToken(REAL_DEVICE);
    const [header, payloadSegment, signature] = token.split('.');
    await service.evaluate(token);
    const emitted = allLines().join('\n');
    expect(emitted).not.toContain(token);
    expect(emitted).not.toContain(header);
    expect(emitted).not.toContain(payloadSegment);
    expect(emitted).not.toContain(signature);
    expect(emitted).not.toContain(hashDeviceToken(token));
  });

  it('sanitises a sub carrying CR/LF so a 410-shaped log line cannot be forged', async () => {
    await service.evaluate(
      forgedToken('display-1\r\ndevice_auth_check_reject code=DEVICE_REVOKED claimedDeviceId=display-2'),
    );
    expect(claimLines()).toHaveLength(1);
    expect(claimLines()[0].split('\n')).toHaveLength(1);
    expect(claimLines()[0]).toMatch(
      /^device_auth_check_reject code=AUTH_INVALID claimedDeviceId=[A-Za-z0-9_:-]+ attribution=unauthenticated-claim clientIp=[A-Za-z0-9_.:-]+$/,
    );
  });

  it('emits NOTHING on the payload-shape rejection — that sub is signature-backed', async () => {
    // Signature verifies, but the token is not a usable device credential. The `sub`
    // on this branch is trusted, so filing it under the unauthenticated marker would
    // blur the very distinction this telemetry exists to keep sharp. Telemetry for
    // structurally-invalid-but-SIGNED tokens needs its own trusted-attribution
    // marker, not this one.
    const shapes = [
      { sub: REAL_DEVICE, type: 'user', organizationId: 'org-1' },
      { sub: REAL_DEVICE, type: 'device', organizationId: '' },
      { sub: '', type: 'device', organizationId: 'org-1' },
      { sub: REAL_DEVICE, type: 'device' },
    ];
    for (const payload of shapes) {
      jwt.verify.mockReturnValue(payload);
      const result = await service.evaluate(forgedToken(REAL_DEVICE));
      expect(result).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
    }
    expect(allLines()).toHaveLength(0);
    expect(display.findUnique).not.toHaveBeenCalled();
    assertNoWrites();
  });

  it('telemetry fires ONLY when verification actually failed', async () => {
    // Same token, same claim, same 401 — the only difference is whether jwt.verify threw.
    jwt.verify.mockReturnValue({ sub: REAL_DEVICE, type: 'user', organizationId: 'org-1' });
    await service.evaluate(forgedToken(REAL_DEVICE));
    expect(allLines()).toHaveLength(0);

    jwt.verify.mockImplementation(badSignature);
    await service.evaluate(forgedToken(REAL_DEVICE));
    expect(claimLines()).toHaveLength(1);
  });

  // ---- 401 can never become 410 ---------------------------------------------

  it('no invalid-token shape produces a 410 or any status other than 401', async () => {
    const shapes = [
      forgedToken(REAL_DEVICE),
      forgedToken(''),
      forgedToken(null),
      forgedToken({ nested: 'object' }),
      forgedToken('x'.repeat(500)),
      'a.b',
      'not-a-token',
      'eyJhbGciOiJIUzI1NiJ9..AAAA',
      `eyJhbGciOiJIUzI1NiJ9.${'!'.repeat(20)}.AAAA`,
      '',
    ];
    for (const token of shapes) {
      const result = await service.evaluate(token);
      expect(result).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
      expect(display.findUnique).not.toHaveBeenCalled();
      assertNoWrites();
    }
  });

  // ---- existing behaviour, unchanged ----------------------------------------

  it('an EXPIRED token still yields 401 AUTH_EXPIRED, distinct from AUTH_INVALID, with no claim line', async () => {
    jwt.verify.mockImplementation(() => {
      const e = new Error('jwt expired');
      e.name = 'TokenExpiredError';
      throw e;
    });
    const result = await service.evaluate(forgedToken(REAL_DEVICE));
    // Expiry means the device holds a REAL credential that aged out — a benign,
    // expected event, and not the AUTH_INVALID condition this telemetry is for.
    expect(result).toEqual({ httpStatus: 401, body: { code: 'AUTH_EXPIRED' } });
    expect(claimLines()).toHaveLength(0);
    expect(display.findUnique).not.toHaveBeenCalled();
  });

  it('a VALID token still returns 200 and emits no claim telemetry', async () => {
    const TOKEN = 'valid.device.token';
    jwt.verify.mockReturnValue({
      sub: REAL_DEVICE,
      deviceIdentifier: 'dev-1',
      organizationId: 'org-1',
      type: 'device',
    });
    display.findUnique.mockResolvedValue(
      currentDisplay({ jwtToken: hashDeviceToken(TOKEN) }),
    );
    const result = await service.evaluate(TOKEN);
    expect(result).toEqual({ httpStatus: 200, body: { status: 'ok' } });
    expect(claimLines()).toHaveLength(0);
    assertNoWrites();
  });

  it('a DB error still propagates as 5xx — never "credential invalid"', async () => {
    jwt.verify.mockReturnValue({
      sub: REAL_DEVICE,
      deviceIdentifier: 'dev-1',
      organizationId: 'org-1',
      type: 'device',
    });
    display.findUnique.mockRejectedValue(new Error('db down'));
    await expect(service.evaluate('valid.device.token')).rejects.toThrow('db down');
    expect(claimLines()).toHaveLength(0);
  });

  it('a Redis error still propagates as 5xx — never 410 and never "credential invalid"', async () => {
    jwt.verify.mockReturnValue({
      sub: REAL_DEVICE,
      deviceIdentifier: 'dev-1',
      organizationId: 'org-1',
      type: 'device',
    });
    // Stored hash differs → grace lookup → Redis throws.
    display.findUnique.mockResolvedValue(currentDisplay({ jwtToken: 'some-other-hash' }));
    redis.getOrThrow.mockRejectedValue(new Error('redis down'));
    await expect(service.evaluate('valid.device.token')).rejects.toThrow('redis down');
    expect(claimLines()).toHaveLength(0);
  });

  // ---- budget ---------------------------------------------------------------

  it('deduplicates the same claim inside the window', async () => {
    await service.evaluate(forgedToken(REAL_DEVICE));
    await service.evaluate(forgedToken(REAL_DEVICE));
    await service.evaluate(forgedToken(REAL_DEVICE));
    expect(claimLines()).toHaveLength(1); // only the first sighting is logged
    expect(allLines()).toHaveLength(1); // and the repeats add nothing at any level
  });

  it('past the global ceiling no claim value reaches the log at ANY level', async () => {
    const total = CLAIM_TELEMETRY_MAX_PER_WINDOW + 25;
    for (let i = 0; i < total; i++) {
      await service.evaluate(forgedToken(`flood-${i}`));
    }
    // Non-vacuous: the budget's worth of lines was emitted...
    expect(warnClaimLines()).toHaveLength(CLAIM_TELEMETRY_MAX_PER_WINDOW);
    // ...and nothing at all beyond it, at any level.
    expect(claimLines()).toHaveLength(CLAIM_TELEMETRY_MAX_PER_WINDOW);
    expect(debugs()).toHaveLength(0);
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

  it('a throwing logger cannot turn the 401 into a 5xx', async () => {
    // `logUnverifiedClaim` is the first statement in the verify catch block that
    // could throw. If it escaped, `evaluate` would reject and the device would get a
    // Nest 5xx instead of the settled 401 — a changed response for a whole input class.
    warn.mockImplementation(() => {
      throw new Error('EPIPE');
    });
    debug.mockImplementation(() => {
      throw new Error('EPIPE');
    });
    const result = await service.evaluate(forgedToken(REAL_DEVICE));
    expect(result).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
    expect(JSON.stringify(result.body)).toBe('{"code":"AUTH_INVALID"}');
  });

  it('a throwing logger cannot break the suppression-notice path either', async () => {
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_PER_WINDOW; i++) {
      await service.evaluate(forgedToken(`flood-${i}`));
    }
    warn.mockImplementation(() => {
      throw new Error('EPIPE');
    });
    const result = await service.evaluate(forgedToken('over-budget'));
    expect(result).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
  });

  it('emits nothing at all when no claim can be decoded', async () => {
    await service.evaluate('not-a-token');
    expect(allLines()).toHaveLength(0);
  });
});
