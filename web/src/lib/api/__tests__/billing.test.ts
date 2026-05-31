import { ApiClient } from '../client';
import '../billing';

describe('billing api methods', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'vizora_csrf_token=test-csrf',
    });
    global.fetch = jest.fn();
  });

  it('normalizes checkoutUrl responses to the url property used by billing pages', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          checkoutUrl: 'https://checkout.stripe.com/session',
          sessionId: 'cs_test_123',
        },
      }),
    });

    const client = new ApiClient('/api/v1');

    await expect(client.createCheckout('basic', 'monthly')).resolves.toEqual({
      url: 'https://checkout.stripe.com/session',
      sessionId: 'cs_test_123',
    });
  });

  it('normalizes portalUrl responses to the url property used by billing pages', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          portalUrl: 'https://billing.stripe.com/session',
        },
      }),
    });

    const client = new ApiClient('/api/v1');

    await expect(client.getBillingPortalUrl('https://app.example.test/billing')).resolves.toEqual({
      url: 'https://billing.stripe.com/session',
    });
  });
});
