import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app/app.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { SanitizeInterceptor } from '../src/modules/common/interceptors/sanitize.interceptor';
import { ResponseEnvelopeInterceptor } from '../src/modules/common/interceptors/response-envelope.interceptor';

type RegisterData = {
  access_token: string;
  user: {
    id: string;
    organizationId: string;
  };
};

type CsrfHeaders = {
  Cookie: string;
  'X-CSRF-Token': string;
};

type PairingRequestData = {
  code: string;
};

type PairingCompleteBody = {
  success: boolean;
  display: {
    id: string;
    deviceIdentifier: string;
    status: string;
  };
};

type PairingStatusData = {
  status: string;
  deviceToken: string;
  deviceId: string;
  organizationId: string;
};

type ContentData = {
  id: string;
  name: string;
  type: string;
  url: string;
};

type PlaylistData = {
  id: string;
  items: Array<{
    contentId: string;
    duration: number | null;
    content: {
      id: string;
      name: string;
      type: string;
      url: string;
    };
  }>;
};

type ScheduleData = {
  id: string;
  displayId: string;
  playlistId: string;
  playlist?: PlaylistData;
};

type Envelope<T> = {
  success: boolean;
  data: T;
};

const dataOf = <T>(body: Envelope<T>): T => {
  expect(body.success).toBe(true);
  return body.data;
};

const cookieHeaderFromSetCookie = (setCookie: string | string[] | undefined): string => {
  const cookies = Array.isArray(setCookie)
    ? setCookie
    : setCookie
      ? [setCookie]
      : [];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
};

const withoutCsrfCookie = (cookieHeader: string): string =>
  cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie && !cookie.startsWith('vizora_csrf_token='))
    .join('; ');

