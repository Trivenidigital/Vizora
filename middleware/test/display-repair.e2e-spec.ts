import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app/app.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { SanitizeInterceptor } from '../src/modules/common/interceptors/sanitize.interceptor';
import { ResponseEnvelopeInterceptor } from '../src/modules/common/interceptors/response-envelope.interceptor';

/**
 * REPAIR — re-pair an EXISTING display against a REAL Postgres.
 *
 * `pairing.service.repair.spec.ts` proves the branching and the race outcomes
 * against in-memory fakes. The constructs that a fake can only MODEL are proved
 * here, because getting any of them wrong is silent:
 *   - `Display.deviceIdentifier` is `@unique` — the ghost takeover either works
 *     against the real index or it does not;
 *   - `currentPlaylistId` is a real FK, and "the playlist survives" means the
 *     row still points at it after the write, not that a mock echoed it back;
 *   - `screenQuota` is counted by Postgres, not by a stub;
 *   - the rebind runs inside a real `$transaction`, so a failure part-way
 *     through must leave nothing behind. A temporary BEFORE INSERT trigger on
 *     the audit table is the only honest way to fail the LAST write in that
 *     transaction and watch the earlier ones disappear.
 */

type RegisterData = {
  access_token: string;
  user: { id: string; organizationId: string };
};

type PairingRequestData = { code: string };

type PairingCompleteBody = {
  success: boolean;
  display: { id: string; deviceIdentifier: string; status: string };
};

type PairingStatusData = {
  status: string;
  deviceToken: string;
  deviceId: string;
  organizationId: string;
};

const dataOf = <T>(body: unknown): T => (body as { data: T }).data;

const cookieHeaderFromSetCookie = (setCookie: string | string[] | undefined): string => {
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
};

const withoutCsrfCookie = (cookieHeader: string): string =>
  cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie && !cookie.startsWith('vizora_csrf_token='))
    .join('; ');

