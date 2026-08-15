import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { DatabaseService } from '../database/database.service';
import { StripeProvider } from './providers/stripe.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { EntitlementService } from './entitlement.service';
import { hasApiAccess } from './constants/plans';

/**
 * TABLE-DRIVEN webhook routing contract (B3).
 *
 * Asserts, for each (event type × payload), the exact `organization.updateMany`
 * WRITE SET the billing service produces — or that it writes nothing at all —
 * together with the `where` clause, so org scoping is covered too.
 *
 * This exists because `webhooks.controller.spec.ts` asserts against a fully
 * mocked BillingService: it proves the controller forwards a request, and
 * proves NOTHING about what a Razorpay event does to an organization row. That
 * coverage illusion is how "subscription.activated is unrouted" survived.
 *
 * The provider's `verifyWebhookSignature` is mocked here so the table can name
 * event shapes directly; the REAL HMAC path is covered in
 * `providers/razorpay.provider.spec.ts`.
 */

const PLAN_ENV = {
  RAZORPAY_BASIC_MONTHLY_PLAN_ID: 'plan_basic_m',
  RAZORPAY_BASIC_YEARLY_PLAN_ID: 'plan_basic_y',
  RAZORPAY_PRO_MONTHLY_PLAN_ID: 'plan_pro_m',
  RAZORPAY_PRO_YEARLY_PLAN_ID: 'plan_pro_y',
  STRIPE_BASIC_MONTHLY_PRICE_ID: 'price_basic_m',
  STRIPE_PRO_MONTHLY_PRICE_ID: 'price_pro_m',
} as const;

const PRO_STORAGE_BYTES = BigInt(102400 * 1024 * 1024);
const BASIC_STORAGE_BYTES = BigInt(25600 * 1024 * 1024);
const FREE_STORAGE_BYTES = BigInt(1024 * 1024 * 1024);

/** The complete free-tier entitlement set — tier, screens AND storage (A-F3). */
const FREE_TIER_FIELDS = {
  subscriptionTier: 'free',
  screenQuota: 5,
  storageQuotaBytes: FREE_STORAGE_BYTES,
};

const PRO_TIER_FIELDS = {
  subscriptionTier: 'pro',
  screenQuota: 100,
  storageQuotaBytes: PRO_STORAGE_BYTES,
};

const BASIC_TIER_FIELDS = {
  subscriptionTier: 'basic',
  screenQuota: 50,
  storageQuotaBytes: BASIC_STORAGE_BYTES,
};

// Emission times. `OLDER` is deliberately before the org's applied mark.
const APPLIED_MARK = new Date('2026-08-10T00:00:00.000Z');
const NEWER = new Date('2026-08-11T00:00:00.000Z');
const OLDER = new Date('2026-08-09T00:00:00.000Z');

