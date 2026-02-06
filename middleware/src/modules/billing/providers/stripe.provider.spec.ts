import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeProvider } from '../providers/stripe.provider';

// Mock the Stripe module
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
    invoices: {
      list: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

describe('StripeProvider', () => {
  let provider: StripeProvider;
  let mockStripe: any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    provider = module.get<StripeProvider>(StripeProvider);
    // Access the mocked stripe instance
    mockStripe = (provider as any).stripe;
  });

  describe('name', () => {
    it('should return stripe', () => {
      expect(provider.name).toBe('stripe');
    });
  });

  describe('createCustomer', () => {
    it('should create and return a customer', async () => {
      const mockCustomer = {
        id: 'cus_123',
        email: 'test@example.com',
        name: 'Test User',
        metadata: { organizationId: 'org_123' },
      };
      mockStripe.customers.create.mockResolvedValue(mockCustomer);

      const result = await provider.createCustomer(
        'test@example.com',
        'Test User',
        { organizationId: 'org_123' },
      );

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { organizationId: 'org_123' },
      });
      expect(result).toEqual({
        id: 'cus_123',
        email: 'test@example.com',
        name: 'Test User',
        metadata: { organizationId: 'org_123' },
      });
    });

    it('should use provided email/name if not returned by Stripe', async () => {
      const mockCustomer = {
        id: 'cus_123',
        email: null,
        name: null,
        metadata: {},
      };
      mockStripe.customers.create.mockResolvedValue(mockCustomer);

      const result = await provider.createCustomer('test@example.com', 'Test User');

      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
    });
  });

  describe('getCustomer', () => {
    it('should return customer when found', async () => {
      const mockCustomer = {
        id: 'cus_123',
        email: 'test@example.com',
        name: 'Test User',
        metadata: {},
        deleted: false,
      };
      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);

      const result = await provider.getCustomer('cus_123');

      expect(mockStripe.customers.retrieve).toHaveBeenCalledWith('cus_123');
      expect(result).toEqual({
        id: 'cus_123',
        email: 'test@example.com',
        name: 'Test User',
        metadata: {},
      });
    });

    it('should return null for deleted customer', async () => {
      const mockCustomer = {
        id: 'cus_123',
        deleted: true,
      };
      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);

      const result = await provider.getCustomer('cus_123');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockStripe.customers.retrieve.mockRejectedValue(new Error('Not found'));

      const result = await provider.getCustomer('cus_invalid');

      expect(result).toBeNull();
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session with correct params', async () => {
      const mockSession = {
        id: 'cs_123',
        url: 'https://checkout.stripe.com/session/123',
      };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const params = {
        customerId: 'cus_123',
        priceId: 'price_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        metadata: { plan: 'pro' },
      };

      const result = await provider.createCheckoutSession(params);

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        mode: 'subscription',
        line_items: [{ price: 'price_123', quantity: 1 }],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        metadata: { plan: 'pro' },
      });
      expect(result).toEqual({
        url: 'https://checkout.stripe.com/session/123',
        sessionId: 'cs_123',
      });
    });
  });

  describe('getSubscription', () => {
    it('should return mapped subscription', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockSub = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_start: now,
        current_period_end: now + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        items: {
          data: [{ price: { id: 'price_123' } }],
        },
        metadata: { plan: 'pro' },
      };
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSub);

      const result = await provider.getSubscription('sub_123');

      expect(result).toEqual({
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active',
        currentPeriodStart: new Date(now * 1000),
        currentPeriodEnd: new Date((now + 30 * 24 * 60 * 60) * 1000),
        cancelAtPeriodEnd: false,
        priceId: 'price_123',
        metadata: { plan: 'pro' },
      });
    });

    it('should return null on error', async () => {
      mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('Not found'));

      const result = await provider.getSubscription('sub_invalid');

      expect(result).toBeNull();
    });

    it('should handle customer as object', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockSub = {
        id: 'sub_123',
        customer: { id: 'cus_123' },
        status: 'active',
        current_period_start: now,
        current_period_end: now + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        items: {
          data: [{ price: { id: 'price_123' } }],
        },
        metadata: {},
      };
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSub);

      const result = await provider.getSubscription('sub_123');

      expect(result?.customerId).toBe('cus_123');
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription with new price', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockSub = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_start: now,
        current_period_end: now + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        items: {
          data: [{ id: 'si_123', price: { id: 'price_123' } }],
        },
        metadata: {},
      };
      const updatedSub = {
        ...mockSub,
        items: {
          data: [{ id: 'si_123', price: { id: 'price_456' } }],
        },
      };
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSub);
      mockStripe.subscriptions.update.mockResolvedValue(updatedSub);

      const result = await provider.updateSubscription('sub_123', 'price_456');

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        items: [{ id: 'si_123', price: 'price_456' }],
        proration_behavior: 'create_prorations',
      });
      expect(result.priceId).toBe('price_456');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel immediately when immediately is true', async () => {
      await provider.cancelSubscription('sub_123', true);

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
    });

    it('should set cancel_at_period_end when immediately is false', async () => {
      await provider.cancelSubscription('sub_123', false);

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      });
      expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('should default to cancel at period end', async () => {
      await provider.cancelSubscription('sub_123');

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      });
    });
  });

  describe('createBillingPortalSession', () => {
    it('should create billing portal session', async () => {
      const mockSession = {
        url: 'https://billing.stripe.com/session/123',
      };
      mockStripe.billingPortal.sessions.create.mockResolvedValue(mockSession);

      const result = await provider.createBillingPortalSession(
        'cus_123',
        'https://example.com/dashboard',
      );

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: 'https://example.com/dashboard',
      });
      expect(result).toEqual({
        url: 'https://billing.stripe.com/session/123',
      });
    });
  });

  describe('getInvoices', () => {
    it('should return mapped invoices', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockInvoices = {
        data: [
          {
            id: 'in_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            amount_paid: 2000,
            currency: 'usd',
            status: 'paid',
            description: 'Pro plan subscription',
            invoice_pdf: 'https://pay.stripe.com/invoice/123/pdf',
            created: now,
          },
        ],
      };
      mockStripe.invoices.list.mockResolvedValue(mockInvoices);

      const result = await provider.getInvoices('cus_123', 5);

      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        customer: 'cus_123',
        limit: 5,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'in_123',
        customerId: 'cus_123',
        subscriptionId: 'sub_123',
        amount: 2000,
        currency: 'usd',
        status: 'paid',
        description: 'Pro plan subscription',
        pdfUrl: 'https://pay.stripe.com/invoice/123/pdf',
        createdAt: new Date(now * 1000),
      });
    });

    it('should use default limit of 10', async () => {
      mockStripe.invoices.list.mockResolvedValue({ data: [] });

      await provider.getInvoices('cus_123');

      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        customer: 'cus_123',
        limit: 10,
      });
    });

    it('should handle customer/subscription as objects', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockInvoices = {
        data: [
          {
            id: 'in_123',
            customer: { id: 'cus_123' },
            subscription: { id: 'sub_123' },
            amount_paid: 2000,
            currency: 'usd',
            status: 'paid',
            description: null,
            invoice_pdf: null,
            created: now,
          },
        ],
      };
      mockStripe.invoices.list.mockResolvedValue(mockInvoices);

      const result = await provider.getInvoices('cus_123');

      expect(result[0].customerId).toBe('cus_123');
      expect(result[0].subscriptionId).toBe('sub_123');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify and return webhook event', () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: { id: 'sub_123', status: 'active' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const payload = Buffer.from('{"test": "data"}');
      const signature = 'sig_123';

      const result = provider.verifyWebhookSignature(payload, signature);

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'whsec_123',
      );
      expect(result).toEqual({
        type: 'customer.subscription.updated',
        data: { id: 'sub_123', status: 'active' },
      });
    });

    it('should throw on invalid signature', () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const payload = Buffer.from('{"test": "data"}');
      const signature = 'invalid_sig';

      expect(() => provider.verifyWebhookSignature(payload, signature)).toThrow(
        'Invalid signature',
      );
    });
  });
});
