import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EntitlementService, LADDER } from './entitlement.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { TenantEntitlementNotifier } from './tenant-entitlement.notifier';

/**
 * B3 acceptance negative suite (design v2). Asserts the degrade-ladder semantics:
 * publish_locked emits no device signal, tenant:suspended fires once at holding,
 * recovery emits tenant:resumed only if holding was reached, and rung math keys on
 * entitlementStateSince in whole UTC days.
 */
describe('EntitlementService (B3 ladder)', () => {
  let service: EntitlementService;
  let db: { organization: { findMany: jest.Mock; updateMany: jest.Mock; update: jest.Mock; findUnique: jest.Mock } };
  let redis: { get: jest.Mock; set: jest.Mock; getClient: jest.Mock; isAvailable: jest.Mock };
  let redisClient: { set: jest.Mock };
  let notifier: { emit: jest.Mock };
  let mail: { sendPaymentFailedEmail: jest.Mock };

  const NOW = new Date('2026-07-02T00:00:00.000Z');
  const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    db = {
      organization: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    // getClient().set(NX) → 'OK' = first claim (send), null = already sent (dedup).
    redisClient = { set: jest.fn().mockResolvedValue('OK') };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      getClient: jest.fn(() => redisClient),
      // getClient() is non-null during a Redis outage (only disconnect() nulls
      // it) — isAvailable() is the only usable liveness signal. Default true so
      // the existing cases exercise the normal path.
      isAvailable: jest.fn(() => true),
    };
    notifier = { emit: jest.fn().mockResolvedValue(undefined) };
    mail = { sendPaymentFailedEmail: jest.fn().mockResolvedValue(undefined) };

    const mod = await Test.createTestingModule({
      providers: [
        EntitlementService,
        { provide: DatabaseService, useValue: db },
        { provide: RedisService, useValue: redis },
        { provide: TenantEntitlementNotifier, useValue: notifier },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = mod.get(EntitlementService);
  });

  // ---- rung math (UTC whole days) ----

  it('does NOT advance past_due before day 7 (6 days = not yet)', async () => {
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'past_due'
        ? [{ id: 'o1', entitlementStateSince: daysAgo(6) }]
        : [],
    );
    const { advanced } = await service.advanceLadder(NOW);
    expect(advanced).toBe(0);
    // No RUNG ADVANCE (a status flip). The unconditional heal updateMany
    // (data: { entitlementStateSince }) may run; assert only that no status
    // transition happened.
    expect(db.organization.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subscriptionStatus: expect.anything() }),
      }),
    );
  });

  it('heals an un-stamped dunning org so it is never invisible to the ladder', async () => {
    // Regression for the webhook-ordering leak: an org set to past_due via
    // handleSubscriptionUpdated (out-of-order Stripe events) has
    // entitlementStateSince=null and would otherwise never be advanced —
    // holding full access forever. advanceLadder stamps it from first-sight.
    db.organization.findMany.mockResolvedValue([]);
    await service.advanceLadder(NOW);
    expect(db.organization.updateMany).toHaveBeenCalledWith({
      where: {
        subscriptionStatus: { in: ['past_due', 'publish_locked', 'suspended'] },
        entitlementStateSince: null,
      },
      data: { entitlementStateSince: NOW },
    });
  });

  it('advances past_due → publish_locked at exactly day 7, and emits NO device signal', async () => {
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'past_due'
        ? [{ id: 'o1', entitlementStateSince: daysAgo(LADDER.DAYS_TO_PUBLISH_LOCK) }]
        : [],
    );
    const { advanced } = await service.advanceLadder(NOW);
    expect(advanced).toBe(1);
    expect(db.organization.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1', subscriptionStatus: 'past_due' },
        data: expect.objectContaining({ subscriptionStatus: 'publish_locked' }),
      }),
    );
    // NEGATIVE: publish_locked is dashboard/API-side only — zero device signals.
    expect(notifier.emit).not.toHaveBeenCalled();
  });

  it('emits tenant:suspended EXACTLY ONCE and only at the holding rung (day 14)', async () => {
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'publish_locked'
        ? [{ id: 'o1', entitlementStateSince: daysAgo(LADDER.DAYS_TO_SUSPEND) }]
        : [],
    );
    await service.advanceLadder(NOW);
    expect(notifier.emit).toHaveBeenCalledTimes(1);
    expect(notifier.emit).toHaveBeenCalledWith('o1', 'suspended', expect.any(String));
  });

  it('advances suspended → canceled at day 30 and downgrades to free', async () => {
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'suspended'
        ? [{ id: 'o1', entitlementStateSince: daysAgo(LADDER.DAYS_TO_CANCEL) }]
        : [],
    );
    await service.advanceLadder(NOW);
    expect(db.organization.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subscriptionStatus: 'canceled', subscriptionTier: 'free', screenQuota: 5 }),
      }),
    );
    // canceled is not a device-signal rung
    expect(notifier.emit).not.toHaveBeenCalled();
  });

  it('rung 3 writes the FULL free-tier entitlement set, storage included (A-F3)', async () => {
    // This is the HIGHEST-VOLUME route to the free tier — silent non-payment,
    // not an explicit cancellation. It used to hardcode
    // `{ subscriptionTier: 'free', screenQuota: 5 }` with no storageQuotaBytes,
    // so an ex-Pro org kept a 100GB storage quota forever and
    // StorageQuotaService enforced the stored value verbatim.
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'suspended'
        ? [{ id: 'o1', entitlementStateSince: daysAgo(LADDER.DAYS_TO_CANCEL) }]
        : [],
    );

    await service.advanceLadder(NOW);

    const rung3 = db.organization.updateMany.mock.calls
      .map((c: any[]) => c[0])
      .find((arg: any) => arg?.data?.subscriptionStatus === 'canceled');

    expect(rung3.data.storageQuotaBytes).toBe(BigInt(1024 * 1024 * 1024));
    // And the ordering mark, so a late-delivered older billing webhook cannot
    // sail past the guard and undo the downgrade (B-M2).
    expect(rung3.data.billingEventAt).toEqual(NOW);
  });

  it('rung 3 sources its quota from the shared tier definition, not a literal', async () => {
    // The duplicated `screenQuota: 5` literal silently diverges the day the free
    // tier's quota changes. Pinning it to the shared helper is the point of the
    // fix, so assert they agree rather than re-hardcoding 5 here.
    const { tierEntitlementFields } = await import('./constants/plans');
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'suspended'
        ? [{ id: 'o1', entitlementStateSince: daysAgo(LADDER.DAYS_TO_CANCEL) }]
        : [],
    );

    await service.advanceLadder(NOW);

    const rung3 = db.organization.updateMany.mock.calls
      .map((c: any[]) => c[0])
      .find((arg: any) => arg?.data?.subscriptionStatus === 'canceled');

    expect(rung3.data).toMatchObject(tierEntitlementFields('free'));
  });

  // ---- idempotency ----

  it('is idempotent per run: a concurrent flip (updateMany count 0) does not double-advance or emit', async () => {
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'publish_locked'
        ? [{ id: 'o1', entitlementStateSince: daysAgo(LADDER.DAYS_TO_SUSPEND) }]
        : [],
    );
    db.organization.updateMany.mockResolvedValue({ count: 0 }); // lost the race
    const { advanced } = await service.advanceLadder(NOW);
    expect(advanced).toBe(0);
    expect(notifier.emit).not.toHaveBeenCalled(); // no emit when the flip didn't win
  });

  // ---- recovery ----

  it('recovery from suspended → active EMITS tenant:resumed', async () => {
    db.organization.findUnique.mockResolvedValue({ subscriptionStatus: 'suspended' });
    await service.recover('o1');
    expect(db.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscriptionStatus: 'active', entitlementStateSince: null } }),
    );
    expect(notifier.emit).toHaveBeenCalledWith('o1', 'resumed', expect.any(String));
  });

  it('recovery from past_due / publish_locked → active does NOT emit (holding never reached)', async () => {
    for (const status of ['past_due', 'publish_locked']) {
      notifier.emit.mockClear();
      db.organization.findUnique.mockResolvedValue({ subscriptionStatus: status });
      await service.recover('o1');
      expect(notifier.emit).not.toHaveBeenCalled();
    }
  });

  // ---- episode clock (entitlementStateSince) ----

  it('beginPastDue only fires from active/trial — a repeat while past_due does NOT reset the clock', async () => {
    await service.beginPastDue('o1', NOW);
    expect(db.organization.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1', subscriptionStatus: { in: ['active', 'trial'] } },
        data: { subscriptionStatus: 'past_due', entitlementStateSince: NOW },
      }),
    );
  });

  // ---- heartbeat / staleness ----

  it('advanceLadder writes a heartbeat (dead job is observable)', async () => {
    await service.advanceLadder(NOW);
    const [key, raw, ttl] = redis.set.mock.calls.at(-1) as [string, string, number];
    expect(key).toBe('entitlement:ladder:last-run');
    expect(typeof ttl).toBe('number');
    expect(JSON.parse(raw).at).toBe(NOW.getTime());
  });

  it('the heartbeat payload distinguishes a CLEAN run from a DEGRADED one (D4)', async () => {
    // Without this the freshness watchdog reads "ran recently" identically for a
    // run that advanced everyone and a run that stranded half the fleet.
    await service.advanceLadder(NOW);
    expect(JSON.parse(redis.set.mock.calls.at(-1)![1]).degraded).toBe(false);

    redis.set.mockClear();
    db.organization.findMany.mockImplementation(({ where }: any) => {
      if (where.subscriptionStatus === 'publish_locked') throw new Error('db exploded');
      return [];
    });
    await service.advanceLadder(NOW);
    const payload = JSON.parse(redis.set.mock.calls.at(-1)![1]);
    expect(payload.degraded).toBe(true);
    expect(payload.rungFailures).toBe(1);
  });

  it('T7: a HUNG heartbeat WRITE still lets the run resolve (F7)', async () => {
    // RedisService.set try/catches a rejection but has NO timeout, so the
    // blackholed-socket case applies to it verbatim. No tenant is stranded (the
    // heartbeat is last), but advanceLadder never resolves — so
    // handleGracePeriodExpiry never reaches its summary/DEGRADED log or Sentry,
    // taking out exactly the channel the payload exists to feed — and the cron
    // leaks a dangling promise every day.
    jest.useFakeTimers();
    try {
      redis.set.mockReturnValue(new Promise(() => {})); // never settles
      db.organization.findMany.mockImplementation(({ where }: any) =>
        where.subscriptionStatus === 'past_due' ? threeAtPublishLock() : [],
      );

      const run = service.advanceLadder(NOW);
      await jest.advanceTimersByTimeAsync(10_000);
      const result = await run;

      expect(result.advanced).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('T8: a HUNG heartbeat READ resolves toward STALE, it does not hang the watchdog (F7)', async () => {
    jest.useFakeTimers();
    try {
      redis.get.mockReturnValue(new Promise(() => {})); // never settles

      const read = service.isLadderStale(NOW);
      await jest.advanceTimersByTimeAsync(10_000);

      // Unreadable must resolve toward STALE — never toward a reassuring FRESH.
      expect(await read).toBe(true);
      expect(await (async () => {
        const p = service.readHeartbeat();
        await jest.advanceTimersByTimeAsync(10_000);
        return p;
      })()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('every malformed heartbeat resolves toward STALE', async () => {
    for (const raw of ['', 'not-a-heartbeat', '{}', '{"at":"nope"}', '{"at":null}', '[1,2]', '{bad']) {
      redis.get.mockResolvedValue(raw);
      expect(await service.isLadderStale(NOW)).toBe(true);
    }
  });

  it('isLadderStale is true when never run and false when run recently', async () => {
    redis.get.mockResolvedValue(null);
    expect(await service.isLadderStale(NOW)).toBe(true);
    redis.get.mockResolvedValue(JSON.stringify({ at: NOW.getTime() - 60_000 }));
    expect(await service.isLadderStale(NOW)).toBe(false);
    redis.get.mockResolvedValue(JSON.stringify({ at: NOW.getTime() - 48 * 60 * 60 * 1000 }));
    expect(await service.isLadderStale(NOW)).toBe(true);
  });

  it('isLadderStale still reads the pre-D4 bare-millis heartbeat', async () => {
    // A heartbeat written by the previous release survives its 7-day TTL across
    // the deploy; misreading it as absent would fire a false STALE alert.
    redis.get.mockResolvedValue(String(NOW.getTime() - 60_000));
    expect(await service.isLadderStale(NOW)).toBe(false);
    redis.get.mockResolvedValue('not-a-heartbeat');
    expect(await service.isLadderStale(NOW)).toBe(true);
  });

  // ---- banner data ----

  it('getBannerState reports days remaining to the next rung and publishLocked', async () => {
    db.organization.findUnique.mockResolvedValue({ subscriptionStatus: 'publish_locked', entitlementStateSince: daysAgo(9) });
    const banner = await service.getBannerState('o1', NOW);
    expect(banner.status).toBe('publish_locked');
    expect(banner.publishLocked).toBe(true);
    expect(banner.nextRung).toBe('suspended');
    expect(banner.daysUntilNextRung).toBe(LADDER.DAYS_TO_SUSPEND - 9); // 14 - 9 = 5
  });

  // ---- dunning email dedup ----

  it('sends a deduped dunning email on the publish_lock transition (keyed per org+rung)', async () => {
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'past_due'
        ? [{ id: 'o1', entitlementStateSince: daysAgo(LADDER.DAYS_TO_PUBLISH_LOCK), users: [{ email: 'a@x.com', firstName: 'Ada' }] }]
        : [],
    );
    await service.advanceLadder(NOW);
    // claim keyed per (org, rung); email sent on first claim
    expect(redisClient.set).toHaveBeenCalledWith('dunning:o1:publish_locked', '1', 'EX', expect.any(Number), 'NX');
    expect(mail.sendPaymentFailedEmail).toHaveBeenCalledWith('a@x.com', 'Ada');
  });

  it('does NOT re-send the dunning email when the claim already exists (job re-run)', async () => {
    redisClient.set.mockResolvedValue(null); // key already claimed
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'publish_locked'
        ? [{ id: 'o1', entitlementStateSince: daysAgo(LADDER.DAYS_TO_SUSPEND), users: [{ email: 'a@x.com', firstName: 'Ada' }] }]
        : [],
    );
    await service.advanceLadder(NOW);
    // suspended device signal still fires (that's transition-guarded), but the
    // email is suppressed by the dedup claim.
    expect(notifier.emit).toHaveBeenCalledWith('o1', 'suspended', expect.any(String));
    expect(mail.sendPaymentFailedEmail).not.toHaveBeenCalled();
  });

  // ---- K19: tenant/rung isolation ----
  //
  // INVARIANT: "failure processing tenant/rung A must not prevent independently
  // processable tenant/rung B from advancing." There is no transactionality
  // argument against isolation here — each Prisma call is its own transaction,
  // nothing wraps the loop in `$transaction`, and the DB already commits per-org.

  /** Three orgs sitting exactly on the publish-lock threshold, each with an admin. */
  const threeAtPublishLock = () =>
    ['o1', 'o2', 'o3'].map((id) => ({
      id,
      entitlementStateSince: daysAgo(LADDER.DAYS_TO_PUBLISH_LOCK),
      users: [{ email: `${id}@x.com`, firstName: id }],
    }));

  const findManyStatuses = () =>
    db.organization.findMany.mock.calls.map((c: any[]) => c[0]?.where?.subscriptionStatus);

  it('T1: a mid-run failure on tenant 2 of 3 strands neither tenant 3, nor later rungs, nor the heartbeat', async () => {
    // THE centerpiece. Before K19 the unguarded `client.set` in claimDunningNotice
    // rejected during a Redis outage and that rejection propagated all the way out
    // of advanceLadder: o3 was never even attempted, rungs 2 and 3 never ran, and
    // writeHeartbeat never fired — so the freshness watchdog could not tell a
    // half-run from a clean one.
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'past_due' ? threeAtPublishLock() : [],
    );
    redisClient.set
      .mockResolvedValueOnce('OK')
      .mockRejectedValueOnce(new Error('Connection is closed.'))
      .mockResolvedValue('OK');

    const result = await service.advanceLadder(NOW);

    // 1. Every eligible org reached the CAS — including the one AFTER the failure.
    for (const id of ['o1', 'o2', 'o3']) {
      expect(db.organization.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id, subscriptionStatus: 'past_due' } }),
      );
    }

    // 2. Fail-OPEN: an unavailable claim store must not silently swallow a
    //    customer's only escalation notice (D3).
    expect(mail.sendPaymentFailedEmail).toHaveBeenCalledTimes(3);

    // 3. Rungs 2 and 3 still executed — iteration is rung-major, so a rung-1
    //    abort used to kill them too.
    expect(findManyStatuses()).toContain('publish_locked');
    expect(findManyStatuses()).toContain('suspended');

    // 4. The heartbeat was written — a degraded run must stay observable.
    expect(redis.set).toHaveBeenCalledWith(
      'entitlement:ladder:last-run',
      expect.any(String),
      expect.any(Number),
    );

    // 5. Accounting invariants.
    expect(result.attempted).toBe(result.eligible);
    expect(result.advanced + result.casLost + result.failed).toBe(result.attempted);
  });

  it('T1b: a per-org THROW on tenant 2 of 3 is isolated, and reported exactly once', async () => {
    // T1's injected failure lands inside claimDunningNotice, which now absorbs it
    // (D3) — so T1 is the oracle for the FAIL DIRECTION. This test drives a
    // failure the claim store cannot absorb (the CAS itself rejects), which is
    // what actually reaches the per-org catch, and asserts the SAME three
    // structural consequences plus the reporting contract. All three are asserted
    // together so deleting the per-org try/catch cannot half-satisfy it.
    //
    // logger.error alone reaches NO human from a cron — SentryInterceptor is
    // HTTP-only — so the Sentry capture is the observability half of D5, and
    // "exactly one" is what stops a fleet-wide outage becoming a flood.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/nestjs');
    const capture = jest.spyOn(Sentry, 'captureException').mockImplementation(() => undefined);
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    try {
      db.organization.findMany.mockImplementation(({ where }: any) =>
        where.subscriptionStatus === 'past_due' ? threeAtPublishLock() : [],
      );
      db.organization.updateMany.mockImplementation((arg: any) =>
        arg?.where?.id === 'o2'
          ? Promise.reject(new Error('deadlock detected'))
          : Promise.resolve({ count: 1 }),
      );

      const result = await service.advanceLadder(NOW);

      // (a) tenant 3 — the one AFTER the failure — still flipped
      expect(db.organization.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'o3', subscriptionStatus: 'past_due' } }),
      );
      // (b) the later rungs still ran (iteration is rung-major)
      expect(findManyStatuses()).toContain('publish_locked');
      expect(findManyStatuses()).toContain('suspended');
      // (c) the heartbeat was still written, carrying the degraded outcome
      const heartbeat = JSON.parse(redis.set.mock.calls.at(-1)![1]);
      expect(heartbeat.at).toBe(NOW.getTime());
      expect(heartbeat.degraded).toBe(true);

      expect(result).toMatchObject({ eligible: 3, attempted: 3, advanced: 2, casLost: 0, failed: 1 });
      expect(errorLog).toHaveBeenCalledTimes(1);
      expect(String(errorLog.mock.calls[0][0])).toContain('o2');
      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture.mock.calls[0][1]).toMatchObject({
        tags: expect.objectContaining({ orgId: 'o2', rung: 'past_due->publish_locked' }),
      });
    } finally {
      capture.mockRestore();
      errorLog.mockRestore();
    }
  });

  it('T1c: a throw BEFORE the eligibility check is isolated too (F3)', async () => {
    // `entitlementStateSince` is cast `as Date`. A value that is not one — Prisma
    // handing back a string, or a future `select` dropping the field — throws
    // inside wholeDaysBetween. Computed OUTSIDE the per-org try, that throw
    // escapes to runRung and abandons every remaining org in the rung: the K19
    // invariant reintroduced by a cast. Unreachable today via the `not: null`
    // filter, so this pins defense in depth — and pins the accounting, which is
    // the subtle part: an org that threw before eligibility was decided must
    // still be counted, or `attempted === eligible` silently stops holding.
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'past_due'
        ? [
            { id: 'o1', entitlementStateSince: daysAgo(LADDER.DAYS_TO_PUBLISH_LOCK) },
            { id: 'o2', entitlementStateSince: '2026-06-25T00:00:00.000Z' as unknown as Date },
            { id: 'o3', entitlementStateSince: daysAgo(LADDER.DAYS_TO_PUBLISH_LOCK) },
          ]
        : [],
    );

    const result = await service.advanceLadder(NOW);

    // o3 — after the bad row — still advanced.
    expect(db.organization.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o3', subscriptionStatus: 'past_due' } }),
    );
    expect(findManyStatuses()).toContain('suspended');
    expect(redis.set).toHaveBeenCalled(); // heartbeat still written
    expect(result).toMatchObject({ eligible: 3, attempted: 3, advanced: 2, failed: 1 });
    expect(result.advanced + result.casLost + result.failed).toBe(result.attempted);
    expect(result.rungFailures).toBe(0); // isolated per-org, NOT escalated to the rung
  });

  it('D6: candidates are read in a deterministic order', async () => {
    // Heap order is not stable. Without an explicit order a repeated partial
    // outage systematically strands whichever tail Postgres happens to return
    // last, and "which orgs did the run reach?" is not reproducible after the
    // fact.
    await service.advanceLadder(NOW);
    for (const call of db.organization.findMany.mock.calls) {
      expect(call[0]).toMatchObject({ orderBy: { id: 'asc' } });
    }
  });

  it('T2: a rung whose machinery throws does not take out the rungs around it', async () => {
    // Rung isolation (D2). findMany rejecting for publish_locked is the shape a
    // transient DB/pool fault takes; before K19 it aborted rung 3 as well.
    db.organization.findMany.mockImplementation(({ where }: any) => {
      if (where.subscriptionStatus === 'publish_locked') {
        throw new Error('pool exhausted');
      }
      return where.subscriptionStatus === 'past_due'
        ? [{ id: 'o1', entitlementStateSince: daysAgo(LADDER.DAYS_TO_PUBLISH_LOCK) }]
        : [{ id: 'o9', entitlementStateSince: daysAgo(LADDER.DAYS_TO_CANCEL) }];
    });

    const result = await service.advanceLadder(NOW);

    // Rung 1 completed...
    expect(db.organization.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o1', subscriptionStatus: 'past_due' } }),
    );
    // ...and rung 3 ran anyway, despite rung 2 blowing up between them.
    expect(db.organization.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o9', subscriptionStatus: 'suspended' } }),
    );
    expect(result.advanced).toBe(2);
    expect(result.rungFailures).toBe(1);
    expect(result.rungs['publish_locked->suspended']).toEqual({
      eligible: 0,
      attempted: 0,
      advanced: 0,
      casLost: 0,
      failed: 0,
    });
  });

  it('T3: with the claim store 100% down every eligible org flips and gets EXACTLY one email', async () => {
    // Fail direction (D3). Fail-open cannot multiply mail: within a run an org
    // appears once, and across cluster instances the CAS updateMany on a single
    // row is atomic, so only one instance ever reaches the send.
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'past_due' ? threeAtPublishLock() : [],
    );
    redisClient.set.mockRejectedValue(new Error('Connection is closed.'));

    const result = await service.advanceLadder(NOW);

    expect(result.advanced).toBe(3);
    expect(result.failed).toBe(0);
    expect(mail.sendPaymentFailedEmail).toHaveBeenCalledTimes(3);
    for (const id of ['o1', 'o2', 'o3']) {
      expect(mail.sendPaymentFailedEmail).toHaveBeenCalledWith(`${id}@x.com`, id);
    }
  });

  it('T3b: an outage ioredis has ALREADY noticed short-circuits the claim entirely', async () => {
    // getClient() stays non-null through an outage (only disconnect() nulls it),
    // so isAvailable() is the only usable liveness signal — and skipping the
    // command avoids ~42s of ioredis offline-queue retries per org.
    redis.isAvailable.mockReturnValue(false);
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'past_due' ? threeAtPublishLock() : [],
    );

    const result = await service.advanceLadder(NOW);

    expect(redisClient.set).not.toHaveBeenCalled();
    expect(result.advanced).toBe(3);
    expect(mail.sendPaymentFailedEmail).toHaveBeenCalledTimes(3);
    expect(service.getDunningClaimFailOpenCount()).toBe(3);
  });

  it('T4: a claim that HANGS (never settles) still lets the run finish inside the bound', async () => {
    // The case a bare try/catch does not cover at all: a blackholed socket never
    // rejects, so without the raceWithTimeout bound the ladder waits forever and
    // a PM2 reload turns the delay into a LOST run.
    jest.useFakeTimers();
    try {
      redisClient.set.mockReturnValue(new Promise(() => {})); // never settles
      db.organization.findMany.mockImplementation(({ where }: any) =>
        where.subscriptionStatus === 'past_due' ? threeAtPublishLock() : [],
      );

      const run = service.advanceLadder(NOW);
      // 3 orgs × a 2s bound, plus slack — and nothing more.
      await jest.advanceTimersByTimeAsync(10_000);
      const result = await run;

      expect(result.advanced).toBe(3);
      expect(result.failed).toBe(0);
      expect(mail.sendPaymentFailedEmail).toHaveBeenCalledTimes(3);
      expect(findManyStatuses()).toContain('suspended');
    } finally {
      jest.useRealTimers();
    }
  });

  it('T5: a missed day does not compound — all three thresholds measure from the same episode start', async () => {
    // entitlementStateSince is NEVER rewritten on a rung advance, so a run that
    // was skipped (or degraded) yesterday self-heals today: the org is simply
    // measured against its ORIGINAL episode start and cascades through as many
    // rungs as it has earned. This is why isolation is a correctness fix and not
    // just hygiene — and why the ladder can be idempotently re-run.
    const since = daysAgo(LADDER.DAYS_TO_CANCEL + 3); // 33 days: past every rung
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'past_due' ? [{ id: 'o1', entitlementStateSince: since }] : [],
    );

    await service.advanceLadder(NOW);

    // The rung write carries no entitlementStateSince — the clock is untouched.
    const flips = db.organization.updateMany.mock.calls
      .map((c: any[]) => c[0])
      .filter((arg: any) => arg?.where?.id === 'o1');
    expect(flips).toHaveLength(1);
    expect(flips[0].data).not.toHaveProperty('entitlementStateSince');

    // Feed the SAME org back at its next status, exactly as tomorrow's (or this
    // run's later) rung would see it: it is immediately eligible again.
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'publish_locked'
        ? [{ id: 'o1', entitlementStateSince: since }]
        : [],
    );
    const next = await service.advanceLadder(NOW);
    expect(next.advanced).toBe(1);
    expect(next.eligible).toBe(1);
  });

  it('past_due → publish_lock with no admin email does not crash', async () => {
    db.organization.findMany.mockImplementation(({ where }: any) =>
      where.subscriptionStatus === 'past_due'
        ? [{ id: 'o1', entitlementStateSince: daysAgo(LADDER.DAYS_TO_PUBLISH_LOCK) }] // no users
        : [],
    );
    const { advanced } = await service.advanceLadder(NOW);
    expect(advanced).toBe(1);
    expect(mail.sendPaymentFailedEmail).not.toHaveBeenCalled();
  });
});