describe('billing webhook routing (B3)', () => {
  let service: BillingService;
  let db: any;
  let stripe: any;
  let razorpay: any;
  let redisClient: any;
  let entitlement: any;
  let savedEnv: Record<string, string | undefined>;

  const rawEvent = { rawBody: Buffer.from('{}'), signature: 'sig' };

  /** Baseline org: Razorpay, already paying for `basic`, mark already applied. */
  const razorpayOrg = (overrides: Record<string, unknown> = {}) => ({
    id: 'org-rzp',
    subscriptionTier: 'basic',
    subscriptionStatus: 'active',
    screenQuota: 50,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    razorpayCustomerId: 'cust_rzp',
    // Matches the id in the fixtures so neither the P1 reconcile write nor the
    // B-H3 foreign-subscription guard fires; both have dedicated tests below.
    razorpaySubscriptionId: 'sub_rzp',
    paymentProvider: 'razorpay',
    billingEventAt: APPLIED_MARK,
    users: [{ email: 'admin@test.com', firstName: 'Admin' }],
    ...overrides,
  });

  const stripeOrg = (overrides: Record<string, unknown> = {}) => ({
    ...razorpayOrg(),
    id: 'org-stripe',
    stripeCustomerId: 'cus_stripe',
    stripeSubscriptionId: 'sub_stripe',
    razorpayCustomerId: null,
    razorpaySubscriptionId: null,
    paymentProvider: 'stripe',
    ...overrides,
  });

  /** A Razorpay subscription.* payload as the provider hands it over (unwrapped). */
  const rzpSubscription = (
    planId: string | undefined,
    status: string,
    extra: Record<string, unknown> = {},
  ) => ({
    subscription: {
      id: 'sub_rzp',
      customer_id: 'cust_rzp',
      status,
      ...(planId ? { plan_id: planId } : {}),
      ...extra,
    },
  });

  /** A Stripe customer.subscription.* payload (data.object). */
  const stripeSubscription = (priceId: string | undefined, status: string) => ({
    id: 'sub_stripe',
    customer: 'cus_stripe',
    status,
    ...(priceId ? { items: { data: [{ price: { id: priceId } }] } } : {}),
  });

  beforeAll(() => {
    savedEnv = {};
    for (const [k, v] of Object.entries(PLAN_ENV)) {
      savedEnv[k] = process.env[k];
      process.env[k] = v;
    }
  });

  afterAll(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  beforeEach(async () => {
    db = {
      organization: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        // Every entitlement write is a conditional updateMany (compare-and-set
        // on billingEventAt). count: 1 = the write won.
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      billingTransaction: { upsert: jest.fn().mockResolvedValue({ id: 'txn' }) },
      $transaction: jest.fn(async (cb: any) => cb(db)),
    };
    stripe = { name: 'stripe', verifyWebhookSignature: jest.fn() };
    razorpay = { name: 'razorpay', verifyWebhookSignature: jest.fn() };
    redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue('completed'),
    };
    entitlement = {
      beginPastDue: jest.fn().mockResolvedValue(undefined),
      recover: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: DatabaseService, useValue: db },
        { provide: StripeProvider, useValue: stripe },
        { provide: RazorpayProvider, useValue: razorpay },
        {
          provide: MailService,
          useValue: {
            sendPaymentReceiptEmail: jest.fn().mockResolvedValue(undefined),
            sendPaymentFailedEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RedisService,
          useValue: { getClient: jest.fn(() => redisClient), get: jest.fn(), set: jest.fn() },
        },
        { provide: EntitlementService, useValue: entitlement },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  /** The single entitlement `updateMany` data payload, or null when none happened. */
  const writeSet = (): Record<string, unknown> | null => {
    const calls = db.organization.updateMany.mock.calls;
    if (calls.length === 0) return null;
    expect(calls).toHaveLength(1);
    return calls[0][0].data;
  };

  /** The `where` clause of the single entitlement write. */
  const whereClause = (): Record<string, unknown> => {
    const calls = db.organization.updateMany.mock.calls;
    expect(calls).toHaveLength(1);
    return calls[0][0].where;
  };

  const deliver = async (
    provider: 'stripe' | 'razorpay',
    event: { type: string; data: unknown; createdAt?: Date },
  ) => {
    (provider === 'stripe' ? stripe : razorpay).verifyWebhookSignature.mockReturnValue({
      id: `evt_${Math.random().toString(36).slice(2)}`,
      ...event,
    });
    return service.handleWebhookEvent(provider, rawEvent);
  };

  // ---------------------------------------------------------------------------
  // The behaviour matrix. Each row is one operator ruling.
  // ---------------------------------------------------------------------------
  type RoutingCase = {
    name: string;
    provider: 'stripe' | 'razorpay';
    orgId?: string;
    org?: Record<string, unknown>;
    event: { type: string; data: unknown; createdAt?: Date };
    expected: Record<string, unknown> | null;
  };

  const table: RoutingCase[] = [
    {
      name: 'known pro plan activated → tier pro persisted with quota and storage',
      provider: 'razorpay',
      event: {
        type: 'subscription.activated',
        data: rzpSubscription('plan_pro_m', 'active'),
        createdAt: NEWER,
      },
      expected: {
        subscriptionStatus: 'active',
        ...PRO_TIER_FIELDS,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
    {
      name: 'known lower plan charged → basic, not pro',
      provider: 'razorpay',
      org: { subscriptionTier: 'free', screenQuota: 5 },
      event: {
        type: 'subscription.charged',
        data: rzpSubscription('plan_basic_m', 'active'),
        createdAt: NEWER,
      },
      expected: {
        subscriptionStatus: 'active',
        ...BASIC_TIER_FIELDS,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
    {
      name: 'upgrade basic → pro is persisted',
      provider: 'razorpay',
      event: {
        type: 'subscription.updated',
        data: rzpSubscription('plan_pro_m', 'active'),
        createdAt: NEWER,
      },
      expected: {
        subscriptionStatus: 'active',
        ...PRO_TIER_FIELDS,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
    {
      name: 'DOWNGRADE pro → basic is persisted (E2: tier follows what Razorpay bills)',
      provider: 'razorpay',
      org: { subscriptionTier: 'pro', screenQuota: 100 },
      event: {
        type: 'subscription.updated',
        data: rzpSubscription('plan_basic_m', 'active'),
        createdAt: NEWER,
      },
      expected: {
        subscriptionStatus: 'active',
        ...BASIC_TIER_FIELDS,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
    {
      name: 'yearly plan id resolves to the same tier as monthly',
      provider: 'razorpay',
      event: {
        type: 'subscription.activated',
        data: rzpSubscription('plan_pro_y', 'active'),
        createdAt: NEWER,
      },
      expected: {
        subscriptionStatus: 'active',
        ...PRO_TIER_FIELDS,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
    {
      name: 'cancellation writes the FULL free-tier set including storage, and clears the id',
      provider: 'razorpay',
      org: { subscriptionTier: 'pro', screenQuota: 100 },
      event: {
        type: 'subscription.cancelled',
        data: rzpSubscription('plan_pro_m', 'cancelled'),
        createdAt: NEWER,
      },
      expected: {
        ...FREE_TIER_FIELDS,
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: null,
        razorpaySubscriptionId: null,
        billingEventAt: NEWER,
      },
    },
    // --- A-F1: PRE-PAYMENT statuses must never grant a tier -------------------
    {
      name: 'A-F1 Razorpay `created` (nothing paid) writes STATUS ONLY and preserves trialEndsAt',
      provider: 'razorpay',
      org: { subscriptionTier: 'free', screenQuota: 5 },
      event: {
        type: 'subscription.updated',
        data: rzpSubscription('plan_pro_m', 'created'),
        createdAt: NEWER,
      },
      // No tier, no quota, and critically NO `trialEndsAt: null` — clearing it
      // while writing tier 'pro' made SubscriptionActiveGuard deny every write.
      expected: { subscriptionStatus: 'trial', billingEventAt: NEWER },
    },
    {
      name: 'A-F1 Razorpay `authenticated` (mandate signed, not charged) writes STATUS ONLY',
      provider: 'razorpay',
      event: {
        type: 'subscription.authenticated',
        data: rzpSubscription('plan_pro_m', 'authenticated'),
        createdAt: NEWER,
      },
      expected: { subscriptionStatus: 'trial', billingEventAt: NEWER },
    },
    {
      name: 'A-F1 Stripe `trialing` writes STATUS ONLY and preserves trialEndsAt',
      provider: 'stripe',
      org: stripeOrg(),
      event: {
        type: 'customer.subscription.updated',
        data: stripeSubscription('price_pro_m', 'trialing'),
        createdAt: NEWER,
      },
      expected: { subscriptionStatus: 'trial', billingEventAt: NEWER },
    },
    // --- A-F2: TERMINAL statuses must never grant a tier ---------------------
    {
      name: 'A-F2 Stripe `incomplete_expired` (initial payment NEVER succeeded) → free, not Pro',
      provider: 'stripe',
      org: stripeOrg({ subscriptionTier: 'pro', screenQuota: 100 }),
      event: {
        type: 'customer.subscription.updated',
        data: stripeSubscription('price_pro_m', 'incomplete_expired'),
        createdAt: NEWER,
      },
      expected: { ...FREE_TIER_FIELDS, subscriptionStatus: 'canceled', billingEventAt: NEWER },
    },
    {
      name: 'A-F2 Stripe updated(canceled) after deleted does NOT re-grant the paid tier',
      provider: 'stripe',
      org: stripeOrg({ subscriptionTier: 'free', screenQuota: 5 }),
      event: {
        type: 'customer.subscription.updated',
        // Equal-second timestamp: the ordering guard admits it by design, so
        // the status allow-list is the only thing standing between the customer
        // and a re-granted Pro plan.
        data: stripeSubscription('price_pro_m', 'canceled'),
        createdAt: APPLIED_MARK,
      },
      expected: {
        ...FREE_TIER_FIELDS,
        subscriptionStatus: 'canceled',
        billingEventAt: APPLIED_MARK,
      },
    },
    {
      name: 'A-F6 Razorpay `completed` (total_count reached) collapses entitlement to free',
      provider: 'razorpay',
      org: { subscriptionTier: 'pro', screenQuota: 100 },
      event: {
        type: 'subscription.completed',
        data: rzpSubscription('plan_pro_m', 'completed'),
        createdAt: NEWER,
      },
      expected: { ...FREE_TIER_FIELDS, subscriptionStatus: 'canceled', billingEventAt: NEWER },
    },
    // --- unknown plan / unknown status ---------------------------------------
    {
      name: 'UNKNOWN plan id: status still written, tier/quota SKIPPED, never coerced to free',
      provider: 'razorpay',
      org: { subscriptionTier: 'pro', screenQuota: 100 },
      event: {
        type: 'subscription.activated',
        data: rzpSubscription('plan_from_another_account', 'active'),
        createdAt: NEWER,
      },
      // B-M3: the mark is NOT advanced, so the corrected event that arrives once
      // the env var is fixed is not rejected as stale.
      expected: { subscriptionStatus: 'active' },
    },
    {
      name: 'UNMAPPED status writes NOTHING — it cannot assert a live paid subscription',
      provider: 'razorpay',
      event: {
        type: 'subscription.updated',
        data: rzpSubscription('plan_pro_m', 'some_new_razorpay_status'),
        createdAt: NEWER,
      },
      expected: null,
    },
    {
      name: 'Stripe `paused` is unmapped → writes NOTHING (fail closed, not a guess)',
      provider: 'stripe',
      org: stripeOrg(),
      event: {
        type: 'customer.subscription.updated',
        data: stripeSubscription('price_pro_m', 'paused'),
        createdAt: NEWER,
      },
      expected: null,
    },
    // --- notes cross-check ----------------------------------------------------
    {
      name: 'notes serialized as [] does not break the tier write (Array.isArray guard)',
      provider: 'razorpay',
      event: {
        type: 'subscription.activated',
        data: rzpSubscription('plan_pro_m', 'active', { notes: [] }),
        createdAt: NEWER,
      },
      expected: {
        subscriptionStatus: 'active',
        ...PRO_TIER_FIELDS,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
    {
      name: 'notes disagreeing with plan_id do not change the tier (plan_id is authoritative)',
      provider: 'razorpay',
      event: {
        type: 'subscription.activated',
        data: rzpSubscription('plan_pro_m', 'active', { notes: { planId: 'basic' } }),
        createdAt: NEWER,
      },
      expected: {
        subscriptionStatus: 'active',
        ...PRO_TIER_FIELDS,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
    // --- ordering -------------------------------------------------------------
    {
      name: 'OUT-OF-ORDER older event writes nothing',
      provider: 'razorpay',
      org: { subscriptionTier: 'pro', screenQuota: 100 },
      event: {
        type: 'subscription.updated',
        data: rzpSubscription('plan_basic_m', 'active'),
        createdAt: OLDER,
      },
      expected: null,
    },
    {
      name: 'event emitted at EXACTLY the applied mark is still applied',
      provider: 'razorpay',
      event: {
        type: 'subscription.activated',
        data: rzpSubscription('plan_pro_m', 'active'),
        createdAt: APPLIED_MARK,
      },
      expected: {
        subscriptionStatus: 'active',
        ...PRO_TIER_FIELDS,
        trialEndsAt: null,
        billingEventAt: APPLIED_MARK,
      },
    },
    {
      name: 'no createdAt on the event → no ordering guard, write proceeds',
      provider: 'razorpay',
      event: { type: 'subscription.activated', data: rzpSubscription('plan_pro_m', 'active') },
      expected: { subscriptionStatus: 'active', ...PRO_TIER_FIELDS, trialEndsAt: null },
    },
    {
      name: 'B-M4 an implausible far-future timestamp is ignored, not stored as the mark',
      provider: 'razorpay',
      event: {
        type: 'subscription.activated',
        data: rzpSubscription('plan_pro_m', 'active'),
        // Seconds mistaken for milliseconds — year 56000. Storing this would
        // freeze every future entitlement write for the org.
        createdAt: new Date(1786000000 * 1000 * 1000),
      },
      expected: { subscriptionStatus: 'active', ...PRO_TIER_FIELDS, trialEndsAt: null },
    },
    // --- Stripe parity --------------------------------------------------------
    {
      name: 'STRIPE PARITY: portal plan change resolves tier from the price id',
      provider: 'stripe',
      org: stripeOrg({ subscriptionTier: 'basic' }),
      event: {
        type: 'customer.subscription.updated',
        data: stripeSubscription('price_pro_m', 'active'),
        createdAt: NEWER,
      },
      expected: {
        subscriptionStatus: 'active',
        ...PRO_TIER_FIELDS,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
    {
      name: 'STRIPE PARITY: unknown price id writes status only, never free',
      provider: 'stripe',
      org: stripeOrg({ subscriptionTier: 'pro', screenQuota: 100 }),
      event: {
        type: 'customer.subscription.updated',
        data: stripeSubscription('price_retired_2019', 'active'),
        createdAt: NEWER,
      },
      expected: { subscriptionStatus: 'active' },
    },
  ];

  it.each(table)('$name', async (testCase: RoutingCase) => {
    const { provider, org, event, expected } = testCase;
    const record = provider === 'stripe' ? (org ?? stripeOrg()) : razorpayOrg(org);
    db.organization.findFirst.mockResolvedValue(record);

    await deliver(provider, event);

    expect(writeSet()).toEqual(expected);
    if (expected !== null) {
      // C-F5: org scoping is part of the contract, not an implementation detail.
      expect(whereClause()).toMatchObject({ id: (record as { id: string }).id });
    }
  });

  // ---------------------------------------------------------------------------
  // Rows whose contract is more than a write set.
  // ---------------------------------------------------------------------------

  it('past_due goes through the ladder and leaves the tier alone (E3)', async () => {
    db.organization.findFirst.mockResolvedValue(razorpayOrg({ subscriptionTier: 'pro' }));

    await deliver('razorpay', {
      type: 'subscription.halted',
      data: rzpSubscription('plan_pro_m', 'halted'),
      createdAt: NEWER,
    });

    // The ladder owns entry into dunning — it stamps entitlementStateSince and
    // refuses to reset the clock. A direct status write would bypass both.
    expect(entitlement.beginPastDue).toHaveBeenCalledWith('org-rzp');
    // Rungs gate capability; tier records what was bought. The ONLY thing
    // written is the ordering mark (B-M2), so a stale `active` cannot undo this.
    expect(writeSet()).toEqual({ billingEventAt: NEWER });
  });

  it('A-F8 a lifecycle `active` does NOT clear a dunning episode', async () => {
    db.organization.findFirst.mockResolvedValue(
      razorpayOrg({ subscriptionStatus: 'suspended', subscriptionTier: 'pro' }),
    );

    await deliver('razorpay', {
      type: 'subscription.updated',
      data: rzpSubscription('plan_pro_m', 'active'),
      createdAt: NEWER,
    });

    // Stripe emits `active` for metadata edits, quantity changes and
    // payment-method attaches — none of which is proof the debt was paid.
    // Recovery belongs to the money path.
    expect(entitlement.recover).not.toHaveBeenCalled();
    expect(writeSet()).not.toHaveProperty('subscriptionStatus');
    // The tier still follows the plan: tier records what was bought.
    expect(writeSet()).toMatchObject(PRO_TIER_FIELDS);
  });

  it('B-H3 an event about a DIFFERENT subscription writes nothing', async () => {
    db.organization.findFirst.mockResolvedValue(
      razorpayOrg({ razorpaySubscriptionId: 'sub_live', subscriptionTier: 'pro' }),
    );

    // A cancellation of an abandoned/superseded subscription for the same
    // customer must not downgrade the org off the one that is billing them.
    await deliver('razorpay', {
      type: 'subscription.cancelled',
      data: rzpSubscription('plan_pro_m', 'cancelled'),
      createdAt: NEWER,
    });

    expect(writeSet()).toBeNull();
  });

  it('B-H3 the reconcile adopts an id only when the org holds none', async () => {
    db.organization.findFirst.mockResolvedValue(
      razorpayOrg({ razorpaySubscriptionId: 'sub_live' }),
    );

    await deliver('razorpay', {
      type: 'subscription.activated',
      data: rzpSubscription('plan_pro_m', 'active'),
      createdAt: NEWER,
    });

    // Overwriting a live id with whatever emitted an event is how a stale
    // subscription hijacks a paying org's record.
    expect(db.organization.update).not.toHaveBeenCalled();
  });

  it('B-M1 a losing compare-and-set is logged, not thrown', async () => {
    // Two cluster instances race; Postgres rejects this one because the row's
    // mark already moved past eventAt.
    db.organization.updateMany.mockResolvedValue({ count: 0 });
    db.organization.findFirst.mockResolvedValue(razorpayOrg());
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

    await expect(
      deliver('razorpay', {
        type: 'subscription.activated',
        data: rzpSubscription('plan_pro_m', 'active'),
        createdAt: NEWER,
      }),
    ).resolves.toEqual({ received: true });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('compare-and-set'));
    warnSpy.mockRestore();
  });

  it('B-M1 the ordering predicate is IN the where clause, not just a JS check', async () => {
    db.organization.findFirst.mockResolvedValue(razorpayOrg());

    await deliver('razorpay', {
      type: 'subscription.activated',
      data: rzpSubscription('plan_pro_m', 'active'),
      createdAt: NEWER,
    });

    // Without this predicate the guard is a read-then-write race across the two
    // PM2 cluster instances and the older event can land last.
    expect(whereClause()).toEqual({
      id: 'org-rzp',
      OR: [{ billingEventAt: null }, { billingEventAt: { lte: NEWER } }],
    });
  });

  it('duplicate delivery of the same event writes nothing (Redis claim)', async () => {
    db.organization.findFirst.mockResolvedValue(razorpayOrg());
    razorpay.verifyWebhookSignature.mockReturnValue({
      id: 'rzp_same',
      type: 'subscription.activated',
      data: rzpSubscription('plan_pro_m', 'active'),
      createdAt: NEWER,
    });

    await service.handleWebhookEvent('razorpay', rawEvent);
    expect(db.organization.updateMany).toHaveBeenCalledTimes(1);

    // Second delivery: the NX claim loses, and the marker reads 'completed'.
    redisClient.set.mockResolvedValueOnce(null);
    await service.handleWebhookEvent('razorpay', rawEvent);

    expect(db.organization.updateMany).toHaveBeenCalledTimes(1);
  });

  it('an unknown plan id is escalated, not silently absorbed', async () => {
    const errorSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);
    db.organization.findFirst.mockResolvedValue(razorpayOrg());

    await deliver('razorpay', {
      type: 'subscription.activated',
      data: rzpSubscription('plan_nobody_configured', 'active'),
      createdAt: NEWER,
    });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('plan_nobody_configured'));
    // B-M3: the remedy must not tell the operator to replay — the dedup key is
    // a content hash and the original delivery is already marked completed.
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('RE-TRIGGER'));
    errorSpy.mockRestore();
  });

  it('reconciles a razorpaySubscriptionId that never reached the database', async () => {
    db.organization.findFirst.mockResolvedValue(razorpayOrg({ razorpaySubscriptionId: null }));

    await deliver('razorpay', {
      type: 'subscription.activated',
      data: rzpSubscription('plan_pro_m', 'active'),
      createdAt: NEWER,
    });

    expect(db.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-rzp' },
      data: { razorpaySubscriptionId: 'sub_rzp' },
    });
  });

  describe('money events', () => {
    it('payment.captured resolves the org from payment.customer_id and records the row', async () => {
      db.organization.findFirst.mockResolvedValue(
        razorpayOrg({ subscriptionStatus: 'past_due' }),
      );

      await deliver('razorpay', {
        type: 'payment.captured',
        // The REAL shape: contains:["payment"], no invoice entity anywhere.
        data: {
          payment: {
            id: 'pay_1',
            customer_id: 'cust_rzp',
            amount: 59900,
            currency: 'INR',
            invoice_id: 'inv_1',
          },
        },
        createdAt: NEWER,
      });

      expect(db.billingTransaction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            organizationId: 'org-rzp',
            provider: 'razorpay',
            amount: 59900,
            currency: 'INR',
            status: 'succeeded',
          }),
        }),
      );
      // The money path is the ONLY recovery site (A-F8).
      expect(entitlement.recover).toHaveBeenCalledWith('org-rzp');
      // B-M2: recovery advances the mark so a stale failure cannot reorder past it.
      expect(writeSet()).toEqual({ billingEventAt: NEWER });
    });

    it('B-H1 a retry after a partial apply completes and still recovers', async () => {
      // First delivery inserts the audit row, then dies before recover().
      db.organization.findFirst.mockResolvedValue(
        razorpayOrg({ subscriptionStatus: 'suspended' }),
      );
      entitlement.recover.mockRejectedValueOnce(new Error('transient DB blip'));

      const money = {
        type: 'payment.captured',
        data: {
          payment: { id: 'pay_r', customer_id: 'cust_rzp', amount: 59900, currency: 'INR' },
        },
        createdAt: NEWER,
      };

      await expect(deliver('razorpay', money)).rejects.toThrow('transient DB blip');
      expect(db.billingTransaction.upsert).toHaveBeenCalledTimes(1);

      // The PSP retries. With a bare `create` this would now die on P2002 BEFORE
      // reaching recover(), and a paying suspended org would stay suspended
      // forever. The upsert makes re-observing the row a no-op.
      await deliver('razorpay', money);

      expect(db.billingTransaction.upsert).toHaveBeenCalledTimes(2);
      expect(entitlement.recover).toHaveBeenCalledWith('org-rzp');
    });

    it('the audit row is an UPSERT keyed on the provider transaction id', async () => {
      db.organization.findFirst.mockResolvedValue(razorpayOrg());

      await deliver('razorpay', {
        type: 'payment.captured',
        data: { payment: { id: 'pay_u', customer_id: 'cust_rzp', amount: 1, currency: 'INR' } },
        createdAt: NEWER,
      });

      const call = db.billingTransaction.upsert.mock.calls[0][0];
      expect(call.where).toHaveProperty('provider_providerTransactionId');
      // Append-only audit: re-observing an existing row must change nothing.
      expect(call.update).toEqual({});
    });

    it('payment.captured with the customer_id key ABSENT records nothing and escalates', async () => {
      const errorSpy = jest
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => undefined);

      await deliver('razorpay', {
        type: 'payment.captured',
        data: { payment: { id: 'pay_2', amount: 100, currency: 'INR' } },
        createdAt: NEWER,
      });

      expect(db.billingTransaction.upsert).not.toHaveBeenCalled();
      expect(db.organization.findFirst).not.toHaveBeenCalled();
      // B-L2: a dropped money event is an error + Sentry, not a warn.
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no resolvable customer id'));
      errorSpy.mockRestore();
    });

    it('payment.failed opens dunning through the ladder and advances the mark', async () => {
      db.organization.findFirst.mockResolvedValue(razorpayOrg());

      await deliver('razorpay', {
        type: 'payment.failed',
        data: { payment: { id: 'pay_3', customer_id: 'cust_rzp', amount: 59900 } },
        createdAt: NEWER,
      });

      expect(entitlement.beginPastDue).toHaveBeenCalledWith('org-rzp');
      expect(writeSet()).toEqual({ billingEventAt: NEWER });
    });

    it('an out-of-order money event still records the audit row but skips the ladder write', async () => {
      db.organization.findFirst.mockResolvedValue(razorpayOrg({ subscriptionStatus: 'suspended' }));

      await deliver('razorpay', {
        type: 'payment.captured',
        data: { payment: { id: 'pay_4', customer_id: 'cust_rzp', amount: 100, currency: 'INR' } },
        createdAt: OLDER,
      });

      // billing_transactions is append-only audit — ordering never suppresses it.
      expect(db.billingTransaction.upsert).toHaveBeenCalled();
      expect(entitlement.recover).not.toHaveBeenCalled();
    });

    it('B-M2 a stale `active` cannot undo a newer past_due', async () => {
      // The org just entered dunning at NEWER (payment.failed stamped the mark).
      db.organization.findFirst.mockResolvedValue(
        razorpayOrg({ subscriptionStatus: 'past_due', billingEventAt: NEWER }),
      );

      // An OLDER lifecycle event reporting `active` arrives late.
      await deliver('razorpay', {
        type: 'subscription.updated',
        data: rzpSubscription('plan_pro_m', 'active'),
        createdAt: OLDER,
      });

      expect(writeSet()).toBeNull();
    });
  });

  describe('B2 entitlement allow-path', () => {
    it('a pro activation flips hasApiAccess from false to true', async () => {
      // Before: the Razorpay customer sits on the tier registration gave them.
      const before = razorpayOrg({ subscriptionTier: 'free' });
      expect(hasApiAccess(before.subscriptionTier, before.subscriptionStatus)).toBe(false);

      db.organization.findFirst.mockResolvedValue(before);
      await deliver('razorpay', {
        type: 'subscription.activated',
        data: rzpSubscription('plan_pro_m', 'active'),
        createdAt: NEWER,
      });

      const written = writeSet() as { subscriptionTier: string; subscriptionStatus: string };
      // C-F6: both halves of the predicate must be load-bearing, so pin each.
      expect(written.subscriptionTier).toBe('pro');
      expect(written.subscriptionStatus).toBe('active');
      // This is the B2 allow branch that was unreachable for Razorpay customers.
      expect(hasApiAccess(written.subscriptionTier, written.subscriptionStatus)).toBe(true);
    });
  });
});
