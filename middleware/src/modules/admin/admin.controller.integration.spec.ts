import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AdminController } from './admin.controller';
import { PlansService } from './services/plans.service';
import { PromotionsService } from './services/promotions.service';
import { SystemConfigService } from './services/system-config.service';
import { AdminAuditService } from './services/admin-audit.service';
import { OrganizationsAdminService } from './services/organizations-admin.service';
import { UsersAdminService } from './services/users-admin.service';
import { PlatformHealthService } from './services/platform-health.service';
import { PlatformStatsService } from './services/platform-stats.service';
import { SecurityAdminService } from './services/security-admin.service';
import { AnnouncementsService } from './services/announcements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';

/**
 * Regression guard for admin #1.
 *
 * Every admin write handler reads the acting admin's id via `@CurrentUser('id')`.
 * `JwtStrategy.validate()` puts the user on the request as `{ id, ... }` — there is
 * NO `userId` field — so `@CurrentUser('userId')` resolves to `undefined`, which
 * (a) 500s the request once the required `adminUserId` scalar reaches Prisma and
 * (b) writes no audit row. The plain unit specs call controller methods with a
 * literal `adminId`, so they bypass the decorator and cannot catch this class.
 *
 * This test drives a real HTTP request through the guard pipeline so the decorator
 * actually resolves against `request.user`. It fails if any admin handler reverts
 * to `@CurrentUser('userId')` (the audit row's `adminUserId` would be `undefined`).
 */
describe('AdminController @CurrentUser wiring (integration)', () => {
  let app: INestApplication;
  const auditLog = jest.fn().mockResolvedValue(undefined);

  // Mirrors the shape JwtStrategy.validate() places on request.user.
  const AUTHED_ADMIN = {
    id: 'admin-from-token',
    email: 'root@vizora.cloud',
    role: 'admin',
    isSuperAdmin: true,
  };

  beforeAll(async () => {
    const empty = {} as any;
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: PlansService,
          useValue: { create: jest.fn().mockResolvedValue({ id: 'plan-x', slug: 'enterprise' }) },
        },
        { provide: PromotionsService, useValue: empty },
        { provide: SystemConfigService, useValue: empty },
        { provide: AdminAuditService, useValue: { log: auditLog } },
        { provide: OrganizationsAdminService, useValue: empty },
        { provide: UsersAdminService, useValue: empty },
        { provide: PlatformHealthService, useValue: empty },
        { provide: PlatformStatsService, useValue: empty },
        { provide: SecurityAdminService, useValue: empty },
        { provide: AnnouncementsService, useValue: empty },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = AUTHED_ADMIN;
          return true;
        },
      })
      .overrideGuard(SuperAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    auditLog.mockClear();
  });

  it('writes the audit row with the authenticated admin id on a POST /admin/plans', async () => {
    await request(app.getHttpServer())
      .post('/admin/plans')
      .send({ slug: 'enterprise', name: 'Enterprise' })
      .expect(201);

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: 'admin-from-token',
        action: 'plan.create',
      }),
    );
    // Guard against the exact regression: adminUserId must never be undefined.
    expect(auditLog.mock.calls[0][0].adminUserId).toBeDefined();
  });
});
