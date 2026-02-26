import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

describe('BillingController', () => {
  let controller: BillingController;
  let mockBillingService: jest.Mocked<BillingService>;

  const organizationId = 'org-123';

  const mockSubscriptionStatus = {
    subscriptionTier: 'basic',
    subscriptionStatus: 'active',
    screenQuota: 25,
    screensUsed: 12,
    trialEndsAt: null,
    currentPeriodEnd: '2024-03-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    paymentProvider: 'stripe',
  };

  const mockPlans = [
    {
      id: 'basic',
      name: 'Basic',
      screenQuota: 25,
      price: 2900,
      currency: 'usd',
      interval: 'monthly',
      features: ['Basic scheduling', 'Content upload'],
      isCurrent: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      screenQuota: 100,
      price: 9900,
      currency: 'usd',
      interval: 'monthly',
      features: ['All Basic features', 'Advanced analytics'],
      isCurrent: false,
    },
  ];

  const mockCheckoutSession = {
    checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    sessionId: 'cs_test_123',
  };

  const mockQuotaUsage = {
    screenQuota: 25,
    screensUsed: 12,
    remaining: 13,
    percentUsed: 48,
  };

  const mockInvoices = [
    {
      id: 'inv_123',
      amount: 2900,
      currency: 'usd',
      status: 'paid',
      description: 'Basic Plan - Monthly',
      createdAt: '2024-01-01T00:00:00.000Z',
      pdfUrl: 'https://stripe.com/invoices/inv_123/pdf',
    },
  ];

  beforeEach(async () => {
    mockBillingService = {
      getSubscriptionStatus: jest.fn(),
      getPlans: jest.fn(),
      createCheckoutSession: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      reactivateSubscription: jest.fn(),
      getBillingPortalUrl: jest.fn(),
      getInvoices: jest.fn(),
      getQuotaUsage: jest.fn(),
      handleWebhookEvent: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: BillingService, useValue: mockBillingService }],
    }).compile();

    controller = module.get<BillingController>(BillingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSubscription', () => {
    it('should return subscription status for organization', async () => {
      mockBillingService.getSubscriptionStatus.mockResolvedValue(mockSubscriptionStatus);

      const result = await controller.getSubscription(organizationId);

      expect(result).toEqual(mockSubscriptionStatus);
      expect(mockBillingService.getSubscriptionStatus).toHaveBeenCalledWith(organizationId);
    });

    it('should pass through service errors', async () => {
      mockBillingService.getSubscriptionStatus.mockRejectedValue(new Error('Service error'));

      await expect(controller.getSubscription(organizationId)).rejects.toThrow('Service error');
    });
  });

  describe('getPlans', () => {
    it('should return plans array', async () => {
      mockBillingService.getPlans.mockResolvedValue(mockPlans);

      const result = await controller.getPlans(organizationId);

      expect(result).toEqual(mockPlans);
      expect(mockBillingService.getPlans).toHaveBeenCalledWith(organizationId, undefined);
    });

    it('should pass country parameter to service', async () => {
      mockBillingService.getPlans.mockResolvedValue(mockPlans);

      await controller.getPlans(organizationId, 'IN');

      expect(mockBillingService.getPlans).toHaveBeenCalledWith(organizationId, 'IN');
    });

    it('should return India-specific plans when country is IN', async () => {
      const indiaPlan = { ...mockPlans[0], currency: 'inr', price: 199900 };
      mockBillingService.getPlans.mockResolvedValue([indiaPlan]);

      const result = await controller.getPlans(organizationId, 'IN');

      expect(result[0].currency).toBe('inr');
    });
  });

  describe('createCheckout', () => {
    const createCheckoutDto = {
      planId: 'pro',
      interval: 'monthly' as const,
      successUrl: 'https://app.vizora.io/billing/success',
      cancelUrl: 'https://app.vizora.io/billing/cancel',
    };

    it('should return checkout URL and session ID', async () => {
      mockBillingService.createCheckoutSession.mockResolvedValue(mockCheckoutSession);

      const result = await controller.createCheckout(organizationId, createCheckoutDto);

      expect(result).toEqual(mockCheckoutSession);
      expect(mockBillingService.createCheckoutSession).toHaveBeenCalledWith(
        organizationId,
        createCheckoutDto,
      );
    });

    it('should handle checkout creation errors', async () => {
      mockBillingService.createCheckoutSession.mockRejectedValue(new Error('Checkout failed'));

      await expect(controller.createCheckout(organizationId, createCheckoutDto)).rejects.toThrow(
        'Checkout failed',
      );
    });
  });

  describe('upgrade', () => {
    const upgradeDto = { planId: 'pro' };

    it('should call updateSubscription with dto', async () => {
      mockBillingService.updateSubscription.mockResolvedValue(mockSubscriptionStatus);

      const result = await controller.upgrade(organizationId, upgradeDto);

      expect(mockBillingService.updateSubscription).toHaveBeenCalledWith(organizationId, upgradeDto);
      expect(result).toEqual(mockSubscriptionStatus);
    });
  });

  describe('downgrade', () => {
    const downgradeDto = { planId: 'basic' };

    it('should call updateSubscription with cancelAtPeriodEnd false', async () => {
      mockBillingService.updateSubscription.mockResolvedValue(mockSubscriptionStatus);

      await controller.downgrade(organizationId, downgradeDto);

      expect(mockBillingService.updateSubscription).toHaveBeenCalledWith(organizationId, {
        ...downgradeDto,
        cancelAtPeriodEnd: false,
      });
    });
  });

  describe('cancel', () => {
    it('should call cancelSubscription with immediately false by default', async () => {
      mockBillingService.cancelSubscription.mockResolvedValue({ success: true });

      await controller.cancel(organizationId);

      expect(mockBillingService.cancelSubscription).toHaveBeenCalledWith(organizationId, false);
    });

    it('should call cancelSubscription with immediately true when specified', async () => {
      mockBillingService.cancelSubscription.mockResolvedValue({ success: true });

      await controller.cancel(organizationId, 'true');

      expect(mockBillingService.cancelSubscription).toHaveBeenCalledWith(organizationId, true);
    });

    it('should call cancelSubscription with immediately false for non-true string', async () => {
      mockBillingService.cancelSubscription.mockResolvedValue({ success: true });

      await controller.cancel(organizationId, 'false');

      expect(mockBillingService.cancelSubscription).toHaveBeenCalledWith(organizationId, false);
    });
  });

  describe('reactivate', () => {
    it('should call reactivateSubscription', async () => {
      mockBillingService.reactivateSubscription.mockResolvedValue(mockSubscriptionStatus);

      const result = await controller.reactivate(organizationId);

      expect(mockBillingService.reactivateSubscription).toHaveBeenCalledWith(organizationId);
      expect(result).toEqual(mockSubscriptionStatus);
    });
  });

  describe('getPortalUrl', () => {
    it('should return billing portal URL', async () => {
      const portalUrl = 'https://billing.stripe.com/p/session/123';
      mockBillingService.getBillingPortalUrl.mockResolvedValue({ portalUrl });

      const result = await controller.getPortalUrl(organizationId, 'https://app.vizora.io/dashboard');

      expect(result).toEqual({ portalUrl });
      expect(mockBillingService.getBillingPortalUrl).toHaveBeenCalledWith(
        organizationId,
        'https://app.vizora.io/dashboard',
      );
    });
  });

  describe('getInvoices', () => {
    it('should return invoices with default limit', async () => {
      mockBillingService.getInvoices.mockResolvedValue(mockInvoices);

      const result = await controller.getInvoices(organizationId);

      expect(result).toEqual(mockInvoices);
      expect(mockBillingService.getInvoices).toHaveBeenCalledWith(organizationId, 10);
    });

    it('should pass limit parameter as integer', async () => {
      mockBillingService.getInvoices.mockResolvedValue(mockInvoices);

      await controller.getInvoices(organizationId, '5');

      expect(mockBillingService.getInvoices).toHaveBeenCalledWith(organizationId, 5);
    });

    it('should clamp limit to max 100', async () => {
      mockBillingService.getInvoices.mockResolvedValue(mockInvoices);

      await controller.getInvoices(organizationId, '500');

      expect(mockBillingService.getInvoices).toHaveBeenCalledWith(organizationId, 100);
    });

    it('should default NaN limit to 10', async () => {
      mockBillingService.getInvoices.mockResolvedValue(mockInvoices);

      await controller.getInvoices(organizationId, 'invalid');

      expect(mockBillingService.getInvoices).toHaveBeenCalledWith(organizationId, 10);
    });
  });

  describe('getQuota', () => {
    it('should return quota usage', async () => {
      mockBillingService.getQuotaUsage.mockResolvedValue(mockQuotaUsage);

      const result = await controller.getQuota(organizationId);

      expect(result).toEqual(mockQuotaUsage);
      expect(mockBillingService.getQuotaUsage).toHaveBeenCalledWith(organizationId);
    });

    it('should return zero usage for new organization', async () => {
      const emptyQuota = { screenQuota: 5, screensUsed: 0, remaining: 5, percentUsed: 0 };
      mockBillingService.getQuotaUsage.mockResolvedValue(emptyQuota);

      const result = await controller.getQuota(organizationId);

      expect(result.screensUsed).toBe(0);
      expect(result.percentUsed).toBe(0);
    });
  });
});
