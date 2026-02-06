import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RazorpayProvider } from '../providers/razorpay.provider';

// Mock the Razorpay module
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      fetch: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
      fetch: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    invoices: {
      all: jest.fn(),
    },
  }));
});

describe('RazorpayProvider', () => {
  let provider: RazorpayProvider;
  let mockRazorpay: any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        RAZORPAY_KEY_ID: 'rzp_test_123',
        RAZORPAY_KEY_SECRET: 'secret_123',
        RAZORPAY_WEBHOOK_SECRET: 'webhook_secret_123',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    provider = module.get<RazorpayProvider>(RazorpayProvider);
    // Access the mocked razorpay instance
    mockRazorpay = (provider as any).razorpay;
  });

  describe('name', () => {
    it('should return razorpay', () => {
      expect(provider.name).toBe('razorpay');
    });
  });

  describe('createCustomer', () => {
    it('should create customer with notes', async () => {
      const mockCustomer = {
        id: 'cust_123',
        email: 'test@example.com',
        name: 'Test User',
        notes: { organizationId: 'org_123' },
      };
      mockRazorpay.customers.create.mockResolvedValue(mockCustomer);

      const result = await provider.createCustomer(
        'test@example.com',
        'Test User',
        { organizationId: 'org_123' },
      );

      expect(mockRazorpay.customers.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        notes: { organizationId: 'org_123' },
      });
      expect(result).toEqual({
        id: 'cust_123',
        email: 'test@example.com',
        name: 'Test User',
        metadata: { organizationId: 'org_123' },
      });
    });

    it('should create customer with empty notes when no metadata', async () => {
      const mockCustomer = {
        id: 'cust_123',
        email: 'test@example.com',
        name: 'Test User',
        notes: {},
      };
      mockRazorpay.customers.create.mockResolvedValue(mockCustomer);

      await provider.createCustomer('test@example.com', 'Test User');

      expect(mockRazorpay.customers.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        notes: {},
      });
    });
  });

  describe('getCustomer', () => {
    it('should return customer when found', async () => {
      const mockCustomer = {
        id: 'cust_123',
        email: 'test@example.com',
        name: 'Test User',
        notes: { plan: 'pro' },
      };
      mockRazorpay.customers.fetch.mockResolvedValue(mockCustomer);

      const result = await provider.getCustomer('cust_123');

      expect(mockRazorpay.customers.fetch).toHaveBeenCalledWith('cust_123');
      expect(result).toEqual({
        id: 'cust_123',
        email: 'test@example.com',
        name: 'Test User',
        metadata: { plan: 'pro' },
      });
    });

    it('should return null on error', async () => {
      mockRazorpay.customers.fetch.mockRejectedValue(new Error('Not found'));

      const result = await provider.getCustomer('cust_invalid');

      expect(result).toBeNull();
    });
  });

  describe('createCheckoutSession', () => {
    it('should create subscription and return short_url', async () => {
      const mockSubscription = {
        id: 'sub_123',
        short_url: 'https://rzp.io/i/abc123',
      };
      mockRazorpay.subscriptions.create.mockResolvedValue(mockSubscription);

      const params = {
        customerId: 'cust_123',
        priceId: 'plan_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        metadata: { source: 'dashboard' },
      };

      const result = await provider.createCheckoutSession(params);

      expect(mockRazorpay.subscriptions.create).toHaveBeenCalledWith({
        plan_id: 'plan_123',
        customer_id: 'cust_123',
        total_count: 12,
        notes: { source: 'dashboard' },
      });
      expect(result).toEqual({
        url: 'https://rzp.io/i/abc123',
        sessionId: 'sub_123',
      });
    });

    it('should use empty notes when no metadata provided', async () => {
      const mockSubscription = {
        id: 'sub_123',
        short_url: 'https://rzp.io/i/abc123',
      };
      mockRazorpay.subscriptions.create.mockResolvedValue(mockSubscription);

      const params = {
        customerId: 'cust_123',
        priceId: 'plan_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      await provider.createCheckoutSession(params);

      expect(mockRazorpay.subscriptions.create).toHaveBeenCalledWith({
        plan_id: 'plan_123',
        customer_id: 'cust_123',
        total_count: 12,
        notes: {},
      });
    });
  });

  describe('getSubscription', () => {
    it('should return mapped subscription with status mapping', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockSub = {
        id: 'sub_123',
        customer_id: 'cust_123',
        status: 'active',
        current_start: now,
        current_end: now + 30 * 24 * 60 * 60,
        plan_id: 'plan_123',
        notes: { plan: 'pro' },
        ended_at: null,
      };
      mockRazorpay.subscriptions.fetch.mockResolvedValue(mockSub);

      const result = await provider.getSubscription('sub_123');

      expect(result).toEqual({
        id: 'sub_123',
        customerId: 'cust_123',
        status: 'active',
        currentPeriodStart: new Date(now * 1000),
        currentPeriodEnd: new Date((now + 30 * 24 * 60 * 60) * 1000),
        cancelAtPeriodEnd: false,
        priceId: 'plan_123',
        metadata: { plan: 'pro' },
      });
    });

    it('should map various statuses correctly', async () => {
      const now = Math.floor(Date.now() / 1000);
      const testCases = [
        { razorpayStatus: 'created', expectedStatus: 'incomplete' },
        { razorpayStatus: 'authenticated', expectedStatus: 'incomplete' },
        { razorpayStatus: 'active', expectedStatus: 'active' },
        { razorpayStatus: 'pending', expectedStatus: 'past_due' },
        { razorpayStatus: 'halted', expectedStatus: 'past_due' },
        { razorpayStatus: 'cancelled', expectedStatus: 'canceled' },
        { razorpayStatus: 'completed', expectedStatus: 'canceled' },
        { razorpayStatus: 'expired', expectedStatus: 'canceled' },
        { razorpayStatus: 'unknown', expectedStatus: 'incomplete' },
      ];

      for (const { razorpayStatus, expectedStatus } of testCases) {
        const mockSub = {
          id: 'sub_123',
          customer_id: 'cust_123',
          status: razorpayStatus,
          current_start: now,
          current_end: now + 30 * 24 * 60 * 60,
          plan_id: 'plan_123',
          notes: {},
          ended_at: null,
        };
        mockRazorpay.subscriptions.fetch.mockResolvedValue(mockSub);

        const result = await provider.getSubscription('sub_123');

        expect(result?.status).toBe(expectedStatus);
      }
    });

    it('should set cancelAtPeriodEnd true when pending', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockSub = {
        id: 'sub_123',
        customer_id: 'cust_123',
        status: 'pending',
        current_start: now,
        current_end: now + 30 * 24 * 60 * 60,
        plan_id: 'plan_123',
        notes: {},
        ended_at: null,
      };
      mockRazorpay.subscriptions.fetch.mockResolvedValue(mockSub);

      const result = await provider.getSubscription('sub_123');

      expect(result?.cancelAtPeriodEnd).toBe(true);
    });

    it('should set cancelAtPeriodEnd true when ended_at is set', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockSub = {
        id: 'sub_123',
        customer_id: 'cust_123',
        status: 'active',
        current_start: now,
        current_end: now + 30 * 24 * 60 * 60,
        plan_id: 'plan_123',
        notes: {},
        ended_at: now + 30 * 24 * 60 * 60,
      };
      mockRazorpay.subscriptions.fetch.mockResolvedValue(mockSub);

      const result = await provider.getSubscription('sub_123');

      expect(result?.cancelAtPeriodEnd).toBe(true);
    });

    it('should return null on error', async () => {
      mockRazorpay.subscriptions.fetch.mockRejectedValue(new Error('Not found'));

      const result = await provider.getSubscription('sub_invalid');

      expect(result).toBeNull();
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription with new plan', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockSub = {
        id: 'sub_123',
        customer_id: 'cust_123',
        status: 'active',
        current_start: now,
        current_end: now + 30 * 24 * 60 * 60,
        plan_id: 'plan_456',
        notes: {},
        ended_at: null,
      };
      mockRazorpay.subscriptions.update.mockResolvedValue(mockSub);

      const result = await provider.updateSubscription('sub_123', 'plan_456');

      expect(mockRazorpay.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        plan_id: 'plan_456',
      });
      expect(result.priceId).toBe('plan_456');
    });
  });

  describe('cancelSubscription', () => {
    it('should call razorpay cancel with immediately flag', async () => {
      await provider.cancelSubscription('sub_123', true);

      expect(mockRazorpay.subscriptions.cancel).toHaveBeenCalledWith(
        'sub_123',
        true,
      );
    });

    it('should call razorpay cancel with false when not immediately', async () => {
      await provider.cancelSubscription('sub_123', false);

      expect(mockRazorpay.subscriptions.cancel).toHaveBeenCalledWith(
        'sub_123',
        false,
      );
    });

    it('should default to not immediate cancellation', async () => {
      await provider.cancelSubscription('sub_123');

      expect(mockRazorpay.subscriptions.cancel).toHaveBeenCalledWith(
        'sub_123',
        false,
      );
    });
  });

  describe('getInvoices', () => {
    it('should return mapped invoices', async () => {
      const now = Math.floor(Date.now() / 1000);
      const mockInvoices = {
        items: [
          {
            id: 'inv_123',
            customer_id: 'cust_123',
            subscription_id: 'sub_123',
            amount: 200000, // in paise
            currency: 'INR',
            status: 'paid',
            description: 'Pro plan',
            short_url: 'https://rzp.io/i/inv123',
            created_at: now,
          },
        ],
      };
      mockRazorpay.invoices.all.mockResolvedValue(mockInvoices);

      const result = await provider.getInvoices('cust_123', 5);

      expect(mockRazorpay.invoices.all).toHaveBeenCalledWith({
        customer_id: 'cust_123',
        count: 5,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'inv_123',
        customerId: 'cust_123',
        subscriptionId: 'sub_123',
        amount: 200000,
        currency: 'INR',
        status: 'paid',
        description: 'Pro plan',
        pdfUrl: 'https://rzp.io/i/inv123',
        createdAt: new Date(now * 1000),
      });
    });

    it('should use default limit of 10', async () => {
      mockRazorpay.invoices.all.mockResolvedValue({ items: [] });

      await provider.getInvoices('cust_123');

      expect(mockRazorpay.invoices.all).toHaveBeenCalledWith({
        customer_id: 'cust_123',
        count: 10,
      });
    });

    it('should handle missing items gracefully', async () => {
      mockRazorpay.invoices.all.mockResolvedValue({});

      const result = await provider.getInvoices('cust_123');

      expect(result).toEqual([]);
    });

    it('should map invoice statuses correctly', async () => {
      const now = Math.floor(Date.now() / 1000);
      const testCases = [
        { razorpayStatus: 'draft', expectedStatus: 'draft' },
        { razorpayStatus: 'issued', expectedStatus: 'open' },
        { razorpayStatus: 'paid', expectedStatus: 'paid' },
        { razorpayStatus: 'cancelled', expectedStatus: 'void' },
        { razorpayStatus: 'expired', expectedStatus: 'void' },
        { razorpayStatus: 'partially_paid', expectedStatus: 'open' },
        { razorpayStatus: 'unknown', expectedStatus: 'draft' },
      ];

      for (const { razorpayStatus, expectedStatus } of testCases) {
        const mockInvoices = {
          items: [
            {
              id: 'inv_123',
              customer_id: 'cust_123',
              subscription_id: null,
              amount: 100000,
              currency: 'INR',
              status: razorpayStatus,
              description: null,
              short_url: null,
              created_at: now,
            },
          ],
        };
        mockRazorpay.invoices.all.mockResolvedValue(mockInvoices);

        const result = await provider.getInvoices('cust_123');

        expect(result[0].status).toBe(expectedStatus);
      }
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC signature', () => {
      const payload = Buffer.from(
        JSON.stringify({
          event: 'subscription.activated',
          payload: { subscription: { id: 'sub_123' } },
        }),
      );
      const expectedSignature = crypto
        .createHmac('sha256', 'webhook_secret_123')
        .update(payload)
        .digest('hex');

      const result = provider.verifyWebhookSignature(payload, expectedSignature);

      expect(result).toEqual({
        type: 'subscription.activated',
        data: { subscription: { id: 'sub_123' } },
      });
    });

    it('should throw on invalid signature', () => {
      const payload = Buffer.from(
        JSON.stringify({
          event: 'subscription.activated',
          payload: { subscription: { id: 'sub_123' } },
        }),
      );

      expect(() =>
        provider.verifyWebhookSignature(payload, 'invalid_signature'),
      ).toThrow('Invalid webhook signature');
    });
  });
});