/**
 * T6 — source-scan guard, mirroring the shape of `cluster-cron-policy.spec.ts`.
 *
 * The defect K19 fixes is not visible in either file's behaviour tests without a
 * deliberately-constructed Redis outage: `getClient()` returns a NON-NULL client
 * throughout a real outage (only `disconnect()` nulls it), so the `if (!client)`
 * fast path never fires and the raw command that follows it rejects — or, on a
 * blackholed socket, never settles at all. Pin the shape in source so the next
 * `const client = this.redis.getClient()` cannot reintroduce it.
 */
describe('raw-Redis-command guard (K19 source scan)', () => {
  const FILES = ['entitlement.service.ts', 'billing.service.ts'];

  /**
   * An ioredis command call, on ANY receiver — `client.set(...)`,
   * `redisClient.get(...)`, `this.redis.getClient()!.del(...)`. Hard-coding the
   * receiver name `client` let that last form evade the scan entirely (F5), so
   * match the METHOD and decide about the receiver separately.
   */
  const COMMAND = /\.(set|get|del|expire|incr|decr|hset|hget|sadd|eval|ttl)\s*\(/g;

  /**
   * `RedisService.set/get/del` are the safe wrappers — they try/catch internally
   * and are not the K19 shape. Everything else reaching a command is raw.
   */
  const WRAPPER_RECEIVER = /this\.(redis|redisService)$/;

  /** Start of the next class member — bounds a scan window to ONE method. */
  const MEMBER_START = /\n {2}(?:\/\*\*|private |public |protected |static |async |get |set |[A-Za-z_$][\w$]*\()/g;

  /**
   * True if `preamble` leaves an OPEN `try {` at its end. Counting `try {`
   * occurrences is not enough — a try block that already closed above the command
   * satisfies a naive `/try\s*\{/` test while the command itself sits bare (F5).
   * Brace-count from each `try {` to the end; the command is guarded only if some
   * try's depth never returns to zero.
   */
  function hasOpenTry(preamble: string): boolean {
    for (const m of preamble.matchAll(/try\s*\{/g)) {
      let depth = 0;
      for (let i = (m.index as number) + m[0].length - 1; i < preamble.length; i += 1) {
        if (preamble[i] === '{') depth += 1;
        else if (preamble[i] === '}') depth -= 1;
        if (depth === 0 && i > (m.index as number)) break; // this try closed
      }
      if (depth > 0) return true; // still open where the command sits
    }
    return false;
  }

  /** Every RAW (non-wrapper) command in `window`, with its offset. */
  function rawCommands(window: string): Array<{ text: string; index: number }> {
    const out: Array<{ text: string; index: number }> = [];
    for (const m of window.matchAll(COMMAND)) {
      const index = m.index as number;
      if (WRAPPER_RECEIVER.test(window.slice(0, index))) continue;
      out.push({ text: m[0], index });
    }
    return out;
  }

  /** The single method a `getClient()` at `start` belongs to. */
  function methodWindow(src: string, start: number, nextAnchor: number): string {
    MEMBER_START.lastIndex = start;
    const next = MEMBER_START.exec(src);
    const end = Math.min(nextAnchor, next ? next.index : src.length);
    return src.slice(start, end);
  }

  it.each(FILES)('%s never issues a raw client command outside a try/catch', (file) => {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf-8');

    const anchors = [...src.matchAll(/getClient\(\)/g)].map((m) => m.index as number);
    expect(anchors.length).toBeGreaterThan(0);

    let checked = 0;
    for (const [i, start] of anchors.entries()) {
      const window = methodWindow(src, start, anchors[i + 1] ?? src.length);

      // EVERY raw command in the window, not just the first — a second unguarded
      // command after a guarded one used to slip through (F5).
      for (const cmd of rawCommands(window)) {
        checked += 1;
        const line = src.slice(0, start).split('\n').length;
        if (!hasOpenTry(window.slice(0, cmd.index))) {
          throw new Error(
            `${file}:~${line} issues \`${cmd.text}\` with no OPEN try/catch around it. ` +
              `getClient() is non-null during a Redis outage, so this rejects (after ~42s of ` +
              `ioredis retries) and the rejection escapes into the caller — the K19 defect.`,
          );
        }
      }
    }
    // The scan is worthless if the pattern silently stops matching anything.
    expect(checked).toBeGreaterThan(0);
  });

  it('the scan itself detects an unguarded command (meta-test)', () => {
    // A source-scan test that cannot fail is decoration. Prove both predicates on
    // synthetic sources rather than trusting them because the real files pass.
    expect(hasOpenTry('const client = x.getClient();\n')).toBe(false);
    expect(hasOpenTry('const client = x.getClient();\n try {\n')).toBe(true);
    // The evasion F5 named: an ALREADY-CLOSED try above the command.
    expect(hasOpenTry('try { a(); } catch {}\n')).toBe(false);
    expect(hasOpenTry('try { a(); } catch {}\n try {\n')).toBe(true);

    // The receiver-name evasion: a non-`client` receiver must still be caught.
    expect(rawCommands('this.redis.getClient()!.set(k, v);')).toHaveLength(1);
    expect(rawCommands('redisClient.del(k);')).toHaveLength(1);
    // ...while the RedisService wrappers (which try/catch internally) are not.
    expect(rawCommands('await this.redis.set(k, v, 1);')).toHaveLength(0);
    expect(rawCommands('await this.redisService.get(k);')).toHaveLength(0);

    // And the "only the first command is checked" evasion: both are reported.
    expect(rawCommands('client.set(a); client.del(b);')).toHaveLength(2);
  });

  it('entitlement.service.ts gates the dunning claim on isAvailable(), not on a null client', () => {
    const src = fs.readFileSync(path.join(__dirname, 'entitlement.service.ts'), 'utf-8');
    expect(src).toContain('!this.redis.isAvailable()');
    // ...and bounds the command, because isAvailable() only reflects outages
    // ioredis has ALREADY observed — a hang leaves it true forever.
    expect(src).toContain('raceWithTimeout');
  });
});
