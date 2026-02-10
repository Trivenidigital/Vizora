import { Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentProvider,
  Customer,
  CheckoutParams,
  Subscription,
  Invoice,
  WebhookEvent,
} from './payment-provider.interface';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';

const STRIPE_CIRCUIT_CONFIG = {
  failureThreshold: 3,
  resetTimeout: 10000,
};

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  private readonly stripe: Stripe | null = null;
  private readonly logger = new Logger(StripeProvider.name);
  private readonly webhookSecret: string;
  private readonly isConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly circuitBreaker?: CircuitBreakerService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.isConfigured = !!secretKey;
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured - Stripe payments disabled');
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-01-27.acacia',
      });
    }
    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
  }

  private ensureConfigured(): void {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
    }
  }

  private async withCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.circuitBreaker) {
      return fn();
    }
    return this.circuitBreaker.execute('stripe-api', fn, STRIPE_CIRCUIT_CONFIG);
  }

  async createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, any>,
  ): Promise<Customer> {
    this.ensureConfigured();
    const customer = await this.withCircuitBreaker(() =>
      this.stripe!.customers.create({ email, name, metadata }),
    );
    return {
      id: customer.id,
      email: customer.email || email,
      name: customer.name || name,
      metadata: customer.metadata,
    };
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    this.ensureConfigured();
    try {
      const customer = await this.withCircuitBreaker(() =>
        this.stripe!.customers.retrieve(customerId),
      );
      if (customer.deleted) return null;
      return {
        id: customer.id,
        email: customer.email || '',
        name: customer.name || '',
        metadata: customer.metadata,
      };
    } catch {
      return null;
    }
  }

  async createCheckoutSession(
    params: CheckoutParams,
  ): Promise<{ url: string; sessionId: string }> {
    this.ensureConfigured();
    const session = await this.withCircuitBreaker(() =>
      this.stripe!.checkout.sessions.create({
        customer: params.customerId,
        mode: 'subscription',
        line_items: [{ price: params.priceId, quantity: 1 }],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata,
      }),
    );
    return { url: session.url!, sessionId: session.id };
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    this.ensureConfigured();
    try {
      const sub = await this.withCircuitBreaker(() =>
        this.stripe!.subscriptions.retrieve(subscriptionId),
      );
      return this.mapSubscription(sub);
    } catch {
      return null;
    }
  }

  async updateSubscription(
    subscriptionId: string,
    priceId: string,
  ): Promise<Subscription> {
    this.ensureConfigured();
    const sub = await this.withCircuitBreaker(() =>
      this.stripe!.subscriptions.retrieve(subscriptionId),
    );
    const updated = await this.withCircuitBreaker(() =>
      this.stripe!.subscriptions.update(subscriptionId, {
        items: [{ id: sub.items.data[0].id, price: priceId }],
        proration_behavior: 'create_prorations',
      }),
    );
    return this.mapSubscription(updated);
  }

  async cancelSubscription(
    subscriptionId: string,
    immediately = false,
  ): Promise<void> {
    this.ensureConfigured();
    if (immediately) {
      await this.withCircuitBreaker(() =>
        this.stripe!.subscriptions.cancel(subscriptionId),
      );
    } else {
      await this.withCircuitBreaker(() =>
        this.stripe!.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        }),
      );
    }
  }

  async createBillingPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    this.ensureConfigured();
    const session = await this.withCircuitBreaker(() =>
      this.stripe!.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      }),
    );
    return { url: session.url };
  }

  async getInvoices(customerId: string, limit = 10): Promise<Invoice[]> {
    this.ensureConfigured();
    const invoices = await this.withCircuitBreaker(() =>
      this.stripe!.invoices.list({ customer: customerId, limit }),
    );
    return invoices.data.map((inv) => ({
      id: inv.id,
      customerId:
        typeof inv.customer === 'string' ? inv.customer : inv.customer?.id || '',
      subscriptionId:
        typeof inv.subscription === 'string'
          ? inv.subscription
          : inv.subscription?.id || null,
      amount: inv.amount_paid,
      currency: inv.currency,
      status: inv.status as Invoice['status'],
      description: inv.description,
      pdfUrl: inv.invoice_pdf,
      createdAt: new Date(inv.created * 1000),
    }));
  }

  verifyWebhookSignature(payload: Buffer, signature: string): WebhookEvent {
    this.ensureConfigured();
    const event = this.stripe!.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );
    return {
      type: event.type,
      data: event.data.object,
    };
  }

  private mapSubscription(sub: Stripe.Subscription): Subscription {
    return {
      id: sub.id,
      customerId:
        typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      status: sub.status as Subscription['status'],
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      priceId: sub.items.data[0]?.price.id || '',
      metadata: sub.metadata,
    };
  }
}