describe('Customer critical path (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let redis: RedisService;
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
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
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
  });

  afterAll(async () => {
    for (const code of pairingCodes) {
      await redis.del(`pairing:${code}`).catch(() => {});
    }

    for (const id of userIds) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
    for (const id of organizationIds) {
      await db.organization.delete({ where: { id } }).catch(() => {});
    }
    await db.$disconnect();
    await app.close();
  }, 60000);

  const csrfHeaders = async (): Promise<CsrfHeaders> => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);

    const token = res.headers['x-csrf-token'];
    const setCookie = res.headers['set-cookie'];
    const cookieHeader = cookieHeaderFromSetCookie(setCookie);

    expect(token).toBeTruthy();
    expect(cookieHeader).toContain('vizora_csrf_token=');

    return {
      Cookie: cookieHeader,
      'X-CSRF-Token': String(token),
    };
  };

  const browserCsrfHeaders = async (authCookie: string) => {
    const csrf = await csrfHeaders();

    return {
      Cookie: [withoutCsrfCookie(authCookie), csrf.Cookie].filter(Boolean).join('; '),
      'X-CSRF-Token': csrf['X-CSRF-Token'],
    };
  };

  const registerAccount = async (
    suffix: string,
    role: 'admin' | 'manager' | 'viewer' = 'admin',
  ) => {
    const email = `customer-path-${suffix}-${timestamp}@example.com`;
    const password = 'SecureP@ssw0rd!';
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Customer',
        lastName: 'Path',
        organizationName: `Customer Path ${suffix} E2E Org`,
        organizationSlug: `customer-path-${suffix}-${timestamp}`,
      })
      .expect(201);
    const registerData = dataOf<RegisterData>(registerRes.body);
    userIds.push(registerData.user.id);
    organizationIds.push(registerData.user.organizationId);

    if (role !== 'admin') {
      await db.user.update({
        where: { id: registerData.user.id },
        data: { role },
      });
    }

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    const loginData = dataOf<RegisterData>(loginRes.body);
    expect(loginData.user.id).toBe(registerData.user.id);
    expect(loginData.user.organizationId).toBe(registerData.user.organizationId);

    return {
      authToken: loginData.access_token,
      authCookie: cookieHeaderFromSetCookie(loginRes.headers['set-cookie']),
      userId: registerData.user.id,
      organizationId: registerData.user.organizationId,
    };
  };

  const pairDisplay = async (authCookie: string, suffix: string) => {
    const deviceIdentifier = `customer-path-${suffix}-display-${timestamp}`;
    const pairingRequestRes = await request(app.getHttpServer())
      .post('/api/v1/devices/pairing/request')
      .send({
        deviceIdentifier,
        nickname: `Customer Path ${suffix} Display`,
        metadata: { platform: 'e2e' },
      })
      .expect(201);
    const pairingRequest = dataOf<PairingRequestData>(pairingRequestRes.body);
    expect(pairingRequest.code).toMatch(/^[A-Z0-9]{6}$/);
    pairingCodes.push(pairingRequest.code);

    const pairingCompleteRes = await request(app.getHttpServer())
      .post('/api/v1/devices/pairing/complete')
      .set(await browserCsrfHeaders(authCookie))
      .send({
        code: pairingRequest.code,
        nickname: `Customer Path ${suffix} Display`,
        location: 'Customer Test Lab',
      })
      .expect(201);
    const pairingComplete = pairingCompleteRes.body as PairingCompleteBody;
    expect(pairingComplete.success).toBe(true);
    expect(pairingComplete.display.deviceIdentifier).toBe(deviceIdentifier);

    const pairingStatusRes = await request(app.getHttpServer())
      .get(`/api/v1/devices/pairing/status/${pairingRequest.code}`)
      .expect(200);
    const pairingStatus = dataOf<PairingStatusData>(pairingStatusRes.body);
    expect(pairingStatus.status).toBe('paired');
    expect(pairingStatus.deviceId).toBe(pairingComplete.display.id);
    expect(pairingStatus.deviceToken).toBeTruthy();

    return {
      displayId: pairingComplete.display.id,
      deviceIdentifier,
      deviceToken: pairingStatus.deviceToken,
      organizationId: pairingStatus.organizationId,
    };
  };

  it('rejects protected dashboard mutations without a CSRF token', async () => {
    const account = await registerAccount('missing-csrf');

    await request(app.getHttpServer())
      .post('/api/v1/content')
      .set('Cookie', account.authCookie)
      .send({
        name: 'Missing CSRF Content',
        type: 'url',
        url: `https://example.com/vizora-missing-csrf-${timestamp}`,
        duration: 10,
      })
      .expect(403);
  });

  it('rejects viewer pairing completion at the API boundary', async () => {
    const viewerAccount = await registerAccount('viewer', 'viewer');
    const deviceIdentifier = `customer-path-viewer-display-${timestamp}`;
    const pairingRequestRes = await request(app.getHttpServer())
      .post('/api/v1/devices/pairing/request')
      .send({
        deviceIdentifier,
        nickname: 'Viewer Display',
        metadata: { platform: 'e2e' },
      })
      .expect(201);
    const pairingRequest = dataOf<PairingRequestData>(pairingRequestRes.body);
    pairingCodes.push(pairingRequest.code);

    await request(app.getHttpServer())
      .post('/api/v1/devices/pairing/complete')
      .set(await browserCsrfHeaders(viewerAccount.authCookie))
      .send({
        code: pairingRequest.code,
        nickname: 'Viewer Display',
        location: 'Customer Test Lab',
      })
      .expect(403);

    const pairingStatusRes = await request(app.getHttpServer())
      .get(`/api/v1/devices/pairing/status/${pairingRequest.code}`)
      .expect(200);
    const pairingStatus = dataOf<{ status: string }>(pairingStatusRes.body);
    expect(pairingStatus.status).toBe('pending');
  });

  it('delivers scheduled playlist content to a newly paired display', async () => {
    const primaryAccount = await registerAccount('primary');
    const primaryDisplay = await pairDisplay(primaryAccount.authCookie, 'primary');
    expect(primaryDisplay.organizationId).toBe(primaryAccount.organizationId);

    const contentRes = await request(app.getHttpServer())
      .post('/api/v1/content')
      .set(await browserCsrfHeaders(primaryAccount.authCookie))
      .send({
        name: 'Customer Path Menu',
        type: 'url',
        url: `https://example.com/vizora-customer-path-${timestamp}`,
        duration: 10,
      })
      .expect(201);
    const content = dataOf<ContentData>(contentRes.body);
    expect(content.type).toBe('url');

    const playlistRes = await request(app.getHttpServer())
      .post('/api/v1/playlists')
      .set(await browserCsrfHeaders(primaryAccount.authCookie))
      .send({
        name: 'Customer Path Playlist',
        loop: true,
        items: [{ contentId: content.id, duration: 10 }],
      })
      .expect(201);
    const playlist = dataOf<PlaylistData>(playlistRes.body);
    expect(playlist.items).toHaveLength(1);
    expect(playlist.items[0].contentId).toBe(content.id);

    const now = new Date();
    const startDate = new Date(now.getTime() - 60_000).toISOString();
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    const scheduleRes = await request(app.getHttpServer())
      .post('/api/v1/schedules')
      .set(await browserCsrfHeaders(primaryAccount.authCookie))
      .send({
        name: 'Customer Path Schedule',
        startDate,
        daysOfWeek: allDays,
        isActive: true,
        priority: 100,
        playlistId: playlist.id,
        displayId: primaryDisplay.displayId,
      })
      .expect(201);
    const schedule = dataOf<ScheduleData>(scheduleRes.body);
    expect(schedule.displayId).toBe(primaryDisplay.displayId);
    expect(schedule.playlistId).toBe(playlist.id);

    const activeRes = await request(app.getHttpServer())
      .get(`/api/v1/schedules/active/${primaryDisplay.displayId}`)
      .set('Authorization', `Bearer ${primaryDisplay.deviceToken}`)
      .expect(200);
    const activeSchedules = dataOf<ScheduleData[]>(activeRes.body);
    const activeSchedule = activeSchedules.find((item) => item.id === schedule.id);

    expect(activeSchedule).toBeDefined();
    expect(activeSchedule?.playlistId).toBe(playlist.id);
    expect(activeSchedule?.playlist?.items).toHaveLength(1);
    expect(activeSchedule?.playlist?.items[0].content.id).toBe(content.id);
    expect(activeSchedule?.playlist?.items[0].content.name).toBe('Customer Path Menu');

    await request(app.getHttpServer())
      .get(`/api/v1/schedules/active/${primaryDisplay.displayId}`)
      .expect(401);

    await request(app.getHttpServer())
      .get(`/api/v1/schedules/active/${primaryDisplay.displayId}`)
      .set('Authorization', `Bearer ${primaryAccount.authToken}`)
      .expect(401);

    const otherAccount = await registerAccount('other');
    const otherDisplay = await pairDisplay(otherAccount.authCookie, 'other');
    expect(otherDisplay.organizationId).toBe(otherAccount.organizationId);

    await request(app.getHttpServer())
      .get(`/api/v1/schedules/active/${primaryDisplay.displayId}`)
      .set('Authorization', `Bearer ${otherDisplay.deviceToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/playlists')
      .set(await browserCsrfHeaders(otherAccount.authCookie))
      .send({
        name: 'Cross Org Playlist',
        loop: true,
        items: [{ contentId: content.id, duration: 10 }],
      })
      .expect(404);

    const otherContentRes = await request(app.getHttpServer())
      .post('/api/v1/content')
      .set(await browserCsrfHeaders(otherAccount.authCookie))
      .send({
        name: 'Other Org Menu',
        type: 'url',
        url: `https://example.com/vizora-other-org-${timestamp}`,
        duration: 10,
      })
      .expect(201);
    const otherContent = dataOf<ContentData>(otherContentRes.body);

    const otherPlaylistRes = await request(app.getHttpServer())
      .post('/api/v1/playlists')
      .set(await browserCsrfHeaders(otherAccount.authCookie))
      .send({
        name: 'Other Org Playlist',
        loop: true,
        items: [{ contentId: otherContent.id, duration: 10 }],
      })
      .expect(201);
    const otherPlaylist = dataOf<PlaylistData>(otherPlaylistRes.body);

    await request(app.getHttpServer())
      .post('/api/v1/schedules')
      .set(await browserCsrfHeaders(otherAccount.authCookie))
      .send({
        name: 'Cross Org Schedule',
        startDate,
        daysOfWeek: allDays,
        isActive: true,
        playlistId: otherPlaylist.id,
        displayId: primaryDisplay.displayId,
      })
      .expect(404);
  });
});
