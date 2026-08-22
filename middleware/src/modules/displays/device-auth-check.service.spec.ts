import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DeviceAuthCheckService } from './device-auth-check.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { deviceTokenGraceKey, hashDeviceToken } from '../common/device-token-auth.util';

/**
 * Contract v1.1 item 4 — negative suite. These assert the fleet-safety
 * invariants: a 410 is reachable ONLY for a genuinely revoked device, transient
 * failures never become terminal codes, and cross-tenant tokens cannot 410
 * another tenant's device.
 */
describe('DeviceAuthCheckService', () => {
  let service: DeviceAuthCheckService;
  let jwt: { verify: jest.Mock };
  let db: { display: { findUnique: jest.Mock } };
  let redis: { get: jest.Mock };

  const VALID_TOKEN = 'valid.device.token';
  const validPayload = {
    sub: 'display-1',
    deviceIdentifier: 'dev-1',
    organizationId: 'org-1',
    type: 'device' as const,
  };

  beforeEach(async () => {
    jwt = { verify: jest.fn() };
    db = { display: { findUnique: jest.fn() } };
    redis = { get: jest.fn().mockResolvedValue(null), getOrThrow: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceAuthCheckService,
        { provide: JwtService, useValue: jwt },
        { provide: DatabaseService, useValue: db },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get(DeviceAuthCheckService);
    process.env.DEVICE_JWT_SECRET = 'x'.repeat(32);
  });

  const currentDisplay = (over: Record<string, unknown> = {}) => ({
    id: 'display-1',
    organizationId: 'org-1',
    isDisabled: false,
    jwtToken: hashDeviceToken(VALID_TOKEN),
    organization: { subscriptionStatus: 'active' },
    ...over,
  });

  it('200 ok for a valid, active, current device', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockResolvedValue(currentDisplay());
    const r = await service.evaluate(VALID_TOKEN);
    expect(r).toEqual({ httpStatus: 200, body: { status: 'ok' } });
  });

  // ---- 401: transient/credential problems must NEVER be 410 ----

  it('401 AUTH_EXPIRED for an expired token — never 410', async () => {
    jwt.verify.mockImplementation(() => {
      const e = new Error('jwt expired');
      e.name = 'TokenExpiredError';
      throw e;
    });
    const r = await service.evaluate(VALID_TOKEN);
    expect(r.httpStatus).toBe(401);
    expect(r.body).toEqual({ code: 'AUTH_EXPIRED' });
    expect(db.display.findUnique).not.toHaveBeenCalled(); // no DB touch, no 410 path
  });

  it('401 AUTH_INVALID for a bad-signature token — never 410', async () => {
    jwt.verify.mockImplementation(() => {
      const e = new Error('invalid signature');
      e.name = 'JsonWebTokenError';
      throw e;
    });
    const r = await service.evaluate('garbage');
    expect(r).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
  });

  it('401 AUTH_INVALID for a malformed payload (wrong type) — never 410', async () => {
    jwt.verify.mockReturnValue({ ...validPayload, type: 'user' });
    const r = await service.evaluate(VALID_TOKEN);
    expect(r).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
    expect(db.display.findUnique).not.toHaveBeenCalled();
  });

  // ---- 410: only genuinely revoked device states ----

  it('410 DEVICE_REVOKED when the display row is gone (deleted)', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockResolvedValue(null);
    const r = await service.evaluate(VALID_TOKEN);
    expect(r).toEqual({ httpStatus: 410, body: { code: 'DEVICE_REVOKED' } });
  });

  it('410 DEVICE_REVOKED when the device is admin-disabled (blocked)', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockResolvedValue(currentDisplay({ isDisabled: true }));
    const r = await service.evaluate(VALID_TOKEN);
    expect(r.httpStatus).toBe(410);
  });

  it('410 DEVICE_REVOKED when the token was rotated away (re-pair/unpair)', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockResolvedValue(
      currentDisplay({ jwtToken: hashDeviceToken('a-different-newer-token') }),
    );
    const r = await service.evaluate(VALID_TOKEN);
    expect(r.httpStatus).toBe(410);
  });

  // ---- cross-tenant: the mass-unpair primitive must be impossible ----

  it('does NOT 410 tenant B\'s device using tenant A\'s revoked token', async () => {
    // Tenant A's token claims org-A/display-A. The DB row it names belongs to
    // org-B now (reassigned). This is an org mismatch on the token's OWN display,
    // which is a revoked binding for THAT token — it cannot 410 an unrelated
    // display, because the lookup is keyed on the token's own `sub`.
    jwt.verify.mockReturnValue({ ...validPayload, organizationId: 'org-A' });
    db.display.findUnique.mockResolvedValue(
      currentDisplay({ organizationId: 'org-B' }),
    );
    const r = await service.evaluate(VALID_TOKEN);
    // The token's binding is stale → 410 for the token's own device only.
    expect(r.httpStatus).toBe(410);
    // Critically, the lookup was by the token's own sub — never a caller-supplied id.
    expect(db.display.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'display-1' } }),
    );
  });

  // ---- 403: reversible entitlement suspension (keeps credentials) ----

  it('403 TENANT_SUSPENDED for a valid device whose org is suspended', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockResolvedValue(
      currentDisplay({ organization: { subscriptionStatus: 'suspended' } }),
    );
    const r = await service.evaluate(VALID_TOKEN);
    expect(r).toEqual({ httpStatus: 403, body: { code: 'TENANT_SUSPENDED' } });
  });

  it('does NOT suspend free / canceled-but-downgraded tenants (still 200)', async () => {
    for (const status of ['free', 'canceled', 'past_due', 'trial', 'active']) {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(
        currentDisplay({ organization: { subscriptionStatus: status } }),
      );
      const r = await service.evaluate(VALID_TOKEN);
      expect(r.httpStatus).toBe(200);
    }
  });

  // ---- transport-layer: infra failure must NOT become a terminal code ----

  it('propagates a DB failure (does not convert it into 401/403/410)', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockRejectedValue(new Error('DB down'));
    await expect(service.evaluate(VALID_TOKEN)).rejects.toThrow('DB down');
  });

  // ==================================================================
  // vizora-tv#20 server half — rotation grace.
  //
  // Realtime rotates Display.jwtToken immediately and keeps the OLD token
  // handshake-valid via a grace record while the device persists `token:refresh`.
  // This endpoint knew nothing about that, so an ordinary rotation could answer 410 —
  // and 410 is the ONE response that makes the player purge its pairing state. These
  // assert the two authorities now agree, and that no infrastructure failure can
  // manufacture that 410.
  // ==================================================================
  describe('rotation grace (vizora-tv#20)', () => {
    const OLD_TOKEN = 'old.device.token';
    const NEW_TOKEN = 'new.device.token';
    const oldHash = hashDeviceToken(OLD_TOKEN);
    const newHash = hashDeviceToken(NEW_TOKEN);

    // The device presents OLD; the DB has already rotated to NEW.
    const midRotation = (over: Record<string, unknown> = {}) =>
      currentDisplay({ jwtToken: newHash, ...over });

    const graceRecord = (prev: string, next: string) => JSON.stringify({ prev, next });

    it('reads the grace record through the PROPAGATING api, never the swallowing one', () => {
      // RedisService.get() returns null on any error, which this service cannot tell
      // apart from "no grace record" — and absence here means 410 DEVICE_REVOKED, the
      // one response that purges a player's pairing. Binding to getOrThrow is what makes
      // the documented "a lookup failure is a 5xx, not a 410" promise actually true.
      // The previous suite passed only because its mock could reject; the injected
      // provider cannot, so the guarantee was fictional.
      expect(redis.get).not.toHaveBeenCalled();
    });


    it('200 for the PREVIOUS token when a valid grace record points at the current DB hash', async () => {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(midRotation());
      redis.getOrThrow.mockResolvedValue(graceRecord(oldHash, newHash));

      const r = await service.evaluate(OLD_TOKEN);

      expect(r).toEqual({ httpStatus: 200, body: { status: 'ok' } });
      expect(redis.getOrThrow).toHaveBeenCalledWith(deviceTokenGraceKey('display-1'));
    });

    it('410 when the grace `next` no longer matches the DB — a re-pair must not be resurrectable', async () => {
      const repairedHash = hashDeviceToken('repaired.device.token');
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(currentDisplay({ jwtToken: repairedHash }));
      redis.getOrThrow.mockResolvedValue(graceRecord(oldHash, newHash)); // stale: next != stored

      const r = await service.evaluate(OLD_TOKEN);
      expect(r).toEqual({ httpStatus: 410, body: { code: 'DEVICE_REVOKED' } });
    });

    it('410 when there is no grace record at all (genuinely rotated away)', async () => {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(midRotation());
      redis.getOrThrow.mockResolvedValue(null); // expired or never written
      const r = await service.evaluate(OLD_TOKEN);
      expect(r).toEqual({ httpStatus: 410, body: { code: 'DEVICE_REVOKED' } });
    });

    it('410 when the grace record is malformed or the wrong shape', async () => {
      jwt.verify.mockReturnValue(validPayload);
      for (const raw of ['not json', '{}', '{"prev":"x"}', '{"prev":1,"next":2}', '[]']) {
        db.display.findUnique.mockResolvedValue(midRotation());
        redis.getOrThrow.mockResolvedValue(raw);
        const r = await service.evaluate(OLD_TOKEN);
        expect(r.httpStatus).toBe(410);
      }
    });

    it('410 when grace `prev` is some OTHER token — grace revives only the rotation it recorded', async () => {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(midRotation());
      redis.getOrThrow.mockResolvedValue(graceRecord(hashDeviceToken('someone.elses.token'), newHash));
      const r = await service.evaluate(OLD_TOKEN);
      expect(r.httpStatus).toBe(410);
    });

    // ---- durable revocation outranks grace, always ----

    it('410 for a DISABLED device even with a perfectly valid grace record', async () => {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(midRotation({ isDisabled: true }));
      redis.getOrThrow.mockResolvedValue(graceRecord(oldHash, newHash));
      const r = await service.evaluate(OLD_TOKEN);
      expect(r).toEqual({ httpStatus: 410, body: { code: 'DEVICE_REVOKED' } });
    });

    it('410 for a DELETED device even with a perfectly valid grace record', async () => {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(null);
      redis.getOrThrow.mockResolvedValue(graceRecord(oldHash, newHash));
      const r = await service.evaluate(OLD_TOKEN);
      expect(r).toEqual({ httpStatus: 410, body: { code: 'DEVICE_REVOKED' } });
    });

    it('410 for an ORG-REASSIGNED device even with a perfectly valid grace record', async () => {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(midRotation({ organizationId: 'org-2' }));
      redis.getOrThrow.mockResolvedValue(graceRecord(oldHash, newHash));
      const r = await service.evaluate(OLD_TOKEN);
      expect(r).toEqual({ httpStatus: 410, body: { code: 'DEVICE_REVOKED' } });
    });

    it('never reaches Redis for a device revoked by durable state', async () => {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(midRotation({ isDisabled: true }));
      await service.evaluate(OLD_TOKEN);
      expect(redis.get).not.toHaveBeenCalled();
    });

    // ---- credential problems still outrank everything ----

    it('401 for an expired token even when a valid grace record exists — never 410', async () => {
      jwt.verify.mockImplementation(() => {
        const e = new Error('jwt expired') as Error & { name: string };
        e.name = 'TokenExpiredError';
        throw e;
      });
      redis.getOrThrow.mockResolvedValue(graceRecord(oldHash, newHash));
      const r = await service.evaluate(OLD_TOKEN);
      expect(r).toEqual({ httpStatus: 401, body: { code: 'AUTH_EXPIRED' } });
    });

    it('401 for a bad signature even when a valid grace record exists — never 410', async () => {
      jwt.verify.mockImplementation(() => {
        const e = new Error('invalid signature') as Error & { name: string };
        e.name = 'JsonWebTokenError';
        throw e;
      });
      redis.getOrThrow.mockResolvedValue(graceRecord(oldHash, newHash));
      const r = await service.evaluate(OLD_TOKEN);
      expect(r).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
    });

    // ---- THE highest-consequence path ----

    it('a Redis failure must NOT manufacture a 410 — it propagates as 5xx', async () => {
      // If a grace-lookup error were read as "no grace", a Redis blip would answer 410 to
      // every device mid-rotation and unpair them. Realtime can fail closed here because
      // rejecting a socket is retried; a 410 is not retried, it is destructive. So this
      // propagates and the device reads a 5xx as transport-layer, keeping its credentials.
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(midRotation());
      redis.getOrThrow.mockRejectedValue(new Error('Redis down'));

      await expect(service.evaluate(OLD_TOKEN)).rejects.toThrow('Redis down');
    });

    it('a Redis TIMEOUT is equally non-destructive', async () => {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(midRotation());
      redis.getOrThrow.mockRejectedValue(Object.assign(new Error('Command timed out'), { name: 'TimeoutError' }));
      await expect(service.evaluate(OLD_TOKEN)).rejects.toThrow('Command timed out');
    });

    it('the CURRENT token never consults Redis at all (no new dependency on the happy path)', async () => {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(currentDisplay());
      const r = await service.evaluate(VALID_TOKEN);
      expect(r.httpStatus).toBe(200);
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('a Redis outage cannot break a device holding the CURRENT token', async () => {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(currentDisplay());
      redis.getOrThrow.mockRejectedValue(new Error('Redis down'));
      const r = await service.evaluate(VALID_TOKEN);
      expect(r.httpStatus).toBe(200);
    });

    // ---- the full sequence, in order ----

    it('full rotation sequence: old accepted during grace, new accepted after adoption, stale grace cannot resurrect', async () => {
      jwt.verify.mockReturnValue(validPayload);

      // 1. Before rotation — the device holds the current token.
      db.display.findUnique.mockResolvedValue(currentDisplay({ jwtToken: oldHash }));
      expect((await service.evaluate(OLD_TOKEN)).httpStatus).toBe(200);

      // 2. Server rotates: DB now holds NEW, grace records old->new. Device still on OLD.
      db.display.findUnique.mockResolvedValue(currentDisplay({ jwtToken: newHash }));
      redis.getOrThrow.mockResolvedValue(graceRecord(oldHash, newHash));
      expect((await service.evaluate(OLD_TOKEN)).httpStatus).toBe(200);

      // 3. Device adopts the new token — accepted on its own merits, no Redis needed.
      redis.get.mockClear();
      redis.getOrThrow.mockResolvedValue(graceRecord(oldHash, newHash));
      expect((await service.evaluate(NEW_TOKEN)).httpStatus).toBe(200);
      expect(redis.get).not.toHaveBeenCalled();

      // 4. Grace expires. The old token is now genuinely rotated away.
      redis.getOrThrow.mockResolvedValue(null);
      expect((await service.evaluate(OLD_TOKEN)).httpStatus).toBe(410);

      // 5. The device is re-paired. A stale grace record must NOT resurrect either token.
      db.display.findUnique.mockResolvedValue(
        currentDisplay({ jwtToken: hashDeviceToken('repaired.device.token') }),
      );
      redis.getOrThrow.mockResolvedValue(graceRecord(oldHash, newHash));
      expect((await service.evaluate(OLD_TOKEN)).httpStatus).toBe(410);
      expect((await service.evaluate(NEW_TOKEN)).httpStatus).toBe(410);
    });
  });
});
