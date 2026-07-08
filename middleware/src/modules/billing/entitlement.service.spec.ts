import { Test } from '@nestjs/testing';
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
  let redis: { get: jest.Mock; set: jest.Mock; getClient: jest.Mock };
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
    expect(db.organization.updateMany).not.toHaveBeenCalled();
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
    expect(redis.set).toHaveBeenCalledWith('entitlement:ladder:last-run', String(NOW.getTime()), expect.any(Number));
  });

  it('isLadderStale is true when never run and false when run recently', async () => {
    redis.get.mockResolvedValue(null);
    expect(await service.isLadderStale(NOW)).toBe(true);
    redis.get.mockResolvedValue(String(NOW.getTime() - 60_000));
    expect(await service.isLadderStale(NOW)).toBe(false);
    redis.get.mockResolvedValue(String(NOW.getTime() - 48 * 60 * 60 * 1000));
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
