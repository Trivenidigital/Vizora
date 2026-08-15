import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { CronLeaderService } from './cron-leader.service';
import { RedisService } from '../../redis/redis.service';
import { DatabaseService } from '../../database/database.service';
import { MailService } from '../../mail/mail.service';
import { EntitlementService } from '../../billing/entitlement.service';
import { BillingLifecycleService } from '../../billing/billing-lifecycle.service';
import { DataRetentionService } from '../data-retention.service';
import { ValidationMonitorService } from '../../health/validation-monitor.service';

/**
 * Boot regression for the services that gained a `CronLeaderService` constructor
 * dependency (mirrors clickhouse-watchdog.bootstrap.spec.ts).
 *
 * Unit tests construct these services by hand and would keep passing if the
 * provider were never wired into a module — the failure would surface only at
 * real app bootstrap, as an "Nest can't resolve dependencies" crash-loop. This
 * stands up a real Nest app with ScheduleModule and calls app.init(), which both
 * resolves the graph and registers/parses every @Cron.
 */
describe('Leader-locked crons — DI + @Cron bootstrap (regression guard)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('resolves CronLeaderService for every service that now depends on it', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        CronLeaderService,
        BillingLifecycleService,
        DataRetentionService,
        ValidationMonitorService,
        {
          provide: RedisService,
          // Disconnected-but-non-null, i.e. the D1 shape: isAvailable() false.
          useValue: { isAvailable: () => false, getClient: () => ({ set: jest.fn() }) },
        },
        {
          provide: DatabaseService,
          useValue: {
            organization: { findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
            auditLog: { deleteMany: jest.fn() },
            notification: { deleteMany: jest.fn() },
            passwordResetToken: { deleteMany: jest.fn() },
            mcpAuditLog: { deleteMany: jest.fn() },
            adminAuditLog: { deleteMany: jest.fn() },
          },
        },
        {
          provide: MailService,
          useValue: { sendTrialExpiredEmail: jest.fn(), sendTrialReminderEmail: jest.fn() },
        },
        {
          provide: EntitlementService,
          useValue: { advanceLadder: jest.fn(), isLadderStale: jest.fn() },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    await expect(app.init()).resolves.toBeDefined();
    expect(app.get(BillingLifecycleService)).toBeDefined();
    expect(app.get(DataRetentionService)).toBeDefined();
    expect(app.get(ValidationMonitorService)).toBeDefined();
  });

  it('CommonModule exports CronLeaderService so @Global consumers can inject it', () => {
    // The wrapped crons live in billing/content/analytics/clickhouse/health —
    // none of which import CommonModule explicitly. They resolve the leader only
    // because CommonModule is @Global AND exports it. Providing without
    // exporting would compile, pass unit tests, and fail at boot.
    const commonModuleSrc = fs.readFileSync(
      path.join(__dirname, '..', 'common.module.ts'),
      'utf-8',
    );
    expect(commonModuleSrc).toContain('@Global()');
    const exportsBlock = commonModuleSrc.match(/exports:\s*\[([^\]]*)\]/)?.[1] ?? '';
    expect(exportsBlock).toContain('CronLeaderService');
  });
});
