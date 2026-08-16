import { BillingLifecycleService } from './billing-lifecycle.service';
import { CronLeaderService } from '../common/services/cron-leader.service';
import { RedisService } from '../redis/redis.service';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { EntitlementService } from './entitlement.service';

/**
 * These are CALL-SITE tests, deliberately.
 *
 * `cron-leader.service.spec.ts` proves the lock elects one winner given a bare
 * `fn`. It cannot prove that any cron actually USES it — delete
 * `runExclusive(...)` from this service and every one of those tests still
 * passes. The duplicate-execution tests below drive the real
 * `handleTrialLifecycle` through two service instances sharing one Redis, so
 * removing the wrapper turns them red.
 *
 * They also cover the second, independent defence: the status-guarded CAS in
 * `expireTrials`, which is what keeps the customer safe while the lock is
 * failing open during a Redis outage.
 */

/** SET NX EX semantics over a Map — enough to arbitrate two racing instances. */
function createFakeRedis(): RedisService {
  const store = new Map<string, string>();
  return {
    isAvailable: () => true,
    getClient: () => ({
      set: async (key: string, value: string, ..._rest: unknown[]) => {
        if (store.has(key)) return null;
        store.set(key, value);
        return 'OK';
      },
    }),
  } as unknown as RedisService;
}

/**
 * Minimal org store honouring the compound WHERE that makes the CAS work:
 * `updateMany({ where: { id, subscriptionStatus } })` matches only if the row is
 * still in that status. A mock that ignored the status guard would make the
 * Part A test vacuous.
 */
