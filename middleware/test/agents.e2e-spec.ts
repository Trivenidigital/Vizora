import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app/app.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { SanitizeInterceptor } from '../src/modules/common/interceptors/sanitize.interceptor';

/**
 * R4-HIGH9: End-to-end proof that the full event pipeline is wired.
 *   POST /auth/register → AuthService.register → EventEmitter2.emit('user.welcomed', ...)
 *     → OnboardingService.@OnEvent → markMilestone → DB row
 *
 * The unit tests mock EventEmitter2 and the DB, so they can't catch a broken
 * wiring: missing AgentsModule import, wrong event name, async handler
 * never awaited. This spec catches all three by hitting a real DB and
 * polling for the row to appear.
 */
describe('Agents onboarding pipeline (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let userId: string | undefined;
  let organizationId: string | undefined;

  const timestamp = Date.now();
  const testUser = {
    email: `agents-e2e-${timestamp}@example.com`,
    password: 'SecureP@ssw0rd!',
    firstName: 'Agents',
    lastName: 'E2E',
    organizationName: 'Agents E2E Org',
    organizationSlug: `agents-e2e-${timestamp}`,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new SanitizeInterceptor());
    await app.init();
    db = moduleFixture.get<DatabaseService>(DatabaseService);
  });

  afterAll(async () => {
    if (organizationId) {
      // Onboarding row cascade-deletes with the org (onDelete: Cascade).
      await db.organization
        .delete({ where: { id: organizationId } })
        .catch(() => {});
    }
    if (userId) {
      await db.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await db.$disconnect();
    await app.close();
  }, 60000);

  it('register → emits user.welcomed → OnboardingService writes welcomeEmailSentAt', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    userId = res.body.data.user.id;
    organizationId = res.body.data.user.organizationId;

    expect(organizationId).toBeTruthy();

    // @OnEvent handlers run asynchronously, so poll briefly (up to ~2s) for
    // the milestone row to appear. Real wiring should land in <100ms.
    const deadline = Date.now() + 2_000;
    let row:
      | { welcomeEmailSentAt: Date | null; organizationId: string }
      | null = null;
    while (Date.now() < deadline) {
      row = await (
        db as unknown as {
          organizationOnboarding: {
            findUnique: (args: {
              where: { organizationId: string };
            }) => Promise<{
              welcomeEmailSentAt: Date | null;
              organizationId: string;
            } | null>;
          };
        }
      ).organizationOnboarding.findUnique({
        where: { organizationId: organizationId! },
      });
      if (row?.welcomeEmailSentAt) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(row).not.toBeNull();
    expect(row!.organizationId).toBe(organizationId);
    expect(row!.welcomeEmailSentAt).toBeInstanceOf(Date);
  });
});
