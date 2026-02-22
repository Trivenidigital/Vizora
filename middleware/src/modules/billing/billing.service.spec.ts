import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { DatabaseService } from '../database/database.service';
import { StripeProvider } from './providers/stripe.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import { MailService } from '../mail/mail.service';
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: StripeProvider, useValue: mockStripeProvider },
        { provide: RazorpayProvider, useValue: mockRazorpayProvider },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
    it('should process subscription.updated event', async () => {
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockResolvedValue({});

      const event = {
        type: 'customer.subscription.updated',
        data: {
          customer: 'cus_stripe123',
          status: 'active',
        },
      };

      const result = await service.handleWebhookEvent('stripe', event);

      expect(result).toEqual({ received: true });
      expect(mockDatabaseService.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: { subscriptionStatus: 'active' },
      });
    });

    it('should handle subscription.deleted and downgrade to free', async () => {
      mockDatabaseService.organization.findFirst.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockResolvedValue({});

      const event = {
        type: 'customer.subscription.deleted',
        data: {
          customer: 'cus_stripe123',
        },
      };

      await service.handleWebhookEvent('stripe', event);

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

      const event = {
        type: 'checkout.session.completed',
        data: {
          subscription: 'sub_new123',
          metadata: {
            organizationId: 'org-123',
            planId: 'pro',
          },
        },
      };

      await service.handleWebhookEvent('stripe', event);

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

      const event = {
        type: 'invoice.payment_succeeded',
        data: {
          id: 'inv_123',
          customer: 'cus_stripe123',
          amount_paid: 2900,
          currency: 'usd',
        },
      };

      await service.handleWebhookEvent('stripe', event);

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
