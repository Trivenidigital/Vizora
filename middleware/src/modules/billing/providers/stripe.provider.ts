import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeProvider.name);
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured');
    }
    this.stripe = new Stripe(secretKey || '', {
      apiVersion: '2025-01-27.acacia',
    });
    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
  }

  async createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, any>,
  ): Promise<Customer> {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata,
    });
    return {
      id: customer.id,
      email: customer.email || email,
      name: customer.name || name,
      metadata: customer.metadata,
    };
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
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
    const session = await this.stripe.checkout.sessions.create({
      customer: params.customerId,
      mode: 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });
    return { url: session.url!, sessionId: session.id };
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
      return this.mapSubscription(sub);
    } catch {
      return null;
    }
  }

  async updateSubscription(
    subscriptionId: string,
    priceId: string,
  ): Promise<Subscription> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    const updated = await this.stripe.subscriptions.update(subscriptionId, {
      items: [{ id: sub.items.data[0].id, price: priceId }],
      proration_behavior: 'create_prorations',
    });
    return this.mapSubscription(updated);
  }

  async cancelSubscription(
    subscriptionId: string,
    immediately = false,
  ): Promise<void> {
    if (immediately) {
      await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  async createBillingPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  async getInvoices(customerId: string, limit = 10): Promise<Invoice[]> {
    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit,
    });
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
    const event = this.stripe.webhooks.constructEvent(
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
