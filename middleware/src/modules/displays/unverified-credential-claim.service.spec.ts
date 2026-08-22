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
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetClaimTelemetryState();
  });

  const warnings = () => warn.mock.calls.map((c) => String(c[0]));
  const debugs = () => debug.mock.calls.map((c) => String(c[0]));
  const allLines = () => [...warnings(), ...debugs()];
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
      `device_auth_check_reject code=AUTH_INVALID claimedDeviceId=${REAL_DEVICE} attribution=unverified`,
    ]);
    expect(allLines()).toHaveLength(1);
    // Never the trusted-attribution shape — this endpoint has no verified identity
    // to report on an AUTH_INVALID, and the claim must not be dressed as one.
    expect(allLines().some((l) => /(^|\s)device=/.test(l))).toBe(false);
  });

  it('promotes the attributable rejection to warn, and drops repeats to debug', async () => {
    await service.evaluate(forgedToken(REAL_DEVICE));
    expect(warnClaimLines()).toHaveLength(1);
    expect(debugs()).toHaveLength(0);

    await service.evaluate(forgedToken(REAL_DEVICE));
    expect(warnClaimLines()).toHaveLength(1); // still just the first
    expect(debugs()).toHaveLength(1); // the repeat is still attributed, just quieter
    expect(debugs()[0]).toContain(`claimedDeviceId=${REAL_DEVICE}`);
  });

  it('the 401 response body is byte-identical and carries no claim', async () => {
    const result = await service.evaluate(forgedToken(REAL_DEVICE));
    expect(JSON.stringify(result.body)).toBe('{"code":"AUTH_INVALID"}');
    expect(JSON.stringify(result.body)).not.toContain(REAL_DEVICE);
  });

  it('a fabricated sub naming a real device reads and writes NOTHING', async () => {
    await service.evaluate(forgedToken(REAL_DEVICE));
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
      /^device_auth_check_reject code=AUTH_INVALID claimedDeviceId=[A-Za-z0-9_.:-]+ attribution=unverified$/,
    );
  });

  it('logs the claim on the payload-shape rejection too, and still writes nothing', async () => {
    // Signature verifies, but the token is not a usable device credential.
    jwt.verify.mockReturnValue({ sub: REAL_DEVICE, type: 'user', organizationId: 'org-1' });
    const result = await service.evaluate(forgedToken(REAL_DEVICE));

    expect(result).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
    expect(claimLines()).toHaveLength(1);
    expect(display.findUnique).not.toHaveBeenCalled();
    assertNoWrites();
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
    expect(claimLines()).toHaveLength(3); // every reject stays attributed
    expect(warnClaimLines()).toHaveLength(1); // only the first is promoted
  });

  it('stops emitting past the global ceiling and says so once, with no claim value', async () => {
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_PER_WINDOW + 25; i++) {
      await service.evaluate(forgedToken(`flood-${i}`));
    }
    expect(warnClaimLines()).toHaveLength(CLAIM_TELEMETRY_MAX_PER_WINDOW);
    const suppressed = warnings().filter((l) =>
      l.startsWith('unverified_credential_claim_suppressed'),
    );
    expect(suppressed).toEqual([
      'unverified_credential_claim_suppressed reason=rate-limit note=claim-values-withheld',
    ]);
    expect(suppressed[0]).not.toContain('flood-');
  });

  it('emits nothing at all when no claim can be decoded', async () => {
    await service.evaluate('not-a-token');
    expect(allLines()).toHaveLength(0);
  });
});
