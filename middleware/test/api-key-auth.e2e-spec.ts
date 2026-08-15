// Mock isomorphic-dompurify before importing modules
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app/app.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { SanitizeInterceptor } from '../src/modules/common/interceptors/sanitize.interceptor';

/**
 * Mixed-credential precedence for API-key auth, at the FULL request-pipeline
 * level — real AppModule, real global JwtAuthGuard, real ScopesGuard, real DB.
 *
 * The unit spec (auth/guards/api-key-auth.spec.ts) proves the guard chooses the
 * key branch. It cannot prove what the request ultimately READS, because the
 * tenant boundary is applied several layers later by @CurrentUser and the
 * Prisma where-clause. A guard that picks the right principal and a handler
 * that still reads the session's org would both pass that spec. Only an
 * end-to-end assertion on the returned rows can distinguish them.
 *
 * `GET /api/content` is the one route enabled for API-key auth today
 * (content.controller.ts findAll). E2E specs mount the app under prefix 'api',
 * not 'api/v1'.
 */
describe('API-key auth precedence (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  // Org A owns the API keys under test.
  let orgAToken: string;
  let orgAUserId: string;
  let orgAId: string;
  let orgAContentId: string;

  // Org B supplies the competing session credential.
  let orgBToken: string;
  let orgBUserId: string;
  let orgBId: string;
  let orgBContentId: string;

  // Plaintext keys, returned exactly once at creation.
  let contentReadKey: string;
  let displaysOnlyKey: string;

  const timestamp = Date.now();

  const orgAUser = {
    email: `apikey-a-${timestamp}@example.com`,
    password: 'SecureP@ssw0rd!',
    firstName: 'ApiKey',
    lastName: 'OrgA',
    organizationName: 'API Key Org A',
    organizationSlug: `apikey-org-a-${timestamp}`,
  };

  const orgBUser = {
    email: `apikey-b-${timestamp}@example.com`,
    password: 'SecureP@ssw0rd!',
    firstName: 'ApiKey',
    lastName: 'OrgB',
    organizationName: 'API Key Org B',
    organizationSlug: `apikey-org-b-${timestamp}`,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }));

    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }));

    app.useGlobalInterceptors(new SanitizeInterceptor(app.get(Reflector)));

    await app.init();
    db = moduleFixture.get<DatabaseService>(DatabaseService);

    const registerA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(orgAUser);

    orgAToken = registerA.body.data.access_token;
    orgAUserId = registerA.body.data.user.id;
    orgAId = registerA.body.data.user.organizationId;

    const registerB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(orgBUser);

    orgBToken = registerB.body.data.access_token;
    orgBUserId = registerB.body.data.user.id;
    orgBId = registerB.body.data.user.organizationId;

    // One content item per org — the two rows the assertions distinguish.
    const contentA = await request(app.getHttpServer())
      .post('/api/content')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        name: 'Org A Content',
        type: 'image',
        url: 'https://example.com/org-a.jpg',
      });
    orgAContentId = contentA.body.id;

    const contentB = await request(app.getHttpServer())
      .post('/api/content')
      .set('Authorization', `Bearer ${orgBToken}`)
      .send({
        name: 'Org B Content',
        type: 'image',
        url: 'https://example.com/org-b.jpg',
      });
    orgBContentId = contentB.body.id;

    // Key that satisfies the route's `read:content` requirement.
    const contentReadKeyRes = await request(app.getHttpServer())
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ name: 'content-read', scopes: ['read:content'] });
    contentReadKey = contentReadKeyRes.body.key;

    // Key held by the SAME org but scoped to a different resource — isolates
    // scope enforcement from tenancy, which is bound separately.
    const displaysOnlyKeyRes = await request(app.getHttpServer())
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ name: 'displays-read', scopes: ['read:displays'] });
    displaysOnlyKey = displaysOnlyKeyRes.body.key;
  });

  afterAll(async () => {
    for (const organizationId of [orgAId, orgBId]) {
      if (!organizationId) continue;
      await db.apiKey.deleteMany({ where: { organizationId } }).catch(() => {});
      await db.content.deleteMany({ where: { organizationId } }).catch(() => {});
    }
    if (orgAUserId) {
      await db.user.delete({ where: { id: orgAUserId } }).catch(() => {});
    }
    if (orgBUserId) {
      await db.user.delete({ where: { id: orgBUserId } }).catch(() => {});
    }
    if (orgAId) {
      await db.organization.delete({ where: { id: orgAId } }).catch(() => {});
    }
    if (orgBId) {
      await db.organization.delete({ where: { id: orgBId } }).catch(() => {});
    }

    await db.$disconnect();
    await app.close();
  }, 60000);

  it('sets up both orgs, their content, and org A keys', () => {
    expect(orgAId).toBeDefined();
    expect(orgBId).toBeDefined();
    expect(orgAId).not.toBe(orgBId);
    expect(orgAContentId).toBeDefined();
    expect(orgBContentId).toBeDefined();
    expect(contentReadKey).toMatch(/^vz_live_/);
    expect(displaysOnlyKey).toMatch(/^vz_live_/);
  });

  describe('mixed credentials on GET /api/content', () => {
    it("resolves to the KEY's org when a valid key and a valid session from a DIFFERENT org are both presented", () => {
      return request(app.getHttpServer())
        .get('/api/content?limit=100')
        .set('Authorization', `Bearer ${orgBToken}`)
        .set('x-api-key', contentReadKey)
        .expect(200)
        .expect((res) => {
          const ids = res.body.data.map((c: any) => c.id);
          expect(ids).toContain(orgAContentId);
          expect(ids).not.toContain(orgBContentId);

          // Every row belongs to the key's org — no blend of the two principals.
          const orgIds = res.body.data.map((c: any) => c.organizationId);
          expect(new Set(orgIds)).toEqual(new Set([orgAId]));
        });
    });

    it('rejects an invalid key with 401 rather than falling back to the valid session', () => {
      return request(app.getHttpServer())
        .get('/api/content?limit=100')
        .set('Authorization', `Bearer ${orgBToken}`)
        .set('x-api-key', 'vz_live_definitely-not-a-real-key')
        .expect(401);
    });

    it('rejects a key missing the route scope with 403, without falling back to the valid session', () => {
      return request(app.getHttpServer())
        .get('/api/content?limit=100')
        .set('Authorization', `Bearer ${orgBToken}`)
        .set('x-api-key', displaysOnlyKey)
        .expect(403);
    });
  });

  describe('single credentials on GET /api/content', () => {
    it('authenticates a correctly scoped key with no session at all', () => {
      return request(app.getHttpServer())
        .get('/api/content?limit=100')
        .set('x-api-key', contentReadKey)
        .expect(200)
        .expect((res) => {
          const ids = res.body.data.map((c: any) => c.id);
          expect(ids).toContain(orgAContentId);
          expect(ids).not.toContain(orgBContentId);
        });
    });

    it('leaves the session path untouched when no key header is present', () => {
      return request(app.getHttpServer())
        .get('/api/content?limit=100')
        .set('Authorization', `Bearer ${orgBToken}`)
        .expect(200)
        .expect((res) => {
          const ids = res.body.data.map((c: any) => c.id);
          expect(ids).toContain(orgBContentId);
          expect(ids).not.toContain(orgAContentId);
        });
    });
  });
});
