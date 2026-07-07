import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app/app.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { SanitizeInterceptor } from '../src/modules/common/interceptors/sanitize.interceptor';
import { ResponseEnvelopeInterceptor } from '../src/modules/common/interceptors/response-envelope.interceptor';
import { setupTwoTenants, teardownFixture, dataOf, type TwoTenantFixture } from './fixtures/two-tenant.fixture';

/**
 * B12 — canonical two-tenant pair→publish→playback→revoke E2E.
 *
 * The revocation leg asserts the full Slice 0 promise at integration level
 * against the real auth/check endpoint (the sole revocation authority):
 *  - genuine revocation → 410 DEVICE_REVOKED (confirm-before-purge subject)
 *  - transient/expired credential → 401 (never 410) — the F3 non-behavior: the
 *    server never emits a terminal code for a transient case, so the device never
 *    purges
 *  - cross-tenant: one tenant's device token cannot 410 another's device, and a
 *    device cannot read another tenant's schedule/content (zero content bleed
 *    through playlist assembly)
 *
 * Gated on the test DB (docker-compose.test.yml) — design-complete regardless.
 */
describe('B12 multi-tenant pair→publish→playback→revoke (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let redis: RedisService;
  let jwt: JwtService;
  let fx: TwoTenantFixture;
  const ts = Date.now();

  const DEVICE_SECRET = process.env.DEVICE_JWT_SECRET;

  beforeAll(async () => {
    // Neutralize rate limiting for this suite: b12 exercises revocation +
    // cross-tenant isolation, not throttling. In-process supertest requests all
    // originate from 127.0.0.1, so the IP-keyed global ThrottlerGuard collapses
    // the repeated /devices/auth/check calls into one 2-per-30s bucket (see
    // device-auth.controller.ts @Throttle) and returns 429. The global guard is
    // an APP_GUARD, so overrideGuard() can't reach it; overriding the shared
    // ThrottlerStorage with a non-blocking stub neutralizes every throttler
    // (global + per-token) at the source without weakening what this suite verifies.
    const nonBlockingThrottlerStorage: ThrottlerStorage = {
      increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage).useValue(nonBlockingThrottlerStorage)
      .compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    const reflector = app.get(Reflector);
    app.useGlobalInterceptors(new SanitizeInterceptor(reflector), new ResponseEnvelopeInterceptor(reflector));
    await app.init();

    db = moduleFixture.get(DatabaseService);
    redis = moduleFixture.get(RedisService);
    jwt = moduleFixture.get(JwtService);
    fx = await setupTwoTenants(app, db, ts);
  }, 120000);

  afterAll(async () => {
    if (fx) {
      for (const code of fx.pairingCodes) await redis.del(`pairing:${code}`).catch(() => {});
      await teardownFixture(db, fx);
    }
    await db.$disconnect();
    await app.close();
  }, 60000);

  const authCheck = (token: string) =>
    request(app.getHttpServer()).get('/api/v1/devices/auth/check').set('Authorization', `Bearer ${token}`);

  const activeSchedule = (displayId: string, token: string) =>
    request(app.getHttpServer()).get(`/api/v1/schedules/active/${displayId}`).set('Authorization', `Bearer ${token}`);

  // ---- playback assembly ----

  it('playback: each device receives ITS OWN tenant playlist + content', async () => {
    const a = await activeSchedule(fx.tenantA.device.displayId, fx.tenantA.device.deviceToken).expect(200);
    const aSchedules = dataOf<Array<{ id: string; playlistId: string; playlist?: { items: Array<{ content: { id: string; name: string } }> } }>>(a.body);
    const aSched = aSchedules.find((s) => s.id === fx.tenantA.scheduleId);
    expect(aSched?.playlistId).toBe(fx.tenantA.playlistId);
    expect(aSched?.playlist?.items[0].content.id).toBe(fx.tenantA.contentId);

    const b = await activeSchedule(fx.tenantB.device.displayId, fx.tenantB.device.deviceToken).expect(200);
    const bSchedules = dataOf<Array<{ id: string; playlistId: string; playlist?: { items: Array<{ content: { id: string } }> } }>>(b.body);
    const bSched = bSchedules.find((s) => s.id === fx.tenantB.scheduleId);
    expect(bSched?.playlist?.items[0].content.id).toBe(fx.tenantB.contentId);
  });

  it('zero cross-tenant bleed: A\'s assembled playlist never contains B\'s content id', async () => {
    const a = await activeSchedule(fx.tenantA.device.displayId, fx.tenantA.device.deviceToken).expect(200);
    const aSchedules = dataOf<Array<{ playlist?: { items: Array<{ content: { id: string } }> } }>>(a.body);
    const allContentIds = aSchedules.flatMap((s) => s.playlist?.items.map((i) => i.content.id) ?? []);
    expect(allContentIds).not.toContain(fx.tenantB.contentId);
  });

  it('cross-tenant: B\'s device token cannot read A\'s active schedule (401)', async () => {
    await activeSchedule(fx.tenantA.device.displayId, fx.tenantB.device.deviceToken).expect(401);
  });

  it('cross-tenant publish: B cannot build a playlist referencing A\'s content (404)', async () => {
    const { browserCsrfHeaders } = await import('./fixtures/two-tenant.fixture');
    await request(app.getHttpServer())
      .post('/api/v1/playlists')
      .set(await browserCsrfHeaders(app, fx.tenantB.authCookie))
      .send({ name: 'Bleed Attempt', loop: true, items: [{ contentId: fx.tenantA.contentId, duration: 10 }] })
      .expect(404);
  });

  // ---- revocation leg: the full Slice 0 promise via auth/check ----

  it('auth/check: a valid, active device → 200 ok', async () => {
    const res = await authCheck(fx.tenantA.device.deviceToken).expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('auth/check: a genuinely revoked (disabled) device → 410 DEVICE_REVOKED', async () => {
    const res = await authCheck(fx.tenantA.revokedDeviceToken as string).expect(410);
    expect(res.body).toEqual({ code: 'DEVICE_REVOKED' });
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('F3 non-behavior: an EXPIRED device token → 401 AUTH_EXPIRED, never 410', async () => {
    // Sign a structurally-valid device token for A's real display, but expired.
    const expired = jwt.sign(
      { sub: fx.tenantA.device.displayId, deviceIdentifier: fx.tenantA.device.deviceIdentifier, organizationId: fx.tenantA.organizationId, type: 'device' },
      { secret: DEVICE_SECRET, algorithm: 'HS256', expiresIn: '-10s' },
    );
    const res = await authCheck(expired).expect(401);
    expect(res.body).toEqual({ code: 'AUTH_EXPIRED' });
  });

  it('F3 non-behavior: a malformed token → 401 AUTH_INVALID, never 410', async () => {
    const res = await authCheck('not.a.valid.jwt').expect(401);
    expect(res.body).toEqual({ code: 'AUTH_INVALID' });
  });

  it('cross-tenant 410 impossibility: B\'s token cannot 410 — it resolves to B\'s own state', async () => {
    // B's token names B's own (valid) display → 200. It can never produce a 410
    // for A's device, because the endpoint keys on the token's own sub.
    const res = await authCheck(fx.tenantB.device.deviceToken).expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('a token whose display was deleted → 410 (deletion == revocation)', async () => {
    // Pair a throwaway device for B, delete its display, confirm 410. Uses a
    // FRESH login — the stashed fixture cookie is stale for a late pairing write.
    const { browserCsrfHeaders, freshLogin } = await import('./fixtures/two-tenant.fixture');
    const freshCookie = await freshLogin(app, fx.tenantB.email, fx.tenantB.password);
    const reqRes = await request(app.getHttpServer())
      .post('/api/v1/devices/pairing/request')
      .send({ deviceIdentifier: `b12-del-${ts}`, nickname: 'del', metadata: {} })
      .expect(201);
    const code = dataOf<{ code: string }>(reqRes.body).code;
    fx.pairingCodes.push(code);
    const complete = await request(app.getHttpServer())
      .post('/api/v1/devices/pairing/complete')
      .set(await browserCsrfHeaders(app, freshCookie))
      .send({ code, nickname: 'del', location: 'lab' })
      .expect(201);
    const displayId = (complete.body as { display: { id: string } }).display.id;
    const status = await request(app.getHttpServer()).get(`/api/v1/devices/pairing/status/${code}`).expect(200);
    const token = dataOf<{ deviceToken: string }>(status.body).deviceToken;

    await authCheck(token).expect(200); // valid before deletion
    await db.display.delete({ where: { id: displayId } });
    const res = await authCheck(token).expect(410); // deleted → revoked
    expect(res.body).toEqual({ code: 'DEVICE_REVOKED' });
  });
});
