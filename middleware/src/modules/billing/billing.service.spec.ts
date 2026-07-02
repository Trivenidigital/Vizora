import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { DatabaseService } from '../database/database.service';
import { StripeProvider } from './providers/stripe.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
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
  let mockConfigService: any;
  let mockStripeProvider: any;
  let mockRazorpayProvider: any;
  let mockRedisService: any;
  let mockRedisClient: any;

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
      },
      billingTransaction: {
        create: jest.fn(),
      },
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          APP_URL: 'http://localhost:3001',
          STRIPE_SECRET_KEY: 'sk_test_123',
          RAZORPAY_KEY_ID: 'rzp_test_123',
        };
        return config[key];
      }),
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
    mockRedisClient = { set: jest.fn().mockResolvedValue('OK') };
    mockRedisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      getClient: jest.fn(() => mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: StripeProvider, useValue: mockStripeProvider },
        { provide: RazorpayProvider, useValue: mockRazorpayProvider },
        { provide: MailService, useValue: mockMailService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit (price-ID startup validation)', () => {
    const KEYS = [
      'STRIPE_BASIC_MONTHLY_PRICE_ID',
      'STRIPE_BASIC_YEARLY_PRICE_ID',
      'RAZORPAY_BASIC_PLAN_ID',
      'STRIPE_PRO_MONTHLY_PRICE_ID',
      'STRIPE_PRO_YEARLY_PRICE_ID',
      'RAZORPAY_PRO_PLAN_ID',
      'STRIPE_ENTERPRISE_MONTHLY_PRICE_ID',
      'STRIPE_ENTERPRISE_YEARLY_PRICE_ID',
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
    it('should cancel subscription at period end', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockStripeProvider.cancelSubscription.mockResolvedValue(undefined);
      mockDatabaseService.organization.update.mockResolvedValue({});
      mockStripeProvider.getSubscription.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      });

      const result = await service.cancelSubscription('org-123', false);

      expect(mockStripeProvider.cancelSubscription).toHaveBeenCalledWith('sub_stripe123', false);
      expect(mockDatabaseService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: { subscriptionStatus: 'canceled' },
      });
      expect(result).toBeDefined();
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
          id: 'sub_123',
          customer: 'cus_stripe123',
          status: 'active',
        },
      });

      const result = await service.handleWebhookEvent('stripe', { rawBody, signature });

      expect(result).toEqual({ received: true });
      expect(mockStripeProvider.verifyWebhookSignature).toHaveBeenCalledWith(rawBody, signature);
      expect(mockDatabaseService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: { subscriptionStatus: 'active' },
      });
    });

    it('should handle subscription.deleted and downgrade to free', async () => {
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockResolvedValue({});
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_456',
        type: 'customer.subscription.deleted',
        data: {
          id: 'sub_456',
          customer: 'cus_stripe123',
        },
      });

      await service.handleWebhookEvent('stripe', { rawBody, signature });

      expect(mockDatabaseService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          subscriptionTier: 'free',
          subscriptionStatus: 'canceled',
          screenQuota: 5,
        }),
      });
    });

    it('should handle checkout.session.completed', async () => {
      mockDatabaseService.organization.update.mockResolvedValue({});
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

      expect(mockDatabaseService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          stripeSubscriptionId: 'sub_new123',
          subscriptionTier: 'pro',
          subscriptionStatus: 'active',
          screenQuota: 100,
        }),
      });
    });

    it('should record transaction on payment succeeded', async () => {
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockResolvedValue({});
      mockDatabaseService.billingTransaction.create.mockResolvedValue({});
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

      expect(mockDatabaseService.billingTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-123',
          provider: 'stripe',
          type: 'subscription',
          status: 'succeeded',
          amount: 2900,
          currency: 'usd',
        }),
      });
    });

    it('should skip duplicate webhook events via idempotency (SETNX returns null)', async () => {
      // Second delivery of the same event: the NX claim fails (key exists).
      mockRedisClient.set.mockResolvedValue(null);
      mockStripeProvider.verifyWebhookSignature.mockReturnValue({
        id: 'evt_duplicate',
        type: 'customer.subscription.updated',
        data: { id: 'sub_dup' },
      });

      const result = await service.handleWebhookEvent('stripe', { rawBody, signature });

      expect(result).toEqual({ received: true });
      // The claim was keyed on the top-level event id, not the object id.
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'webhook:processed:stripe:evt_duplicate', '1', 'EX', 172800, 'NX',
      );
      expect(mockDatabaseService.organization.findFirst).not.toHaveBeenCalled();
    });

    it('processes two DISTINCT events that share an object id (was wrongly deduped)', async () => {
      // Regression for the object-id keying bug: two different events for the
      // same subscription must both process.
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockResolvedValue({});
      mockStripeProvider.verifyWebhookSignature
        .mockReturnValueOnce({ id: 'evt_A', type: 'customer.subscription.updated', data: { id: 'sub_shared', customer: 'cus_stripe123', status: 'active' } })
        .mockReturnValueOnce({ id: 'evt_B', type: 'customer.subscription.updated', data: { id: 'sub_shared', customer: 'cus_stripe123', status: 'active' } });

      await service.handleWebhookEvent('stripe', { rawBody, signature });
      await service.handleWebhookEvent('stripe', { rawBody, signature });

      // Distinct event ids → two distinct NX claims → both processed.
      expect(mockRedisClient.set).toHaveBeenCalledWith('webhook:processed:stripe:evt_A', '1', 'EX', 172800, 'NX');
      expect(mockRedisClient.set).toHaveBeenCalledWith('webhook:processed:stripe:evt_B', '1', 'EX', 172800, 'NX');
      expect(mockDatabaseService.organization.update).toHaveBeenCalledTimes(2);
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

      mockDatabaseService.billingTransaction.create.mockResolvedValue({
        id: 'txn-123',
        ...transactionData,
      });

      const result = await service.recordTransaction(transactionData);

      expect(mockDatabaseService.billingTransaction.create).toHaveBeenCalledWith({
        data: transactionData,
      });
      expect(result.id).toBe('txn-123');
    });
  });
});
