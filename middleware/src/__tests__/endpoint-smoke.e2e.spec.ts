/**
 * Endpoint smoke tests — hit every API endpoint group with real HTTP requests.
 * Catches broken routes BEFORE they reach production.
 *
 * Key insight: a protected endpoint returning 400 or 500 (instead of 401)
 * means the route is broken BEFORE auth even runs. This catches:
 * - DTO whitelist bugs (forbidNonWhitelisted rejecting valid params)
 * - Controller registration order bugs (parameterized routes shadowing static ones)
 * - Missing module imports or broken providers
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';

// These are E2E tests — require database connection
const describeOrSkip = process.env.RUN_E2E_TESTS === 'true' ? describe : describe.skip;

describeOrSkip('API Endpoint Smoke Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    // Mirror production validation pipe config
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );

    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  // -----------------------------------------------------------------------
  // Public endpoints — should return 200 without any auth
  // -----------------------------------------------------------------------
  describe('Public endpoints', () => {
    const publicEndpoints = [
      { method: 'GET' as const, path: '/api/v1/health', expect: 200 },
      { method: 'GET' as const, path: '/api/v1/health/ready', expect: 200 },
      { method: 'GET' as const, path: '/api/v1/health/live', expect: 200 },
      { method: 'GET' as const, path: '/api/v1/billing/plans', expect: 200 },
    ];

    it.each(publicEndpoints)(
      '$method $path -> $expect',
      async ({ method, path: urlPath, expect: expectedStatus }) => {
        const res = await request(app.getHttpServer())[method.toLowerCase()](urlPath);
        expect(res.status).toBe(expectedStatus);
      },
    );
  });

  // -----------------------------------------------------------------------
  // Protected endpoints — should return 401 without auth
  // NEVER 400 (DTO bug) or 500 (server crash)
  // -----------------------------------------------------------------------
  describe('Protected endpoints (no auth -> 401)', () => {
    const protectedEndpoints = [
      '/api/v1/templates',
      '/api/v1/devices',
      '/api/v1/playlists',
      '/api/v1/content',
      '/api/v1/content/widgets',
      '/api/v1/content/layouts',
      '/api/v1/notifications',
      '/api/v1/schedules',
      '/api/v1/display-groups',
      '/api/v1/folders',
    ];

    it.each(protectedEndpoints)(
      'GET %s without auth -> 401 (not 400 or 500)',
      async (urlPath) => {
        const res = await request(app.getHttpServer()).get(urlPath);

        // The critical assertions: these specific status codes indicate broken routes
        expect(res.status).not.toBe(400); // DTO whitelist bug
        expect(res.status).not.toBe(500); // Server crash
        expect(res.status).not.toBe(404); // Route not registered
        expect(res.status).toBe(401); // Expected: auth required
      },
    );
  });

  // -----------------------------------------------------------------------
  // POST /auth/login — should return 400 (no body) or 401, never 500
  // -----------------------------------------------------------------------
  describe('Auth endpoints', () => {
    it('POST /api/v1/auth/login with empty body -> 400 (validation) not 500', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({});

      // 400 (missing fields) or 401 (bad credentials) are both acceptable
      expect([400, 401]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });

    it('POST /api/v1/auth/register with empty body -> 400 not 500', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({});

      expect(res.status).toBe(400);
      expect(res.status).not.toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // Query parameter handling — protected routes with query params
  // Catches: forbidNonWhitelisted rejecting limit/offset
  // -----------------------------------------------------------------------
  describe('Query parameter handling', () => {
    it('GET /api/v1/content?limit=10&offset=0 -> 401 (not 400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/content?limit=10&offset=0');

      expect(res.status).not.toBe(400);
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/notifications?limit=10 -> 401 (not 400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications?limit=10');

      expect(res.status).not.toBe(400);
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/templates?search=test -> 401 (not 400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/templates?search=test');

      expect(res.status).not.toBe(400);
      expect(res.status).toBe(401);
    });
  });
});
