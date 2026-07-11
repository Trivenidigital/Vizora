import { INestApplication } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { ClickHouseWatchdogService } from './clickhouse-watchdog.service';
import { DatabaseService } from '../database/database.service';
import { ClickHouseService } from './clickhouse.service';

/**
 * Regression guard for the 2026-07-11 prod boot failure.
 *
 * The watchdog originally used `@Cron(CronExpression.EVERY_15_MINUTES)`, but
 * @nestjs/schedule's `CronExpression` enum has NO `EVERY_15_MINUTES` member
 * (only 10/30), so it resolved to `undefined`. `@Cron(undefined)` type-checks
 * clean and passes the ordinary unit tests (which call the handler directly),
 * but at real app bootstrap `ScheduleModule` hands the undefined expression to
 * the cron parser, which throws `TypeError: Cannot read properties of undefined
 * (reading 'toLowerCase')` from `SchedulerOrchestrator.onApplicationBootstrap`
 * — i.e. `app.listen()` rejects and the whole middleware crash-loops.
 *
 * This test reproduces that path: it stands up a real Nest app with
 * `ScheduleModule.forRoot()` and calls `app.init()` (which runs the scheduler
 * bootstrap). It FAILS on an invalid/undefined cron expression and PASSES only
 * when every @Cron on the watchdog is a valid expression.
 */
describe('ClickHouseWatchdogService — @Cron bootstrap (regression guard)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('registers its @Cron under ScheduleModule without crashing app bootstrap', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        ClickHouseWatchdogService,
        { provide: DatabaseService, useValue: { display: { count: jest.fn().mockResolvedValue(0) } } },
        {
          provide: ClickHouseService,
          useValue: { isEnabled: false, getLatestSampleTime: jest.fn() },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    // app.init() runs SchedulerOrchestrator.onApplicationBootstrap, which parses
    // and schedules every @Cron. An undefined/invalid expression throws here.
    await expect(app.init()).resolves.toBeDefined();
  });
});