function createFakeDb(orgs: Array<Record<string, any>>) {
  const rows = orgs.map((o) => ({ ...o }));
  return {
    rows,
    organization: {
      findMany: jest.fn(async ({ where }: any) => {
        return rows
          .filter((r) => {
            if (where.subscriptionStatus && r.subscriptionStatus !== where.subscriptionStatus) {
              return false;
            }
            if (where.trialEndsAt?.gte && !(r.trialEndsAt >= where.trialEndsAt.gte)) return false;
            if (where.trialEndsAt?.lte && !(r.trialEndsAt <= where.trialEndsAt.lte)) return false;
            return true;
          })
          .map((r) => ({ ...r }));
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = rows.find(
          (r) =>
            r.id === where.id &&
            (where.subscriptionStatus === undefined ||
              r.subscriptionStatus === where.subscriptionStatus),
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }),
    },
  };
}

function makeOrg(id: string, trialEndsAt: Date) {
  return {
    id,
    name: `Org ${id}`,
    country: 'US',
    subscriptionStatus: 'trial',
    trialEndsAt,
    users: [{ email: `admin@${id}.test`, firstName: 'Ada' }],
  };
}

describe('BillingLifecycleService — cluster double-fire', () => {
  let mail: { sendTrialExpiredEmail: jest.Mock; sendTrialReminderEmail: jest.Mock };

  /**
   * A COMPLETE `LadderRunResult`. The previous `{ advanced: 0 }` stub made
   * `result.failed` undefined, so `undefined > 0` was false and the DEGRADED
   * branch in `handleGracePeriodExpiry` could never run — deleting that entire
   * branch turned no test red, and the summary line silently rendered
   * "undefined advanced … of undefined attempted" while the test passed (F2).
   */
  function ladderResult(over: Partial<Record<string, number>> = {}) {
    return {
      eligible: 0,
      attempted: 0,
      advanced: 0,
      casLost: 0,
      failed: 0,
      rungFailures: 0,
      rungs: {},
      ...over,
    };
  }

  let entitlement: EntitlementService;
  let entitlementMocks: {
    advanceLadder: jest.Mock;
    readHeartbeat: jest.Mock;
    isHeartbeatStale: jest.Mock;
    isLadderStale: jest.Mock;
  };

  beforeEach(() => {
    mail = {
      sendTrialExpiredEmail: jest.fn().mockResolvedValue(undefined),
      sendTrialReminderEmail: jest.fn().mockResolvedValue(undefined),
    };
    entitlementMocks = {
      advanceLadder: jest.fn().mockResolvedValue(ladderResult()),
      readHeartbeat: jest.fn().mockResolvedValue({
        at: Date.now(),
        degraded: false,
        failed: 0,
        rungFailures: 0,
      }),
      // Mirrors the real predicate closely enough for the call-site tests.
      isHeartbeatStale: jest.fn((hb: { at: number } | null) => hb === null),
      isLadderStale: jest.fn().mockResolvedValue(false),
    };
    entitlement = entitlementMocks as unknown as EntitlementService;
  });

  afterEach(() => jest.restoreAllMocks());

  function buildInstance(db: ReturnType<typeof createFakeDb>, redis: RedisService) {
    const leader = new CronLeaderService(redis);
    // The leader logs acquire/skip at LOG level by design (D2) — silence it here
    // so the suite output stays readable.
    jest.spyOn(leader['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(leader['logger'], 'warn').mockImplementation(() => undefined);

    const service = new BillingLifecycleService(
      db as unknown as DatabaseService,
      mail as unknown as MailService,
      entitlement,
      leader,
    );
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
    return service;
  }

  describe('the leader lock is actually wired into handleTrialLifecycle', () => {
    it('sends each trial REMINDER once when both PM2 instances fire the cron', async () => {
      // A reminder is due in exactly 5 days for two orgs. sendTrialReminders has
      // no dedup of its own — the lock is the only thing preventing 2x email.
      const in5Days = new Date();
      in5Days.setDate(in5Days.getDate() + 5);
      in5Days.setHours(12, 0, 0, 0);

      const db = createFakeDb([makeOrg('a', in5Days), makeOrg('b', in5Days)]);
      const redis = createFakeRedis();

      const instanceA = buildInstance(db, redis);
      const instanceB = buildInstance(db, redis);

      await Promise.all([instanceA.handleTrialLifecycle(), instanceB.handleTrialLifecycle()]);

      // N, not 2N. Remove the runExclusive wrapper and this becomes 4.
      expect(mail.sendTrialReminderEmail).toHaveBeenCalledTimes(2);
      const recipients = mail.sendTrialReminderEmail.mock.calls.map((c) => c[0]).sort();
      expect(recipients).toEqual(['admin@a.test', 'admin@b.test']);
    });

    it('expires each trial once when both PM2 instances fire the cron', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const db = createFakeDb([makeOrg('a', yesterday)]);
      const redis = createFakeRedis();

      const instanceA = buildInstance(db, redis);
      const instanceB = buildInstance(db, redis);

      await Promise.all([instanceA.handleTrialLifecycle(), instanceB.handleTrialLifecycle()]);

      expect(mail.sendTrialExpiredEmail).toHaveBeenCalledTimes(1);
      expect(db.rows[0].subscriptionStatus).toBe('canceled');
    });
  });

  describe('Part A: expireTrials is safe even with the lock failing open', () => {
    // The lock is fail-open by design, so during a Redis outage BOTH instances
    // run this body. These tests bypass the lock entirely (calling expireTrials
    // directly) to prove the status-guarded CAS carries the customer-visible
    // guarantee on its own.
    it('sends the trial-expired email ONCE across two concurrent runs', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const db = createFakeDb([makeOrg('a', yesterday), makeOrg('b', yesterday)]);
      const redis = createFakeRedis();

      const instanceA = buildInstance(db, redis);
      const instanceB = buildInstance(db, redis);

      await Promise.all([instanceA.expireTrials(), instanceB.expireTrials()]);

      // Revert the updateMany back to a bare update({ where: { id } }) — or drop
      // the `count === 0` gate — and this becomes 4.
      expect(mail.sendTrialExpiredEmail).toHaveBeenCalledTimes(2);
      const recipients = mail.sendTrialExpiredEmail.mock.calls.map((c) => c[0]).sort();
      expect(recipients).toEqual(['admin@a.test', 'admin@b.test']);
    });

    it('guards the write on subscriptionStatus, not just the id', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const db = createFakeDb([makeOrg('a', yesterday)]);
      const service = buildInstance(db, createFakeRedis());

      await service.expireTrials();

      expect(db.organization.updateMany).toHaveBeenCalledWith({
        where: { id: 'a', subscriptionStatus: 'trial' },
        data: { subscriptionStatus: 'canceled' },
      });
      // The unguarded primitive must not be used on this path at all.
      expect(db.organization.update).not.toHaveBeenCalled();
    });

    it('does NOT email on a stale read the sibling already acted on', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const db = createFakeDb([makeOrg('a', yesterday)]);
      const service = buildInstance(db, createFakeRedis());

      // The exact interleaving the CAS exists for: our findMany snapshot still
      // says 'trial', but the sibling flips the row before our write lands. The
      // findMany must therefore return the STALE row, not re-read the store.
      const staleSnapshot = [{ ...db.rows[0] }];
      db.organization.findMany.mockResolvedValueOnce(staleSnapshot);
      db.rows[0].subscriptionStatus = 'canceled';

      await service.expireTrials();

      expect(db.organization.updateMany).toHaveBeenCalledTimes(1);
      expect(mail.sendTrialExpiredEmail).not.toHaveBeenCalled();
    });
  });

  /**
   * Part B: the entitlement-ladder CALL SITE.
   *
   * `entitlement.service.spec.ts` proves the ladder isolates failures and reports
   * them in its return value and heartbeat. It cannot prove anyone READS either.
   * Both consumers live here, and both were dead on arrival:
   *  - `handleGracePeriodExpiry`'s DEGRADED branch never executed, because the
   *    mock returned `{ advanced: 0 }` and `undefined > 0` is false (F2);
   *  - `checkLadderFreshness` read only `at`, discarding `degraded` entirely, so
   *    a run that stranded tenants still reported FRESH (F1).
   * Delete either branch and the tests below go red.
   */
  describe('Part B: the ladder outcome is actually consumed', () => {
    it('F2: handleGracePeriodExpiry escalates a DEGRADED run to error + Sentry', async () => {
      // A run that isolated a failure still COMPLETES, so nothing throws and the
      // freshness watchdog sees a fresh heartbeat. This branch is the only
      // in-band signal that a tenant did not advance — and until now no test
      // drove it at all.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/nestjs');
      const capture = jest.spyOn(Sentry, 'captureException').mockImplementation(() => undefined);

      const service = buildInstance(createFakeDb([]), createFakeRedis());
      entitlementMocks.advanceLadder.mockResolvedValue(
        ladderResult({ eligible: 3, attempted: 3, advanced: 2, failed: 1 }),
      );

      await service.handleGracePeriodExpiry();

      const errors = (service['logger'].error as jest.Mock).mock.calls.map((c) => String(c[0]));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('DEGRADED');
      // The counters must actually render — the old stub produced "undefined".
      expect(errors[0]).toContain('1 failed of 3 attempted');
      expect(errors[0]).not.toContain('undefined');
      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture.mock.calls[0][1]).toMatchObject({
        tags: expect.objectContaining({ failed: 1, rungFailures: 0 }),
      });
    });

    it('F2: a CLEAN run logs at log level and raises nothing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/nestjs');
      const capture = jest.spyOn(Sentry, 'captureException').mockImplementation(() => undefined);

      const service = buildInstance(createFakeDb([]), createFakeRedis());
      entitlementMocks.advanceLadder.mockResolvedValue(
        ladderResult({ eligible: 2, attempted: 2, advanced: 2 }),
      );

      await service.handleGracePeriodExpiry();

      expect(service['logger'].error as jest.Mock).not.toHaveBeenCalled();
      expect(capture).not.toHaveBeenCalled();
    });

    it('F1: the freshness watchdog reports a DEGRADED run, not just a stale one', async () => {
      // The §12a gap: a run that stranded 3 tenants and finished writes a RECENT
      // heartbeat, so freshness alone says FRESH. Reading only `at` throws the
      // outcome away and the watchdog goes quiet on exactly the failure it exists
      // to catch.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/nestjs');
      const capture = jest.spyOn(Sentry, 'captureException').mockImplementation(() => undefined);

      const service = buildInstance(createFakeDb([]), createFakeRedis());
      entitlementMocks.readHeartbeat.mockResolvedValue({
        at: Date.now(), // FRESH
        degraded: true,
        failed: 3,
        rungFailures: 1,
      });

      await service.checkLadderFreshness();

      const errors = (service['logger'].error as jest.Mock).mock.calls.map((c) => String(c[0]));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('DEGRADED');
      expect(errors[0]).not.toContain('STALE');
      expect(errors[0]).toContain('3 org failure(s)');
      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture.mock.calls[0][1]).toMatchObject({
        tags: expect.objectContaining({ source: 'freshness_watchdog' }),
      });
    });

    it('F1: a STALE heartbeat shouts STALE only — it does not also shout DEGRADED', async () => {
      const service = buildInstance(createFakeDb([]), createFakeRedis());
      entitlementMocks.readHeartbeat.mockResolvedValue(null);
      entitlementMocks.isHeartbeatStale.mockReturnValue(true);

      await service.checkLadderFreshness();

      const errors = (service['logger'].error as jest.Mock).mock.calls.map((c) => String(c[0]));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('STALE');
    });

    it('F1: a fresh CLEAN heartbeat raises nothing at all', async () => {
      const service = buildInstance(createFakeDb([]), createFakeRedis());

      await service.checkLadderFreshness();

      expect(service['logger'].error as jest.Mock).not.toHaveBeenCalled();
    });
  });
});
