import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { DatabaseService } from '../database/database.service';
import { StripeProvider } from './providers/stripe.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { EntitlementService } from './entitlement.service';
import { PLAN_TIERS } from './constants/plans';

// Set up environment variables before tests run
beforeAll(() => {
  process.env.STRIPE_BASIC_MONTHLY_PRICE_ID = 'price_basic_monthly';
  process.env.STRIPE_BASIC_YEARLY_PRICE_ID = 'price_basic_yearly';
  process.env.STRIPE_PRO_MONTHLY_PRICE_ID = 'price_pro_monthly';
  process.env.STRIPE_PRO_YEARLY_PRICE_ID = 'price_pro_yearly';
  process.env.RAZORPAY_BASIC_PLAN_ID = 'plan_basic_inr';
  process.env.RAZORPAY_PRO_PLAN_ID = 'plan_pro_inr';
});

describe('BillingService', () => {
  let service: BillingService;
  let mockDatabaseService: any;
  let mockStripeProvider: any;
  let mockRazorpayProvider: any;
  let mockRedisService: any;
  let mockRedisClient: any;
  const mockEntitlementService = {
    beginPastDue: jest.fn().mockResolvedValue(undefined),
    recover: jest.fn().mockResolvedValue(undefined),
  };

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
    subscriptionTier: 'basic',
    subscriptionStatus: 'active',
    screenQuota: 25,
    stripeCustomerId: 'cus_stripe123',
    stripeSubscriptionId: 'sub_stripe123',
    razorpayCustomerId: null,
    razorpaySubscriptionId: null,
    paymentProvider: 'stripe',
    country: 'US',
    billingEmail: 'billing@test.com',
    trialEndsAt: null,
    _count: {
      displays: 10,
    },
    users: [
      {
        id: 'user-123',
        email: 'admin@test.com',
        role: 'admin',
      },
    ],
  };

  const mockSubscription = {
    id: 'sub_stripe123',
    customerId: 'cus_stripe123',
    status: 'active',
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    cancelAtPeriodEnd: false,
    priceId: 'price_basic',
    interval: 'monthly' as const,
  };

  const mockInvoices = [
    {
      id: 'inv_123',
      customerId: 'cus_stripe123',
      subscriptionId: 'sub_stripe123',
      amount: 2900,
      currency: 'usd',
      status: 'paid',
      description: 'Basic Plan - Monthly',
      pdfUrl: 'https://stripe.com/invoices/inv_123/pdf',
      createdAt: new Date('2024-01-01'),
    },
  ];

  beforeEach(async () => {
    mockDatabaseService = {
      organization: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        // Every entitlement write is a conditional updateMany (compare-and-set
        // on billingEventAt) — see BillingService.writeEntitlement.
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      billingTransaction: {
        // UPSERT, not create: the audit row must survive a retry after a
        // partial apply without poisoning it with P2002 (B-H1).
        upsert: jest.fn(),
      },
      // updateSubscription wraps its local write in $transaction — run the
      // callback against the same mock so tx.organization.update is captured.
      $transaction: jest.fn(async (cb: any) => cb(mockDatabaseService)),
    };

    mockStripeProvider = {
      name: 'stripe',
      createCustomer: jest.fn(),
      getCustomer: jest.fn(),
      createCheckoutSession: jest.fn(),
      getSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      createBillingPortalSession: jest.fn(),
      getInvoices: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };

    mockRazorpayProvider = {
      name: 'razorpay',
      createCustomer: jest.fn(),
      getCustomer: jest.fn(),
      createCheckoutSession: jest.fn(),
      getSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      getInvoices: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };

    const mockMailService = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
      sendTrialReminderEmail: jest.fn().mockResolvedValue(undefined),
      sendTrialExpiredEmail: jest.fn().mockResolvedValue(undefined),
      sendPaymentReceiptEmail: jest.fn().mockResolvedValue(undefined),
      sendPaymentFailedEmail: jest.fn().mockResolvedValue(undefined),
      sendPlanChangedEmail: jest.fn().mockResolvedValue(undefined),
      sendSubscriptionCanceledEmail: jest.fn().mockResolvedValue(undefined),
    };

    // getClient().set(key,'1','EX',ttl,'NX') — 'OK' = claim won (first time),
    // null = already processed (duplicate). Default: always win the claim.
    // get() reads the idempotency marker on the duplicate branch: 'completed'
    // = truly processed (ack 200), 'pending' = crashed/in-flight (retry → 503).
    mockRedisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue('completed'),
    };
    mockRedisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      getClient: jest.fn(() => mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: StripeProvider, useValue: mockStripeProvider },
        { provide: RazorpayProvider, useValue: mockRazorpayProvider },
        { provide: MailService, useValue: mockMailService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: EntitlementService, useValue: mockEntitlementService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit (price-ID startup validation)', () => {
    // Razorpay is interval-dimensioned since B3-E1. The legacy single-dimension
    // names stay in this list so beforeEach clears the ones set in beforeAll.
    const KEYS = [
      'STRIPE_BASIC_MONTHLY_PRICE_ID',
      'STRIPE_BASIC_YEARLY_PRICE_ID',
      'RAZORPAY_BASIC_MONTHLY_PLAN_ID',
      'RAZORPAY_BASIC_YEARLY_PLAN_ID',
      'RAZORPAY_BASIC_PLAN_ID',
      'STRIPE_PRO_MONTHLY_PRICE_ID',
      'STRIPE_PRO_YEARLY_PRICE_ID',
      'RAZORPAY_PRO_MONTHLY_PLAN_ID',
      'RAZORPAY_PRO_YEARLY_PLAN_ID',
      'RAZORPAY_PRO_PLAN_ID',
      'STRIPE_ENTERPRISE_MONTHLY_PRICE_ID',
      'STRIPE_ENTERPRISE_YEARLY_PRICE_ID',
      'RAZORPAY_ENTERPRISE_MONTHLY_PLAN_ID',
      'RAZORPAY_ENTERPRISE_YEARLY_PLAN_ID',
      'RAZORPAY_ENTERPRISE_PLAN_ID',
    ];
    let savedEnv: Record<string, string | undefined>;
    let savedStrict: string | undefined;

    beforeEach(() => {
      savedEnv = {};
      KEYS.forEach((k) => {
        savedEnv[k] = process.env[k];
        delete process.env[k];
      });
      savedStrict = process.env.BILLING_VALIDATION_STRICT;
      delete process.env.BILLING_VALIDATION_STRICT;
    });

    afterEach(() => {
      KEYS.forEach((k) => {
        if (savedEnv[k] === undefined) delete process.env[k];
        else process.env[k] = savedEnv[k];
      });
      if (savedStrict === undefined) delete process.env.BILLING_VALIDATION_STRICT;
      else process.env.BILLING_VALIDATION_STRICT = savedStrict;
    });

    it('throws when STRICT mode is on and a paid-tier env var is missing', () => {
      process.env.BILLING_VALIDATION_STRICT = 'true';
      expect(() => service.onModuleInit()).toThrow(/Missing billing price/);
    });

    it('does NOT throw when STRICT is unset (default warn-only behavior)', () => {
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('does NOT throw when STRICT mode is on AND all paid-tier env vars are set', () => {
      process.env.BILLING_VALIDATION_STRICT = 'true';
      KEYS.forEach((k) => {
        process.env[k] = `${k}_VALUE`;
      });
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('does not require env vars for the free tier', () => {
      process.env.BILLING_VALIDATION_STRICT = 'true';
      KEYS.forEach((k) => {
        process.env[k] = `${k}_VALUE`;
      });
      // Free tier env vars NOT set, but validation should pass — free has no price.
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('accepts the legacy RAZORPAY_<TIER>_PLAN_ID as the monthly alias', () => {
      process.env.BILLING_VALIDATION_STRICT = 'true';
      KEYS.filter((k) => !k.startsWith('RAZORPAY_')).forEach((k) => {
        process.env[k] = `${k}_VALUE`;
      });
      // Only the legacy names + the yearly names — no interval-scoped monthly.
      process.env.RAZORPAY_BASIC_PLAN_ID = 'plan_basic_legacy';
      process.env.RAZORPAY_BASIC_YEARLY_PLAN_ID = 'plan_basic_yearly';
      process.env.RAZORPAY_PRO_PLAN_ID = 'plan_pro_legacy';
      process.env.RAZORPAY_PRO_YEARLY_PLAN_ID = 'plan_pro_yearly';
      process.env.RAZORPAY_ENTERPRISE_PLAN_ID = 'plan_ent_legacy';
      process.env.RAZORPAY_ENTERPRISE_YEARLY_PLAN_ID = 'plan_ent_yearly';

      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('reports an ambiguous plan id LOUDLY but still boots (C-F2)', () => {
      // Ambiguous config is a real misconfiguration, but throwing takes the
      // whole middleware down — displays, content, auth — in both cluster
      // instances, over a billing typo, on a deployment where billing may be
      // dormant. That is the #101 boot-validator lesson.
      //
      // Degrading is safe because the ambiguous id is REMOVED from the reverse
      // index, so it resolves to null and every webhook carrying it takes the
      // skip-the-tier-write-and-escalate path. Nobody gets a guessed tier.
      process.env.RAZORPAY_BASIC_MONTHLY_PLAN_ID = 'plan_shared';
      process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID = 'plan_shared';
      const errorSpy = jest
        .spyOn((service as unknown as { logger: { error: jest.Mock } }).logger, 'error')
        .mockImplementation(() => undefined);

      expect(() => service.onModuleInit()).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Ambiguous billing plan id'));
      errorSpy.mockRestore();
    });

    it('a MISSING id still fails boot under STRICT (that check is unchanged)', () => {
      process.env.BILLING_VALIDATION_STRICT = 'true';
      expect(() => service.onModuleInit()).toThrow(/Missing billing price/);
    });

    it('does not treat the legacy alias holding the same value as its monthly var as a conflict', () => {
      process.env.RAZORPAY_PRO_PLAN_ID = 'plan_pro_inr';
      process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID = 'plan_pro_inr';

      expect(() => service.onModuleInit()).not.toThrow(/Ambiguous billing plan id/);
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should return subscription status for an organization', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockStripeProvider.getSubscription.mockResolvedValue(mockSubscription);

      const result = await service.getSubscriptionStatus('org-123');

      expect(result).toBeDefined();
      expect(result.subscriptionTier).toBe('basic');
      expect(result.subscriptionStatus).toBe('active');
      expect(result.screenQuota).toBe(25);
      expect(result.screensUsed).toBe(10);
      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(result.paymentProvider).toBe('stripe');
      expect(result.currentPeriodEnd).toBe(mockSubscription.currentPeriodEnd.toISOString());
    });

    it('should throw NotFoundException for non-existent organization', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.getSubscriptionStatus('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return null currentPeriodEnd if no subscription', async () => {
      const orgWithoutSub = {
        ...mockOrganization,
        stripeSubscriptionId: null,
        paymentProvider: null,
      };
      mockDatabaseService.organization.findUnique.mockResolvedValue(orgWithoutSub);

      const result = await service.getSubscriptionStatus('org-123');

      expect(result.currentPeriodEnd).toBeNull();
      expect(result.cancelAtPeriodEnd).toBe(false);
    });

    it('should degrade to a null currentPeriodEnd when the provider read throws', async () => {
      // The provider throws out of `ensureConfigured()` before its own error
      // handling. Failing the endpoint blanks the billing page, which then
      // renders the org's plan from no data at all — return the DB tier instead.
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockStripeProvider.getSubscription.mockRejectedValue(
        new ServiceUnavailableException('Stripe is not configured'),
      );
      const warn = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

      const result = await service.getSubscriptionStatus('org-123');

      expect(result.subscriptionTier).toBe('basic');
      expect(result.subscriptionStatus).toBe('active');
      expect(result.currentPeriodEnd).toBeNull();
      // The period fields are UNKNOWN, not false — say so, so no client offers
      // "Cancel" to a customer who has already cancelled at the provider.
      expect(result.degraded).toBe(true);

      // §12b — a degraded read must not be silent.
      expect(warn).toHaveBeenCalledTimes(1);
      const message = warn.mock.calls[0][0] as string;
      expect(message).toContain('org-123');
      expect(message).toContain('stripe');
      warn.mockRestore();
    });

    it('should not mark a healthy read as degraded', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockStripeProvider.getSubscription.mockResolvedValue(mockSubscription);

      const result = await service.getSubscriptionStatus('org-123');

      expect(result.degraded).toBeUndefined();
    });
  });

  describe('getPlans', () => {
    it('should return plans with USD pricing for US organization', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue({
        subscriptionTier: 'free',
        country: 'US',
      });

      const result = await service.getPlans('org-123', 'US', 'monthly');

      expect(result).toBeDefined();
      expect(result.length).toBe(Object.keys(PLAN_TIERS).length);

      const basicPlan = result.find((p) => p.id === 'basic');
      expect(basicPlan).toBeDefined();
      expect(basicPlan?.price).toBe(600);
      expect(basicPlan?.currency).toBe('usd');
      expect(basicPlan?.isCurrent).toBe(false);

      const freePlan = result.find((p) => p.id === 'free');
      expect(freePlan?.isCurrent).toBe(true);
    });

    it('should return plans with INR pricing for Indian organization', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue({
        subscriptionTier: 'free',
        country: 'IN',
      });

      const result = await service.getPlans('org-123', 'IN', 'monthly');

      const basicPlan = result.find((p) => p.id === 'basic');
      expect(basicPlan?.price).toBe(39900);
      expect(basicPlan?.currency).toBe('inr');
    });

    it('should return yearly pricing when interval is yearly', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue({
        subscriptionTier: 'free',
        country: 'US',
      });

      const result = await service.getPlans('org-123', 'US', 'yearly');

      const basicPlan = result.find((p) => p.id === 'basic');
      expect(basicPlan?.price).toBe(6000);
      expect(basicPlan?.interval).toBe('yearly');
    });

    it('should mark current plan correctly', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue({
        subscriptionTier: 'pro',
        country: 'US',
      });

      const result = await service.getPlans('org-123', 'US', 'monthly');

      const proPlan = result.find((p) => p.id === 'pro');
      expect(proPlan?.isCurrent).toBe(true);

      const basicPlan = result.find((p) => p.id === 'basic');
      expect(basicPlan?.isCurrent).toBe(false);
    });

    it('should throw NotFoundException for non-existent organization', async () => {
      // Never fabricate a tier for an org we could not read — the old
      // `org?.subscriptionTier || 'free'` marked Free as the current plan.
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.getPlans('non-existent', 'US', 'monthly')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getQuotaUsage', () => {
    it('should calculate quota usage correctly', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);

      const result = await service.getQuotaUsage('org-123');

      expect(result.screenQuota).toBe(25);
      expect(result.screensUsed).toBe(10);
      expect(result.remaining).toBe(15);
      expect(result.percentUsed).toBe(40);
    });

    it('should handle unlimited quota', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue({
        ...mockOrganization,
        screenQuota: -1,
        _count: { displays: 100 },
      });

      const result = await service.getQuotaUsage('org-123');

      expect(result.screenQuota).toBe(-1);
      expect(result.remaining).toBe(-1);
      expect(result.percentUsed).toBe(0);
    });

    it('should throw NotFoundException for non-existent organization', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.getQuotaUsage('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCheckoutSession', () => {
    const checkoutDto = {
      planId: 'basic',
      interval: 'monthly' as const,
    };

    /** An India-country org, so getDefaultProviderForCountry picks Razorpay. */
    const razorpayCheckoutOrg = (overrides: Record<string, unknown> = {}) => ({
      ...mockOrganization,
      country: 'IN',
      paymentProvider: 'razorpay',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      razorpayCustomerId: 'cust_razorpay123',
      razorpaySubscriptionId: null,
      ...overrides,
    });

    it('B3-P1 persists the Razorpay subscription id returned by checkout', async () => {
      // Without this write razorpaySubscriptionId stays null forever and both
      // updateSubscription and cancelSubscription 400 with "No active
      // subscription found" for every paying Razorpay customer. Deleting the
      // six lines that do it used to leave the whole suite green (C-F3).
      mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayCheckoutOrg());
      mockRazorpayProvider.createCheckoutSession.mockResolvedValue({
        url: 'https://rzp.io/i/abc',
        sessionId: 'sub_rzp_new',
      });
      mockDatabaseService.organization.update.mockResolvedValue({});

      await service.createCheckoutSession('org-123', { planId: 'pro', interval: 'monthly' });

      expect(mockDatabaseService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: { razorpaySubscriptionId: 'sub_rzp_new' },
      });
    });

    it('B3-E1 a YEARLY selection reaches the provider as the YEARLY plan id', async () => {
      // The headline bug: the Razorpay arm dropped dto.interval, so picking
      // yearly subscribed the customer to the monthly plan and billed monthly.
      process.env.RAZORPAY_PRO_YEARLY_PLAN_ID = 'plan_pro_inr_yearly';
      try {
        mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayCheckoutOrg());
        mockRazorpayProvider.createCheckoutSession.mockResolvedValue({
          url: 'https://rzp.io/i/abc',
          sessionId: 'sub_rzp_y',
        });
        mockDatabaseService.organization.update.mockResolvedValue({});

        await service.createCheckoutSession('org-123', { planId: 'pro', interval: 'yearly' });

        expect(mockRazorpayProvider.createCheckoutSession).toHaveBeenCalledWith(
          expect.objectContaining({ priceId: 'plan_pro_inr_yearly' }),
        );
      } finally {
        delete process.env.RAZORPAY_PRO_YEARLY_PLAN_ID;
      }
    });

    it('B3-E1 refuses a yearly checkout when no yearly plan id is configured', async () => {
      // There is deliberately NO legacy fallback for yearly: silently billing a
      // yearly customer at the monthly cadence is worse than refusing.
      delete process.env.RAZORPAY_PRO_YEARLY_PLAN_ID;
      mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayCheckoutOrg());

      await expect(
        service.createCheckoutSession('org-123', { planId: 'pro', interval: 'yearly' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockRazorpayProvider.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('B-H2 refuses a second checkout while a Razorpay subscription is ACTIVE', async () => {
      // P1 overwrote razorpaySubscriptionId unconditionally, so a double-click
      // or a second purchase attempt replaced the id of the subscription that is
      // actually charging the customer. Cancel would then close the unpaid shell
      // and report success while the real one kept billing.
      mockDatabaseService.organization.findUnique.mockResolvedValue(
        razorpayCheckoutOrg({ razorpaySubscriptionId: 'sub_live' }),
      );
      mockRazorpayProvider.getSubscription.mockResolvedValue({
        id: 'sub_live',
        status: 'active',
      });

      await expect(
        service.createCheckoutSession('org-123', { planId: 'pro', interval: 'monthly' }),
      ).rejects.toThrow(/already has a subscription with this payment provider/);
      expect(mockRazorpayProvider.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('B-H2 ALLOWS a retry when the stored subscription is an unpaid shell', async () => {
      // `created`/`authenticated` is an abandoned or double-clicked checkout —
      // nobody is being charged, so retrying must stay possible.
      mockDatabaseService.organization.findUnique.mockResolvedValue(
        razorpayCheckoutOrg({ razorpaySubscriptionId: 'sub_abandoned' }),
      );
      mockRazorpayProvider.getSubscription.mockResolvedValue({
        id: 'sub_abandoned',
        status: 'incomplete',
      });
      mockRazorpayProvider.createCheckoutSession.mockResolvedValue({
        url: 'https://rzp.io/i/abc',
        sessionId: 'sub_retry',
      });
      mockDatabaseService.organization.update.mockResolvedValue({});

      await service.createCheckoutSession('org-123', { planId: 'pro', interval: 'monthly' });

      expect(mockRazorpayProvider.createCheckoutSession).toHaveBeenCalled();
    });

    it('should create checkout session with Stripe for US organization', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockStripeProvider.createCheckoutSession.mockResolvedValue({
        url: 'https://checkout.stripe.com/session123',
        sessionId: 'cs_test_123',
      });

      const result = await service.createCheckoutSession('org-123', checkoutDto);

      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/session123');
      expect(result.sessionId).toBe('cs_test_123');
      expect(mockStripeProvider.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cus_stripe123',
          successUrl: expect.stringContaining('/billing/success'),
          cancelUrl: expect.stringContaining('/billing/cancel'),
        }),
      );
    });

    it('should use APP_URL for generated checkout return URLs before legacy fallbacks', async () => {
      const originalAppUrl = process.env.APP_URL;
      const originalFrontendUrl = process.env.FRONTEND_URL;
      const originalWebUrl = process.env.WEB_URL;

      try {
        process.env.APP_URL = 'https://app.vizora.test';
        process.env.FRONTEND_URL = 'https://legacy.vizora.test';
        process.env.WEB_URL = 'https://web.vizora.test';
        mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
        mockStripeProvider.createCheckoutSession.mockResolvedValue({
          url: 'https://checkout.stripe.com/session123',
          sessionId: 'cs_test_123',
        });

        await service.createCheckoutSession('org-123', checkoutDto);

        expect(mockStripeProvider.createCheckoutSession).toHaveBeenCalledWith(
          expect.objectContaining({
            successUrl: 'https://app.vizora.test/dashboard/settings/billing/success',
            cancelUrl: 'https://app.vizora.test/dashboard/settings/billing/cancel',
          }),
        );
      } finally {
        if (originalAppUrl === undefined) delete process.env.APP_URL;
        else process.env.APP_URL = originalAppUrl;

        if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = originalFrontendUrl;

        if (originalWebUrl === undefined) delete process.env.WEB_URL;
        else process.env.WEB_URL = originalWebUrl;
      }
    });

    it('should create checkout session with Razorpay for Indian organization', async () => {
      const indianOrg = {
        ...mockOrganization,
        country: 'IN',
        stripeCustomerId: null,
        razorpayCustomerId: 'cust_razorpay123',
        paymentProvider: 'razorpay',
      };

      mockDatabaseService.organization.findUnique.mockResolvedValue(indianOrg);
      mockRazorpayProvider.createCheckoutSession.mockResolvedValue({
        url: 'https://razorpay.com/checkout/session123',
        sessionId: 'sub_razorpay123',
      });

      const result = await service.createCheckoutSession('org-123', checkoutDto);

      expect(result.checkoutUrl).toBe('https://razorpay.com/checkout/session123');
      expect(mockRazorpayProvider.createCheckoutSession).toHaveBeenCalled();
    });

    it('should create customer if not exists', async () => {
      const orgWithoutCustomer = {
        ...mockOrganization,
        stripeCustomerId: null,
        paymentProvider: null,
      };
      mockDatabaseService.organization.findUnique.mockResolvedValue(orgWithoutCustomer);
      mockStripeProvider.createCustomer.mockResolvedValue({
        id: 'cus_new123',
        email: 'admin@test.com',
      });
      mockStripeProvider.createCheckoutSession.mockResolvedValue({
        url: 'https://checkout.stripe.com/session123',
        sessionId: 'cs_test_123',
      });
      mockDatabaseService.organization.update.mockResolvedValue({});

      await service.createCheckoutSession('org-123', checkoutDto);

      expect(mockStripeProvider.createCustomer).toHaveBeenCalled();
      expect(mockDatabaseService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          stripeCustomerId: 'cus_new123',
          paymentProvider: 'stripe',
        }),
      });
    });

    it('should throw BadRequestException for invalid plan', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);

      await expect(
        service.createCheckoutSession('org-123', { planId: 'free', interval: 'monthly' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent organization', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.createCheckoutSession('non-existent', checkoutDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelSubscription', () => {
    it('cancel-at-period-end (Stripe) does NOT revoke paid access — status stays active', async () => {
      // Fix #3: Stripe keeps the sub active through the paid period
      // (cancel_at_period_end=true). We must NOT flip local status to 'canceled'
      // or SubscriptionActiveGuard would block writes the customer paid for.
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockStripeProvider.cancelSubscription.mockResolvedValue(undefined);
      mockDatabaseService.organization.update.mockResolvedValue({});
      mockStripeProvider.getSubscription.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      });

      const result = await service.cancelSubscription('org-123', false);

      expect(mockStripeProvider.cancelSubscription).toHaveBeenCalledWith('sub_stripe123', false);
      // No local status write on the Stripe grace path — status is untouched.
      expect(mockDatabaseService.organization.update).not.toHaveBeenCalled();
      // getSubscriptionStatus reflects the still-active sub + cancelAtPeriodEnd.
      expect(result.subscriptionStatus).toBe('active');
      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it('cancel-at-period-end (Razorpay) finalizes immediately — provider cancels now, no grace', async () => {
      // Razorpay's cancel(id, false) cancels IMMEDIATELY, so we mirror the
      // provider by finalizing local status to 'canceled' (documented behavior).
      const razorpayOrg = {
        ...mockOrganization,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        razorpayCustomerId: 'cust_razorpay123',
        razorpaySubscriptionId: 'sub_razorpay123',
        paymentProvider: 'razorpay',
      };
      mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayOrg);
      mockRazorpayProvider.cancelSubscription.mockResolvedValue(undefined);
      mockRazorpayProvider.getSubscription.mockResolvedValue(null);
      mockDatabaseService.organization.update.mockResolvedValue({});

      await service.cancelSubscription('org-123', false);

      expect(mockRazorpayProvider.cancelSubscription).toHaveBeenCalledWith('sub_razorpay123', false);
      // Same entitlement fields as the immediate branch and the webhook (B3-P5):
      // the provider has already cancelled, so leaving ANY paid entitlement
      // behind keeps what the customer no longer pays for. storageQuotaBytes is
      // part of that set (A-F3), and the dead subscription id is cleared so a
      // later plan-change/cancel cannot act on it (A-F7).
      expect(mockDatabaseService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          subscriptionStatus: 'canceled',
          subscriptionTier: 'free',
          screenQuota: 5,
          storageQuotaBytes: BigInt(1024 * 1024 * 1024),
          razorpaySubscriptionId: null,
          billingEventAt: expect.any(Date),
        },
      });
    });

    it('should cancel subscription immediately and downgrade to free', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockStripeProvider.cancelSubscription.mockResolvedValue(undefined);
      mockDatabaseService.organization.update.mockResolvedValue({});
      mockStripeProvider.getSubscription.mockResolvedValue(null);

      await service.cancelSubscription('org-123', true);

      expect(mockStripeProvider.cancelSubscription).toHaveBeenCalledWith('sub_stripe123', true);
      expect(mockDatabaseService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          subscriptionTier: 'free',
          subscriptionStatus: 'canceled',
          screenQuota: 5,
          stripeSubscriptionId: null,
        }),
      });
    });

    it('should throw BadRequestException if no subscription', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue({
        ...mockOrganization,
        stripeSubscriptionId: null,
        paymentProvider: null,
      });

      await expect(service.cancelSubscription('org-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateSubscription', () => {
    it('preserves a YEARLY subscriber interval on plan change (no silent monthly re-bill)', async () => {
      // Fix #4: a yearly subscriber changing plans must stay yearly. The interval
      // is read from the live Stripe subscription, not hardcoded to monthly.
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockStripeProvider.getSubscription.mockResolvedValue({
        ...mockSubscription,
        interval: 'yearly',
      });
      mockStripeProvider.updateSubscription.mockResolvedValue({
        ...mockSubscription,
        interval: 'yearly',
      });
      mockDatabaseService.organization.update.mockResolvedValue({});

      await service.updateSubscription('org-123', { planId: 'pro' });

      // STRIPE_PRO_YEARLY_PRICE_ID = 'price_pro_yearly' (set in beforeAll).
      expect(mockStripeProvider.updateSubscription).toHaveBeenCalledWith(
        'sub_stripe123',
        'price_pro_yearly',
      );
    });

    it('keeps a MONTHLY subscriber on monthly', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockStripeProvider.getSubscription.mockResolvedValue({
        ...mockSubscription,
        interval: 'monthly',
      });
      mockStripeProvider.updateSubscription.mockResolvedValue({
        ...mockSubscription,
        interval: 'monthly',
      });
      mockDatabaseService.organization.update.mockResolvedValue({});

      await service.updateSubscription('org-123', { planId: 'pro' });

      expect(mockStripeProvider.updateSubscription).toHaveBeenCalledWith(
        'sub_stripe123',
        'price_pro_monthly',
      );
    });

    it('refuses the plan change when the current interval cannot be determined (no wrong charge)', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      // Live sub exposes no monthly/yearly interval (e.g. week/day price or a
      // failed provider fetch). Must fail loudly rather than default to monthly.
      mockStripeProvider.getSubscription.mockResolvedValue({
        ...mockSubscription,
        interval: undefined,
      });

      await expect(
        service.updateSubscription('org-123', { planId: 'pro' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockStripeProvider.updateSubscription).not.toHaveBeenCalled();
    });

    const razorpayOrg = {
      ...mockOrganization,
      stripeSubscriptionId: null,
      razorpaySubscriptionId: 'sub_razorpay123',
      razorpayCustomerId: 'cust_razorpay123',
      paymentProvider: 'razorpay',
    };

    it('preserves the Razorpay billing interval on plan change (monthly)', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayOrg);
      mockRazorpayProvider.updateSubscription.mockResolvedValue({});
      // Razorpay exposes plan_id, not an interval — the current interval is
      // recovered by reverse-mapping the plan the subscriber is on today.
      // 'plan_basic_inr' = RAZORPAY_BASIC_PLAN_ID (legacy → monthly alias).
      mockRazorpayProvider.getSubscription.mockResolvedValue({
        priceId: 'plan_basic_inr',
        status: 'active',
      });
      mockDatabaseService.organization.update.mockResolvedValue({});

      await service.updateSubscription('org-123', { planId: 'pro' });

      expect(mockRazorpayProvider.updateSubscription).toHaveBeenCalledWith(
        'sub_razorpay123',
        'plan_pro_inr',
      );
    });

    it('preserves the Razorpay billing interval on plan change (yearly)', async () => {
      process.env.RAZORPAY_BASIC_YEARLY_PLAN_ID = 'plan_basic_inr_yearly';
      process.env.RAZORPAY_PRO_YEARLY_PLAN_ID = 'plan_pro_inr_yearly';
      try {
        mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayOrg);
        mockRazorpayProvider.updateSubscription.mockResolvedValue({});
        mockRazorpayProvider.getSubscription.mockResolvedValue({
          priceId: 'plan_basic_inr_yearly',
          status: 'active',
        });
        mockDatabaseService.organization.update.mockResolvedValue({});

        await service.updateSubscription('org-123', { planId: 'pro' });

        // A yearly subscriber must NOT be re-billed onto the monthly plan.
        expect(mockRazorpayProvider.updateSubscription).toHaveBeenCalledWith(
          'sub_razorpay123',
          'plan_pro_inr_yearly',
        );
      } finally {
        delete process.env.RAZORPAY_BASIC_YEARLY_PLAN_ID;
        delete process.env.RAZORPAY_PRO_YEARLY_PLAN_ID;
      }
    });

    it('MED-3 a STRIPE org with a live subscription is also refused a second checkout', async () => {
      // The guard was Razorpay-only, which combined with the A-F5 gate to steer
      // a past_due Stripe customer into creating a SECOND subscription while the
      // original kept billing and dunning.
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockStripeProvider.getSubscription.mockResolvedValue({
        id: 'sub_stripe123',
        status: 'past_due',
      });

      await expect(
        service.createCheckoutSession('org-123', { planId: 'pro', interval: 'monthly' }),
      ).rejects.toThrow(/already has a subscription with this payment provider/);
      expect(mockStripeProvider.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('A-F5 refuses an upgrade when the provider subscription is NOT active', async () => {
      // B3-P1 persisting razorpaySubscriptionId removed the accidental gate that
      // made this endpoint unreachable for Razorpay. An org holding only an
      // unpaid `created` shell from an abandoned checkout must not be able to
      // grant itself a paid tier locally.
      mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayOrg);
      mockRazorpayProvider.getSubscription.mockResolvedValue({
        priceId: 'plan_basic_inr',
        status: 'incomplete',
      });

      await expect(
        service.updateSubscription('org-123', { planId: 'pro' }),
      ).rejects.toThrow(/No live subscription to change/);
      // And the message must never send them to checkout — that is how a
      // parallel second subscription gets created.
      await expect(
        service.updateSubscription('org-123', { planId: 'pro' }),
      ).rejects.not.toThrow(/[Cc]omplete checkout/);
      expect(mockRazorpayProvider.updateSubscription).not.toHaveBeenCalled();
      expect(mockDatabaseService.organization.update).not.toHaveBeenCalled();
    });

    it('MED-3 a PAST_DUE subscriber may change plan, but gets no local tier grant', async () => {
      // past_due is the same state SubscriptionActiveGuard grants full dashboard
      // write access to, and downgrading is exactly what a dunning customer
      // wants. The provider-side change goes through; the paid-tier write is
      // deferred to the money path so entitlement still follows PAYMENT.
      mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayOrg);
      mockRazorpayProvider.getSubscription.mockResolvedValue({
        priceId: 'plan_basic_inr',
        status: 'past_due',
      });
      mockRazorpayProvider.updateSubscription.mockResolvedValue({});

      await service.updateSubscription('org-123', { planId: 'pro' });

      expect(mockRazorpayProvider.updateSubscription).toHaveBeenCalledWith(
        'sub_razorpay123',
        'plan_pro_inr',
      );
      expect(mockDatabaseService.organization.update).not.toHaveBeenCalled();
    });

    it('A-F5 refuses a self-serve upgrade to the sales-led enterprise tier', async () => {
      // `enterprise` is priced -1 (custom) and `free` is priced 0 — neither is
      // purchasable, but both are valid PLAN_TIERS keys, and the old `if (!plan)`
      // check let them through. Enterprise carries screenQuota -1 (UNLIMITED)
      // and 500GB of storage.
      mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayOrg);
      mockRazorpayProvider.getSubscription.mockResolvedValue({
        priceId: 'plan_basic_inr',
        status: 'active',
      });

      await expect(
        service.updateSubscription('org-123', { planId: 'enterprise' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockRazorpayProvider.updateSubscription).not.toHaveBeenCalled();
      expect(mockDatabaseService.organization.update).not.toHaveBeenCalled();
    });

    it('A-F5 refuses a "downgrade" to the free tier through the paid-change path', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayOrg);
      mockRazorpayProvider.getSubscription.mockResolvedValue({
        priceId: 'plan_basic_inr',
        status: 'active',
      });

      await expect(
        service.updateSubscription('org-123', { planId: 'free' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('B-M2 an API plan change stamps billingEventAt so an older webhook cannot revert it', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayOrg);
      mockRazorpayProvider.getSubscription.mockResolvedValue({
        priceId: 'plan_basic_inr',
        status: 'active',
      });
      mockRazorpayProvider.updateSubscription.mockResolvedValue({});
      mockDatabaseService.organization.update.mockResolvedValue({});

      await service.updateSubscription('org-123', { planId: 'pro' });

      expect(mockDatabaseService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          subscriptionTier: 'pro',
          // A-F3: storage travels with the tier on this path too.
          storageQuotaBytes: BigInt(102400 * 1024 * 1024),
          billingEventAt: expect.any(Date),
        }),
      });
    });

    it('refuses a Razorpay plan change when the current plan id is unrecognized', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(razorpayOrg);
      mockRazorpayProvider.getSubscription.mockResolvedValue({
        priceId: 'plan_from_another_era',
        status: 'active',
      });

      await expect(
        service.updateSubscription('org-123', { planId: 'pro' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockRazorpayProvider.updateSubscription).not.toHaveBeenCalled();
    });
  });

  describe('getInvoices', () => {
    it('should return invoices from Stripe', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockStripeProvider.getInvoices.mockResolvedValue(mockInvoices);

      const result = await service.getInvoices('org-123', 10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('inv_123');
      expect(result[0].amount).toBe(2900);
      expect(result[0].currency).toBe('usd');
      expect(result[0].status).toBe('paid');
      expect(mockStripeProvider.getInvoices).toHaveBeenCalledWith('cus_stripe123', 10);
    });

    it('should return empty array if no payment provider', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue({
        ...mockOrganization,
        stripeCustomerId: null,
        paymentProvider: null,
      });

      const result = await service.getInvoices('org-123');

      expect(result).toEqual([]);
    });
  });

  describe('handleWebhookEvent', () => {
    const rawBody = Buffer.from('test-body');
    const signature = 'test-signature';

    it('should verify signature and process subscription.updated event', async () => {
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockResolvedValue({});
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_123',
        type: 'customer.subscription.updated',
        data: {
          // Must be the subscription the org is actually on — an event about a
          // different subscription is ignored (B-H3).
          id: 'sub_stripe123',
          customer: 'cus_stripe123',
          status: 'active',
        },
      });

      const result = await service.handleWebhookEvent('stripe', { rawBody, signature });

      expect(result).toEqual({ received: true });
      expect(mockStripeProvider.verifyWebhookSignature).toHaveBeenCalledWith(rawBody, signature);
      // No price id in the payload, so no tier is resolved and only the status
      // is written. Entitlement writes go through the compare-and-set updateMany.
      expect(mockDatabaseService.organization.updateMany).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: { subscriptionStatus: 'active' },
      });
    });

    it('leaves subscriptionStatus unchanged on an unmapped status (fail-closed, audit S2-6)', async () => {
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockClear();
      mockDatabaseService.organization.update.mockResolvedValue({});
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_paused',
        type: 'customer.subscription.updated',
        data: {
          id: 'sub_paused',
          customer: 'cus_stripe123',
          // 'paused' is a real Stripe status we do not map. It must NOT coerce
          // to 'active' (that would silently restore entitlement to a paused,
          // non-paying subscription). Fail-closed: leave the org untouched.
          status: 'paused',
        },
      });

      const result = await service.handleWebhookEvent('stripe', { rawBody, signature });

      expect(result).toEqual({ received: true });
      expect(mockDatabaseService.organization.update).not.toHaveBeenCalled();
    });

    it('should handle subscription.deleted and downgrade to free', async () => {
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockResolvedValue({});
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_456',
        type: 'customer.subscription.deleted',
        data: {
          id: 'sub_stripe123',
          customer: 'cus_stripe123',
        },
      });

      await service.handleWebhookEvent('stripe', { rawBody, signature });

      expect(mockDatabaseService.organization.updateMany).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          subscriptionTier: 'free',
          subscriptionStatus: 'canceled',
          screenQuota: 5,
          // Storage is part of the free-tier set too, or a cancelled ex-Pro
          // keeps a 100GB quota forever (A-F3).
          storageQuotaBytes: BigInt(1024 * 1024 * 1024),
        }),
      });
    });

    it('should handle checkout.session.completed', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue({
        id: 'org-123',
        billingEventAt: null,
      });
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_cs_789',
        type: 'checkout.session.completed',
        data: {
          id: 'cs_789',
          subscription: 'sub_new123',
          metadata: {
            organizationId: 'org-123',
            planId: 'pro',
          },
        },
      });

      await service.handleWebhookEvent('stripe', { rawBody, signature });

      // B-M6: checkout completion goes through the SAME writeEntitlement path as
      // the lifecycle events, so it inherits the compare-and-set ordering guard
      // instead of being a second, unguarded tier-write site.
      expect(mockDatabaseService.organization.updateMany).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          stripeSubscriptionId: 'sub_new123',
          subscriptionTier: 'pro',
          subscriptionStatus: 'active',
          screenQuota: 100,
        }),
      });
    });

    it('rejects an unrecognized plan in checkout.session.completed metadata (B-M6)', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue({
        id: 'org-123',
        billingEventAt: null,
      });
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_cs_bad',
        type: 'checkout.session.completed',
        data: {
          id: 'cs_bad',
          subscription: 'sub_new456',
          // Stripe metadata is a free-form string map. This used to be written
          // straight into subscriptionTier, with getScreenQuotaForTier silently
          // falling back to the free-tier 5 — a corrupt tier and a mismatched
          // quota, nothing logged.
          metadata: { organizationId: 'org-123', planId: 'platinum-elite' },
        },
      });

      await service.handleWebhookEvent('stripe', { rawBody, signature });

      expect(mockDatabaseService.organization.updateMany).not.toHaveBeenCalled();
    });

    it('should record transaction on payment succeeded', async () => {
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockResolvedValue({});
      mockDatabaseService.billingTransaction.upsert.mockResolvedValue({});
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_inv_123',
        type: 'invoice.payment_succeeded',
        data: {
          id: 'inv_123',
          customer: 'cus_stripe123',
          amount_paid: 2900,
          currency: 'usd',
        },
      });

      await service.handleWebhookEvent('stripe', { rawBody, signature });

      expect(mockDatabaseService.billingTransaction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            organizationId: 'org-123',
            provider: 'stripe',
            type: 'subscription',
            status: 'succeeded',
            amount: 2900,
            currency: 'usd',
          }),
        }),
      );
    });

    it('acks 200 for a COMPLETED duplicate (event genuinely already processed)', async () => {
      // Second delivery of the same event: the NX claim fails (key exists) and
      // the marker reads 'completed' → truly a duplicate → ack 200, skip work.
      mockRedisClient.set.mockResolvedValue(null);
      mockRedisClient.get.mockResolvedValue('completed');
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_duplicate',
        type: 'customer.subscription.updated',
        data: { id: 'sub_dup' },
      });

      const result = await service.handleWebhookEvent('stripe', { rawBody, signature });

      expect(result).toEqual({ received: true });
      // The claim was keyed on the top-level event id, not the object id.
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'webhook:processed:stripe:evt_duplicate', 'pending', 'EX', 300, 'NX',
      );
      // Read the marker to disambiguate completed-vs-pending before acking.
      expect(mockRedisClient.get).toHaveBeenCalledWith('webhook:processed:stripe:evt_duplicate');
      expect(mockDatabaseService.organization.findFirst).not.toHaveBeenCalled();
    });

    it('does NOT ack a PENDING duplicate — throws 503 so the PSP retries (audit S2-5)', async () => {
      // Orphaned-pending money-path loss: a prior delivery claimed the key then
      // hard-crashed before completing. The NX claim fails (key still exists)
      // and the marker reads 'pending'. Acking 200 here would tell the PSP the
      // event is handled and it would stop retrying → the event is lost forever.
      // Must instead surface a retryable non-2xx (503) WITHOUT being reclassified
      // as an "invalid signature" 401 by the controller.
      mockRedisClient.set.mockResolvedValue(null);
      mockRedisClient.get.mockResolvedValue('pending');
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_orphaned',
        type: 'customer.subscription.updated',
        data: { id: 'sub_orphan', customer: 'cus_stripe123', status: 'active' },
      });

      await expect(
        service.handleWebhookEvent('stripe', { rawBody, signature }),
      ).rejects.toThrow(ServiceUnavailableException);

      // No processing happened, and the claim was NOT released (the pending key
      // belongs to the crashed worker; it self-heals via TTL, we don't del it).
      expect(mockDatabaseService.organization.findFirst).not.toHaveBeenCalled();
      expect(mockRedisClient.del).not.toHaveBeenCalledWith('webhook:processed:stripe:evt_orphaned');
    });

    it('processes two DISTINCT events that share an object id (was wrongly deduped)', async () => {
      // Regression for the object-id keying bug: two different events for the
      // same subscription must both process.
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockStripeProvider.verifyWebhookSignature
        .mockReturnValueOnce({ id: 'evt_A', type: 'customer.subscription.updated', data: { id: 'sub_stripe123', customer: 'cus_stripe123', status: 'active' } })
        .mockReturnValueOnce({ id: 'evt_B', type: 'customer.subscription.updated', data: { id: 'sub_stripe123', customer: 'cus_stripe123', status: 'active' } });

      await service.handleWebhookEvent('stripe', { rawBody, signature });
      await service.handleWebhookEvent('stripe', { rawBody, signature });

      // Distinct event ids → two distinct NX claims → both processed.
      expect(mockRedisClient.set).toHaveBeenCalledWith('webhook:processed:stripe:evt_A', 'pending', 'EX', 300, 'NX');
      expect(mockRedisClient.set).toHaveBeenCalledWith('webhook:processed:stripe:evt_B', 'pending', 'EX', 300, 'NX');
      // Each successful process flips its key pending → completed.
      expect(mockRedisClient.set).toHaveBeenCalledWith('webhook:processed:stripe:evt_A', 'completed', 'EX', 172800);
      expect(mockDatabaseService.organization.updateMany).toHaveBeenCalledTimes(2);
    });

    it('claim-then-crash: a handler THROW releases the claim so the PSP retry re-enters', async () => {
      // First delivery: claim ok, but the handler throws AFTER the claim.
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_crash', type: 'customer.subscription.updated', data: { id: 'sub_stripe123', customer: 'cus_stripe123', status: 'active' },
      });
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.updateMany.mockRejectedValueOnce(new Error('DB write failed'));

      await expect(service.handleWebhookEvent('stripe', { rawBody, signature })).rejects.toThrow('DB write failed');

      // NEGATIVE: the claim was RELEASED (del), not left as a poison-pill 'pending'
      // that would cause the retry to be silently dropped as a duplicate.
      expect(mockRedisClient.del).toHaveBeenCalledWith('webhook:processed:stripe:evt_crash');
    });

    it('fails CLOSED when the idempotency store is unavailable (PSP will retry)', async () => {
      // Redis down → cannot guarantee idempotency → throw → 5xx → PSP retries.
      // Never double-process, never silently drop.
      mockRedisService.getClient.mockReturnValue(null);
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_noredis', type: 'customer.subscription.updated', data: { id: 'sub_x' },
      });

      await expect(
        service.handleWebhookEvent('stripe', { rawBody, signature }),
      ).rejects.toThrow(/unavailable/i);
      expect(mockDatabaseService.organization.update).not.toHaveBeenCalled();
    });

    it('should use razorpay provider for razorpay webhooks', async () => {
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockResolvedValue({});
      mockRazorpayProvider.verifyWebhookSignature.mockReturnValue({
        id: 'rzp_deadbeef',
        type: 'subscription.updated',
        data: { subscription: { customer_id: 'cust_razorpay123', status: 'active' } },
      });

      await service.handleWebhookEvent('razorpay', { rawBody, signature });

      expect(mockRazorpayProvider.verifyWebhookSignature).toHaveBeenCalledWith(rawBody, signature);
    });
  });

  describe('recordTransaction', () => {
    it('should create a billing transaction record', async () => {
      const transactionData = {
        organizationId: 'org-123',
        provider: 'stripe' as const,
        providerTransactionId: 'pi_123',
        type: 'subscription' as const,
        status: 'succeeded' as const,
        amount: 2900,
        currency: 'usd',
        description: 'Monthly subscription',
      };

      mockDatabaseService.billingTransaction.upsert.mockResolvedValue({
        id: 'txn-123',
        ...transactionData,
      });

      const result = await service.recordTransaction(transactionData);

      // Idempotent by construction (B-H1): keyed on the provider transaction id
      // so a retry after a partial apply re-observes the row instead of dying
      // on P2002 before the entitlement recovery runs. Append-only, so the
      // update half is deliberately empty.
      expect(mockDatabaseService.billingTransaction.upsert).toHaveBeenCalledWith({
        where: {
          provider_providerTransactionId: {
            provider: 'stripe',
            providerTransactionId: 'pi_123',
          },
        },
        create: transactionData,
        update: {},
      });
      expect(result.id).toBe('txn-123');
    });
  });
});
