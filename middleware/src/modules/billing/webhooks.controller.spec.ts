import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { BillingService } from './billing.service';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let mockBillingService: jest.Mocked<BillingService>;

  beforeEach(async () => {
    mockBillingService = {
      handleWebhookEvent: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [{ provide: BillingService, useValue: mockBillingService }],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleStripeWebhook', () => {
    it('should pass raw body and signature to service', async () => {
      const rawBody = Buffer.from('{"test": "data"}');
      const signature = 'sig_test_123';
      const mockReq = {
        rawBody,
      } as RawBodyRequest<Request>;

      mockBillingService.handleWebhookEvent.mockResolvedValue({ received: true });

      const result = await controller.handleStripeWebhook(mockReq, signature);

      expect(mockBillingService.handleWebhookEvent).toHaveBeenCalledWith('stripe', {
        rawBody,
        signature,
      });
      expect(result).toEqual({ received: true });
    });

    it('should throw error when raw body is not available', async () => {
      const mockReq = {
        rawBody: undefined,
      } as RawBodyRequest<Request>;
      const signature = 'sig_test_123';

      await expect(controller.handleStripeWebhook(mockReq, signature)).rejects.toThrow(
        'Raw body not available',
      );
      expect(mockBillingService.handleWebhookEvent).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const rawBody = Buffer.from('{"test": "data"}');
      const signature = 'invalid_sig';
      const mockReq = {
        rawBody,
      } as RawBodyRequest<Request>;

      mockBillingService.handleWebhookEvent.mockRejectedValue(new Error('Invalid signature'));

      await expect(controller.handleStripeWebhook(mockReq, signature)).rejects.toThrow(
        'Invalid signature',
      );
    });

    it('should handle subscription.updated webhook event', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          type: 'customer.subscription.updated',
          data: {
            object: { id: 'sub_123', status: 'active' },
          },
        }),
      );
      const signature = 'sig_valid';
      const mockReq = { rawBody } as RawBodyRequest<Request>;

      mockBillingService.handleWebhookEvent.mockResolvedValue({ received: true, type: 'customer.subscription.updated' });

      const result = await controller.handleStripeWebhook(mockReq, signature);

      expect(result.type).toBe('customer.subscription.updated');
    });
  });

  describe('handleRazorpayWebhook', () => {
    it('should pass raw body and signature to service', async () => {
      const rawBody = Buffer.from('{"test": "data"}');
      const signature = 'razorpay_sig_123';
      const mockReq = {
        rawBody,
      } as RawBodyRequest<Request>;

      mockBillingService.handleWebhookEvent.mockResolvedValue({ received: true });

      const result = await controller.handleRazorpayWebhook(mockReq, signature);

      expect(mockBillingService.handleWebhookEvent).toHaveBeenCalledWith('razorpay', {
        rawBody,
        signature,
      });
      expect(result).toEqual({ received: true });
    });

    it('should throw error when raw body is not available', async () => {
      const mockReq = {
        rawBody: undefined,
      } as RawBodyRequest<Request>;
      const signature = 'razorpay_sig_123';

      await expect(controller.handleRazorpayWebhook(mockReq, signature)).rejects.toThrow(
        'Raw body not available',
      );
      expect(mockBillingService.handleWebhookEvent).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const rawBody = Buffer.from('{"test": "data"}');
      const signature = 'invalid_sig';
      const mockReq = {
        rawBody,
      } as RawBodyRequest<Request>;

      mockBillingService.handleWebhookEvent.mockRejectedValue(new Error('Invalid signature'));

      await expect(controller.handleRazorpayWebhook(mockReq, signature)).rejects.toThrow(
        'Invalid signature',
      );
    });

    it('should handle subscription.charged event', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          event: 'subscription.charged',
          payload: {
            subscription: { id: 'sub_razorpay_123' },
          },
        }),
      );
      const signature = 'razorpay_sig_valid';
      const mockReq = { rawBody } as RawBodyRequest<Request>;

      mockBillingService.handleWebhookEvent.mockResolvedValue({ received: true, type: 'subscription.charged' });

      const result = await controller.handleRazorpayWebhook(mockReq, signature);

      expect(result.type).toBe('subscription.charged');
    });
  });
});