describe('Display repair — rebind an existing display (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let redis: RedisService;
  let throttlerStorage: ThrottlerStorage;

  const userIds: string[] = [];
  const organizationIds: string[] = [];
  const pairingCodes: string[] = [];
  const timestamp = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.use(
      helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
    );
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    const reflector = app.get(Reflector);
    app.useGlobalInterceptors(
      new SanitizeInterceptor(reflector),
      new ResponseEnvelopeInterceptor(reflector),
    );

    await app.init();
    db = moduleFixture.get<DatabaseService>(DatabaseService);
    redis = moduleFixture.get<RedisService>(RedisService);
    throttlerStorage = moduleFixture.get<ThrottlerStorage>(ThrottlerStorage);
  }, 60000);

  // `POST /devices/pairing/request` carries `@Throttle({ default: { limit: 5 } })`,
  // which fires in test too (PD-4) — and a repair scenario legitimately needs
  // more than five pairing sessions. Reset the counters between tests rather
  // than stubbing the guard, so the guard itself stays real. Reset the hit
  // counts in place — deleting the keys orphans the storage's own expiry
  // timers, which then throw on fire.
  beforeEach(() => {
    const { storage } = throttlerStorage as unknown as {
      storage: Map<string, { totalHits: Map<string, number>; isBlocked: boolean }>;
    };
    for (const record of storage.values()) {
      for (const key of record.totalHits.keys()) {
        record.totalHits.set(key, 0);
      }
      record.isBlocked = false;
    }
  });

  afterAll(async () => {
    for (const code of pairingCodes) {
      await redis.del(`pairing:${code}`).catch(() => undefined);
    }
    for (const id of userIds) {
      await db.user.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of organizationIds) {
      await db.organization.delete({ where: { id } }).catch(() => undefined);
    }
    await db.$disconnect();
    await app.close();
  }, 60000);

  const csrfHeaders = async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);
    return {
      Cookie: cookieHeaderFromSetCookie(res.headers['set-cookie']),
      'X-CSRF-Token': String(res.headers['x-csrf-token']),
    };
  };

  const browserHeaders = async (authCookie: string) => {
    const csrf = await csrfHeaders();
    return {
      Cookie: [withoutCsrfCookie(authCookie), csrf.Cookie].filter(Boolean).join('; '),
      'X-CSRF-Token': csrf['X-CSRF-Token'],
    };
  };

  const registerAccount = async (suffix: string) => {
    const email = `repair-${suffix}-${timestamp}@example.com`;
    const password = 'SecureP@ssw0rd!';
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Repair',
        lastName: 'Tester',
        organizationName: `Repair ${suffix} E2E Org`,
        organizationSlug: `repair-${suffix}-${timestamp}`,
      })
      .expect(201);
    const registered = dataOf<RegisterData>(registerRes.body);
    userIds.push(registered.user.id);
    organizationIds.push(registered.user.organizationId);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    const login = dataOf<RegisterData>(loginRes.body);

    return {
      authCookie: cookieHeaderFromSetCookie(loginRes.headers['set-cookie']),
      userId: registered.user.id,
      organizationId: registered.user.organizationId,
    };
  };

  const requestPairingCode = async (deviceIdentifier: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/devices/pairing/request')
      .send({
        deviceIdentifier,
        nickname: 'Whatever The TV Calls Itself',
        metadata: { platform: 'e2e' },
      })
      .expect(201);
    const { code } = dataOf<PairingRequestData>(res.body);
    pairingCodes.push(code);
    return code;
  };

  const completePairing = async (
    authCookie: string,
    body: Record<string, unknown>,
    expectStatus: number,
  ) =>
    request(app.getHttpServer())
      .post('/api/v1/devices/pairing/complete')
      .set(await browserHeaders(authCookie))
      .send(body)
      .expect(expectStatus);

  const pollForToken = async (code: string) => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/devices/pairing/status/${code}`)
      .expect(200);
    return dataOf<PairingStatusData>(res.body);
  };

  /** Pair a fresh device, then give the row a playlist + operator-chosen name. */
  const seedConfiguredDisplay = async (
    account: { authCookie: string; organizationId: string },
    suffix: string,
  ) => {
    const deviceIdentifier = `repair-${suffix}-original-${timestamp}`;
    const code = await requestPairingCode(deviceIdentifier);
    const res = await completePairing(
      account.authCookie,
      { code, nickname: `Lobby ${suffix}`, location: 'Lobby' },
      201,
    );
    const paired = res.body as PairingCompleteBody;
    const status = await pollForToken(code);

    const playlist = await db.playlist.create({
      data: {
        name: `Repair ${suffix} Playlist`,
        organizationId: account.organizationId,
      },
    });
    // `location` is set directly: the CREATE branch of completePairing derives
    // it from the device's own metadata hostname and ignores the dto, so the
    // operator value has to be written afterwards to be preserved later.
    await db.display.update({
      where: { id: paired.display.id },
      data: {
        currentPlaylistId: playlist.id,
        orientation: 'portrait',
        location: 'Lobby',
      },
    });

    return {
      displayId: paired.display.id,
      deviceIdentifier,
      playlistId: playlist.id,
      deviceToken: status.deviceToken,
    };
  };

  it('rebinds onto the existing row: id, playlist and operator config survive a real write', async () => {
    const account = await registerAccount('happy');
    const original = await seedConfiguredDisplay(account, 'happy');

    // The TV was factory-reset and now presents a brand-new identifier.
    const newIdentifier = `repair-happy-replacement-${timestamp}`;
    const code = await requestPairingCode(newIdentifier);

    const res = await completePairing(
      account.authCookie,
      { code, targetDisplayId: original.displayId },
      201,
    );
    const body = res.body as PairingCompleteBody;
    expect(body.display.id).toBe(original.displayId);
    expect(body.display.deviceIdentifier).toBe(newIdentifier);

    const row = await db.display.findUniqueOrThrow({
      where: { id: original.displayId },
    });
    expect(row.deviceIdentifier).toBe(newIdentifier);
    expect(row.currentPlaylistId).toBe(original.playlistId);
    expect(row.nickname).toBe('Lobby happy');
    expect(row.location).toBe('Lobby');
    expect(row.orientation).toBe('portrait');
    expect(row.status).toBe('pairing');
    expect(row.socketId).toBeNull();

    // No second row was created for this org.
    const orgDisplays = await db.display.count({
      where: { organizationId: account.organizationId },
    });
    expect(orgDisplays).toBe(1);

    // The poller receives a credential bound to the PRESERVED display.
    const status = await pollForToken(code);
    expect(status.status).toBe('paired');
    expect(status.deviceId).toBe(original.displayId);

    // Old credential is dead against the live authority; new one is accepted.
    await request(app.getHttpServer())
      .get('/api/v1/devices/auth/check')
      .set('Authorization', `Bearer ${original.deviceToken}`)
      .expect(410);
    await request(app.getHttpServer())
      .get('/api/v1/devices/auth/check')
      .set('Authorization', `Bearer ${status.deviceToken}`)
      .expect(200);

    // Audit row really persisted, names the actor and the display, no secrets.
    const audit = await db.auditLog.findFirst({
      where: { entityId: original.displayId, action: 'display_repaired' },
    });
    expect(audit).toBeTruthy();
    expect(audit?.userId).toBe(account.userId);
    expect(audit?.displayId).toBe(original.displayId);
    expect(audit?.organizationId).toBe(account.organizationId);
    const serialized = JSON.stringify(audit?.changes);
    expect(serialized).toContain(newIdentifier);
    expect(serialized).not.toContain(original.deviceToken);
    expect(serialized).not.toContain(status.deviceToken);
    expect(serialized).not.toContain(code);
  }, 60000);

  it('takes the identifier over from a same-org ghost against the real unique index', async () => {
    const account = await registerAccount('ghost');
    const original = await seedConfiguredDisplay(account, 'ghost');

    // The clear-and-pair that created the problem: a second row for the same box.
    const sharedIdentifier = `repair-ghost-shared-${timestamp}`;
    const ghostCode = await requestPairingCode(sharedIdentifier);
    const ghostRes = await completePairing(account.authCookie, { code: ghostCode }, 201);
    const ghostId = (ghostRes.body as PairingCompleteBody).display.id;
    await pollForToken(ghostCode);

    // The box is reset again and comes back on the SAME identifier. Free it
    // first, exactly as a real second reset would (a paired row blocks the
    // request endpoint outright).
    await db.display.update({
      where: { id: ghostId },
      data: { jwtToken: null },
    });
    const code = await requestPairingCode(sharedIdentifier);

    await completePairing(
      account.authCookie,
      { code, targetDisplayId: original.displayId },
      201,
    );

    const target = await db.display.findUniqueOrThrow({
      where: { id: original.displayId },
    });
    expect(target.deviceIdentifier).toBe(sharedIdentifier);
    expect(target.currentPlaylistId).toBe(original.playlistId);

    const ghost = await db.display.findUniqueOrThrow({ where: { id: ghostId } });
    expect(ghost.deviceIdentifier).toBe(`retired:${ghostId}`);
    expect(ghost.jwtToken).toBeNull();
    expect(ghost.isDisabled).toBe(true);
    expect(ghost.unpairedAt).toBeTruthy();
  }, 60000);

  it('a rebind consumes no quota slot, but a genuinely new screen at the limit is still refused', async () => {
    const account = await registerAccount('quota');
    const original = await seedConfiguredDisplay(account, 'quota');

    // One paired display; pin the quota to exactly that.
    await db.organization.update({
      where: { id: account.organizationId },
      data: { screenQuota: 1 },
    });

    // Rebind at the limit — must succeed.
    const rebindIdentifier = `repair-quota-replacement-${timestamp}`;
    const rebindCode = await requestPairingCode(rebindIdentifier);
    await completePairing(
      account.authCookie,
      { code: rebindCode, targetDisplayId: original.displayId },
      201,
    );
    expect(
      await db.display.count({
        where: { organizationId: account.organizationId, isDisabled: false },
      }),
    ).toBe(1);

    // A genuinely additional screen at the same limit — must still be refused.
    const extraCode = await requestPairingCode(`repair-quota-extra-${timestamp}`);
    await completePairing(account.authCookie, { code: extraCode }, 403);
    expect(
      await db.display.count({
        where: { organizationId: account.organizationId, isDisabled: false },
      }),
    ).toBe(1);
  }, 60000);

  it('refuses a target display owned by another organization', async () => {
    const owner = await registerAccount('victim');
    const attacker = await registerAccount('attacker');
    const victimDisplay = await seedConfiguredDisplay(owner, 'victim');

    const code = await requestPairingCode(`repair-attacker-box-${timestamp}`);
    await completePairing(
      attacker.authCookie,
      { code, targetDisplayId: victimDisplay.displayId },
      404,
    );

    const row = await db.display.findUniqueOrThrow({
      where: { id: victimDisplay.displayId },
    });
    expect(row.organizationId).toBe(owner.organizationId);
    expect(row.deviceIdentifier).toBe(victimDisplay.deviceIdentifier);
    expect(row.currentPlaylistId).toBe(victimDisplay.playlistId);
    await request(app.getHttpServer())
      .get('/api/v1/devices/auth/check')
      .set('Authorization', `Bearer ${victimDisplay.deviceToken}`)
      .expect(200);
  }, 60000);

  it('a failure inside the transaction leaves the original display usable and no ghost row', async () => {
    const account = await registerAccount('rollback');
    const original = await seedConfiguredDisplay(account, 'rollback');

    // Fail the LAST write of the rebind transaction (the audit insert) from
    // inside Postgres, so the earlier display write has to be rolled back by
    // the database rather than by anything the application does.
    await db.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION vizora_repair_rollback_probe() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'vizora repair rollback probe';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await db.$executeRawUnsafe(`
      CREATE TRIGGER vizora_repair_rollback_probe_trg
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW WHEN (NEW.action = 'display_repaired')
      EXECUTE FUNCTION vizora_repair_rollback_probe();
    `);

    try {
      const code = await requestPairingCode(`repair-rollback-box-${timestamp}`);
      await completePairing(
        account.authCookie,
        { code, targetDisplayId: original.displayId },
        500,
      );

      const row = await db.display.findUniqueOrThrow({
        where: { id: original.displayId },
      });
      expect(row.deviceIdentifier).toBe(original.deviceIdentifier);
      expect(row.currentPlaylistId).toBe(original.playlistId);
      expect(row.nickname).toBe('Lobby rollback');
      expect(
        await db.display.count({ where: { organizationId: account.organizationId } }),
      ).toBe(1);
      expect(
        await db.auditLog.count({
          where: { entityId: original.displayId, action: 'display_repaired' },
        }),
      ).toBe(0);

      // The display is still usable: its existing credential still authenticates.
      await request(app.getHttpServer())
        .get('/api/v1/devices/auth/check')
        .set('Authorization', `Bearer ${original.deviceToken}`)
        .expect(200);

      // And the session was never handed a credential.
      const status = await pollForToken(code);
      expect(status.status).toBe('pending');
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS vizora_repair_rollback_probe_trg ON "AuditLog";',
      );
      await db.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS vizora_repair_rollback_probe();',
      );
    }
  }, 60000);
});
