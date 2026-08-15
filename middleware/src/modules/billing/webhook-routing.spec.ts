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
 * Asserts, for each (event type × payload), the exact `organization.update`
 * WRITE SET the billing service produces — or that it writes nothing at all.
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
    // Matches the id in the fixtures so the P1 reconcile write does not fire
    // and muddy the assertions; reconcile has its own test below.
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
      },
      billingTransaction: { create: jest.fn().mockResolvedValue({ id: 'txn' }) },
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

  /** The single `organization.update` data payload, or null when none happened. */
  const writeSet = (): Record<string, unknown> | null => {
    const calls = db.organization.update.mock.calls;
    if (calls.length === 0) return null;
    expect(calls).toHaveLength(1);
    return calls[0][0].data;
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
  const table: Array<{
    name: string;
    provider: 'stripe' | 'razorpay';
    org?: Record<string, unknown>;
    event: { type: string; data: unknown; createdAt?: Date };
    expected: Record<string, unknown> | null;
  }> = [
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
        subscriptionTier: 'pro',
        screenQuota: 100,
        storageQuotaBytes: PRO_STORAGE_BYTES,
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
        subscriptionTier: 'basic',
        screenQuota: 50,
        storageQuotaBytes: BASIC_STORAGE_BYTES,
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
        subscriptionTier: 'pro',
        screenQuota: 100,
        storageQuotaBytes: PRO_STORAGE_BYTES,
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
        subscriptionTier: 'basic',
        screenQuota: 50,
        storageQuotaBytes: BASIC_STORAGE_BYTES,
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
        subscriptionTier: 'pro',
        screenQuota: 100,
        storageQuotaBytes: PRO_STORAGE_BYTES,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
    {
      name: 'cancellation keeps existing semantics: free tier, canceled, id cleared',
      provider: 'razorpay',
      org: { subscriptionTier: 'pro', screenQuota: 100 },
      event: {
        type: 'subscription.cancelled',
        data: rzpSubscription('plan_pro_m', 'cancelled'),
        createdAt: NEWER,
      },
      expected: {
        subscriptionTier: 'free',
        subscriptionStatus: 'canceled',
        screenQuota: 5,
        stripeSubscriptionId: null,
        razorpaySubscriptionId: null,
        billingEventAt: NEWER,
      },
    },
    {
      name: 'UNKNOWN plan id: status still written, tier/quota SKIPPED, never coerced to free',
      provider: 'razorpay',
      org: { subscriptionTier: 'pro', screenQuota: 100 },
      event: {
        type: 'subscription.activated',
        data: rzpSubscription('plan_from_another_account', 'active'),
        createdAt: NEWER,
      },
      expected: { subscriptionStatus: 'active', billingEventAt: NEWER },
    },
    {
      name: 'UNMAPPED status: tier still written, status write skipped only',
      provider: 'razorpay',
      event: {
        type: 'subscription.updated',
        data: rzpSubscription('plan_pro_m', 'some_new_razorpay_status'),
        createdAt: NEWER,
      },
      expected: {
        subscriptionTier: 'pro',
        screenQuota: 100,
        storageQuotaBytes: PRO_STORAGE_BYTES,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
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
        subscriptionTier: 'pro',
        screenQuota: 100,
        storageQuotaBytes: PRO_STORAGE_BYTES,
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
        subscriptionTier: 'pro',
        screenQuota: 100,
        storageQuotaBytes: PRO_STORAGE_BYTES,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
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
        subscriptionTier: 'pro',
        screenQuota: 100,
        storageQuotaBytes: PRO_STORAGE_BYTES,
        trialEndsAt: null,
        billingEventAt: APPLIED_MARK,
      },
    },
    {
      name: 'no createdAt on the event → no ordering guard, write proceeds',
      provider: 'razorpay',
      event: { type: 'subscription.activated', data: rzpSubscription('plan_pro_m', 'active') },
      expected: {
        subscriptionStatus: 'active',
        subscriptionTier: 'pro',
        screenQuota: 100,
        storageQuotaBytes: PRO_STORAGE_BYTES,
        trialEndsAt: null,
      },
    },
    {
      name: 'STRIPE PARITY: portal plan change resolves tier from the price id',
      provider: 'stripe',
      org: { ...stripeOrg(), subscriptionTier: 'basic' },
      event: {
        type: 'customer.subscription.updated',
        data: {
          customer: 'cus_stripe',
          status: 'active',
          items: { data: [{ price: { id: 'price_pro_m' } }] },
        },
        createdAt: NEWER,
      },
      expected: {
        subscriptionStatus: 'active',
        subscriptionTier: 'pro',
        screenQuota: 100,
        storageQuotaBytes: PRO_STORAGE_BYTES,
        trialEndsAt: null,
        billingEventAt: NEWER,
      },
    },
    {
      name: 'STRIPE PARITY: unknown price id writes status only, never free',
      provider: 'stripe',
      org: { ...stripeOrg(), subscriptionTier: 'pro', screenQuota: 100 },
      event: {
        type: 'customer.subscription.updated',
        data: {
          customer: 'cus_stripe',
          status: 'active',
          items: { data: [{ price: { id: 'price_retired_2019' } }] },
        },
        createdAt: NEWER,
      },
      expected: { subscriptionStatus: 'active', billingEventAt: NEWER },
    },
  ];

  it.each(table)('$name', async ({ provider, org, event, expected }) => {
    const record = provider === 'stripe' ? stripeOrg(org) : razorpayOrg(org);
    db.organization.findFirst.mockResolvedValue(record);

    await deliver(provider, event);

    expect(writeSet()).toEqual(expected);
  });

  // ---------------------------------------------------------------------------
  // Rows whose contract is more than a write set.
  // ---------------------------------------------------------------------------

  it('past_due goes through the ladder and leaves the tier alone (E3)', async () => {
    db.organization.findFirst.mockResolvedValue(razorpayOrg({ subscriptionTier: 'pro' }));

    await deliver('razorpay', {
      type: 'subscription.updated',
      data: rzpSubscription('plan_pro_m', 'halted'),
      createdAt: NEWER,
    });

    // The ladder owns entry into dunning — it stamps entitlementStateSince and
    // refuses to reset the clock. A direct status write would bypass both.
    expect(entitlement.beginPastDue).toHaveBeenCalledWith('org-rzp');
    // Rungs gate capability; tier records what was bought. Nothing is written.
    expect(writeSet()).toBeNull();
  });

  it('recovery from a dunning rung goes through the ladder, not a direct write', async () => {
    db.organization.findFirst.mockResolvedValue(
      razorpayOrg({ subscriptionStatus: 'suspended', subscriptionTier: 'pro' }),
    );

    await deliver('razorpay', {
      type: 'subscription.charged',
      data: rzpSubscription('plan_pro_m', 'active'),
      createdAt: NEWER,
    });

    // recover() clears the episode clock and emits tenant:resumed; a direct
    // 'active' write would leave suspended screens on the holding screen.
    expect(entitlement.recover).toHaveBeenCalledWith('org-rzp');
    expect(writeSet()).not.toHaveProperty('subscriptionStatus');
    expect(writeSet()).toMatchObject({ subscriptionTier: 'pro' });
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
    expect(db.organization.update).toHaveBeenCalledTimes(1);

    // Second delivery: the NX claim loses, and the marker reads 'completed'.
    redisClient.set.mockResolvedValueOnce(null);
    await service.handleWebhookEvent('razorpay', rawEvent);

    expect(db.organization.update).toHaveBeenCalledTimes(1);
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

      expect(db.billingTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-rzp',
          provider: 'razorpay',
          amount: 59900,
          currency: 'INR',
          status: 'succeeded',
        }),
      });
      expect(entitlement.recover).toHaveBeenCalledWith('org-rzp');
    });

    it('payment.captured with the customer_id key ABSENT records nothing and warns', async () => {
      const warnSpy = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);

      await deliver('razorpay', {
        type: 'payment.captured',
        data: { payment: { id: 'pay_2', amount: 100, currency: 'INR' } },
        createdAt: NEWER,
      });

      expect(db.billingTransaction.create).not.toHaveBeenCalled();
      expect(db.organization.findFirst).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no resolvable customer id'));
      warnSpy.mockRestore();
    });

    it('payment.failed opens dunning through the ladder', async () => {
      db.organization.findFirst.mockResolvedValue(razorpayOrg());

      await deliver('razorpay', {
        type: 'payment.failed',
        data: { payment: { id: 'pay_3', customer_id: 'cust_rzp', amount: 59900 } },
        createdAt: NEWER,
      });

      expect(entitlement.beginPastDue).toHaveBeenCalledWith('org-rzp');
    });

    it('an out-of-order money event still records the audit row but skips the ladder write', async () => {
      db.organization.findFirst.mockResolvedValue(razorpayOrg({ subscriptionStatus: 'suspended' }));

      await deliver('razorpay', {
        type: 'payment.captured',
        data: { payment: { id: 'pay_4', customer_id: 'cust_rzp', amount: 100, currency: 'INR' } },
        createdAt: OLDER,
      });

      // billing_transactions is append-only audit — ordering never suppresses it.
      expect(db.billingTransaction.create).toHaveBeenCalled();
      expect(entitlement.recover).not.toHaveBeenCalled();
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
      // This is the B2 allow branch that was unreachable for Razorpay customers.
      expect(hasApiAccess(written.subscriptionTier, written.subscriptionStatus)).toBe(true);
    });
  });
});
