import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/modules/database/database.service';
import { tierEntitlementFields } from '../src/modules/billing/constants/plans';

/**
 * The two billing SQL constructs that unit tests CANNOT prove, against a real
 * Postgres.
 *
 * Every other billing spec mocks Prisma, so neither of these had ever executed:
 *
 *   1. `billingTransaction.upsert` with `update: {}` on the composite unique
 *      `@@unique([provider, providerTransactionId])`. The whole B-H1 fix rests
 *      on "a duplicate insert is a no-op rather than a P2002" — a claim about
 *      Postgres and Prisma's compound-unique argument shape, not about our
 *      control flow. A mock returning whatever we told it to proves nothing.
 *
 *   2. The compare-and-set `updateMany({ where: { id, OR: [{billingEventAt:
 *      null}, {billingEventAt: {lte: eventAt}}] } })`. The B-M1 fix rests on
 *      Postgres arbitrating between two cluster instances. `count === 0` on the
 *      losing write is the only observable that says the predicate really
 *      filtered — and it is exactly the value a mock hands back for free.
 *
 * For money code, "the mock agreed with me" is the wrong kind of confidence.
 *
 * Requires the test database:
 *   pnpm --filter @vizora/middleware test:e2e:setup
 */
describe('billing persistence against real Postgres (e2e)', () => {
  let moduleRef: TestingModule;
  let db: DatabaseService;
  let organizationId: string;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    db = moduleRef.get(DatabaseService);
    await db.$connect();

    const org = await db.organization.create({
      data: {
        name: `Billing Persistence ${suffix}`,
        slug: `billing-persistence-${suffix}`,
        subscriptionTier: 'pro',
        subscriptionStatus: 'active',
        screenQuota: 100,
      },
    });
    organizationId = org.id;
  });

  afterAll(async () => {
    if (organizationId) {
      await db.billingTransaction.deleteMany({ where: { organizationId } });
      await db.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
    }
    await db.$disconnect();
    await moduleRef?.close();
  });

  describe('billing_transactions upsert (B-H1)', () => {
    const providerTransactionId = `pay_e2e_${suffix}`;

    const upsert = (amount: number, status: string) =>
      db.billingTransaction.upsert({
        where: {
          provider_providerTransactionId: {
            provider: 'razorpay',
            providerTransactionId,
          },
        },
        create: {
          organizationId,
          provider: 'razorpay',
          providerTransactionId,
          type: 'subscription',
          status,
          amount,
          currency: 'INR',
          description: 'Subscription payment',
        },
        update: {},
      });

    it('inserts the row on first observation', async () => {
      const row = await upsert(59900, 'succeeded');
      expect(row.amount).toBe(59900);
      expect(row.status).toBe('succeeded');
    });

    it('a REPEAT observation does not throw P2002 — this is what unblocks the retry', async () => {
      // With a bare `create` this line raises
      // "Unique constraint failed on the fields: (`provider`,`providerTransactionId`)",
      // and because recordTransaction runs BEFORE entitlementService.recover(),
      // every PSP retry would die here and a paying suspended org would stay
      // suspended forever.
      await expect(upsert(59900, 'succeeded')).resolves.toBeDefined();
    });

    it('CONTROL: a bare create on the same key really does raise P2002', async () => {
      // The control that makes the test above mean something. Without this, a
      // green "upsert does not throw" is equally consistent with the unique
      // constraint not existing at all.
      await expect(
        db.billingTransaction.create({
          data: {
            organizationId,
            provider: 'razorpay',
            providerTransactionId,
            type: 'subscription',
            status: 'succeeded',
            amount: 59900,
            currency: 'INR',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('leaves the ORIGINAL row intact — the audit log is append-only', async () => {
      // A retry carrying different values must not rewrite history.
      await upsert(1, 'failed');

      const rows = await db.billingTransaction.findMany({
        where: { provider: 'razorpay', providerTransactionId },
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].amount).toBe(59900);
      expect(rows[0].status).toBe('succeeded');
    });
  });

  describe('billingEventAt compare-and-set (B-M1)', () => {
    const OLD = new Date('2026-08-09T00:00:00.000Z');
    const MARK = new Date('2026-08-10T00:00:00.000Z');
    const NEW = new Date('2026-08-11T00:00:00.000Z');

    /** Exactly the predicate BillingService.writeEntitlement emits. */
    const cas = (eventAt: Date, data: Record<string, unknown>) =>
      db.organization.updateMany({
        where: {
          id: organizationId,
          OR: [{ billingEventAt: null }, { billingEventAt: { lte: eventAt } }],
        },
        data: { ...data, billingEventAt: eventAt },
      });

    beforeEach(async () => {
      await db.organization.update({
        where: { id: organizationId },
        data: {
          billingEventAt: MARK,
          subscriptionTier: 'pro',
          screenQuota: 100,
          subscriptionStatus: 'active',
        },
      });
    });

    it('applies a NEWER event and advances the mark', async () => {
      const result = await cas(NEW, tierEntitlementFields('basic'));

      expect(result.count).toBe(1);
      const org = await db.organization.findUnique({ where: { id: organizationId } });
      expect(org?.subscriptionTier).toBe('basic');
      expect(org?.billingEventAt).toEqual(NEW);
    });

    it('REJECTS an older event — count 0, row untouched', async () => {
      const result = await cas(OLD, tierEntitlementFields('free'));

      // This zero is the whole point: it is Postgres, not JavaScript, refusing
      // the write. A read-then-write cannot produce it under concurrency.
      expect(result.count).toBe(0);
      const org = await db.organization.findUnique({ where: { id: organizationId } });
      expect(org?.subscriptionTier).toBe('pro');
      expect(org?.screenQuota).toBe(100);
      expect(org?.billingEventAt).toEqual(MARK);
    });

    it('CONTROL: without the predicate the SAME older write lands — the WHERE is what rejects', async () => {
      // Proves the count 0 above comes from the ordering predicate and not from
      // the row being missing, the id being wrong, or Prisma no-op'ing.
      const unguarded = await db.organization.updateMany({
        where: { id: organizationId },
        data: { ...tierEntitlementFields('free'), billingEventAt: OLD },
      });

      expect(unguarded.count).toBe(1);
      const org = await db.organization.findUnique({ where: { id: organizationId } });
      expect(org?.subscriptionTier).toBe('free');
    });

    it('admits an event at EXACTLY the mark (lte, not lt)', async () => {
      // Provider timestamps have one-second resolution and tier writes are
      // idempotent, so equality must not drop the second event.
      const result = await cas(MARK, tierEntitlementFields('basic'));
      expect(result.count).toBe(1);
    });

    it('applies when the mark is NULL (an org that has never seen a billing event)', async () => {
      await db.organization.update({
        where: { id: organizationId },
        data: { billingEventAt: null },
      });

      const result = await cas(OLD, tierEntitlementFields('basic'));
      expect(result.count).toBe(1);
    });

    it('CONCURRENT older + newer: the newer one wins and the older cannot regress it', async () => {
      // The interleaving the guard exists for. Issued together, resolved by the
      // database; whichever lands second, the row must end on the newer event.
      const [newer, older] = await Promise.all([
        cas(NEW, tierEntitlementFields('basic')),
        cas(OLD, tierEntitlementFields('free')),
      ]);

      expect(newer.count).toBe(1);
      // The older write either never matched, or matched before the newer one
      // landed — either way the newer event owns the final state.
      expect(older.count).toBeLessThanOrEqual(1);

      const org = await db.organization.findUnique({ where: { id: organizationId } });
      expect(org?.billingEventAt).toEqual(NEW);
      expect(org?.subscriptionTier).toBe('basic');
    });

    it('storageQuotaBytes really does travel with the tier through a CAS write (A-F3)', async () => {
      await cas(NEW, tierEntitlementFields('free'));

      const org = await db.organization.findUnique({ where: { id: organizationId } });
      expect(org?.storageQuotaBytes).toBe(BigInt(1024 * 1024 * 1024));
    });
  });
});
