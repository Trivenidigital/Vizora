import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import {
  PaymentProvider,
  Customer,
  CheckoutParams,
  Subscription,
  Invoice,
  WebhookEvent,
} from './payment-provider.interface';

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;
  private readonly razorpay: Razorpay;
  private readonly logger = new Logger(RazorpayProvider.name);
  private readonly webhookSecret: string;
  private readonly keyId: string;

  constructor(private readonly configService: ConfigService) {
    this.keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || '';
    const keySecret =
      this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';

    if (!this.keyId || !keySecret) {
      this.logger.warn('Razorpay credentials not configured');
    }

    this.razorpay = new Razorpay({
      key_id: this.keyId,
      key_secret: keySecret,
    });
    this.webhookSecret =
      this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') || '';
  }

  async createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, any>,
  ): Promise<Customer> {
    const customer = await this.razorpay.customers.create({
      name,
      email,
      notes: metadata || {},
    });
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      metadata: customer.notes,
    };
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const customer = await this.razorpay.customers.fetch(customerId);
      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        metadata: customer.notes,
      };
    } catch {
      return null;
    }
  }

  async createCheckoutSession(
    params: CheckoutParams,
  ): Promise<{ url: string; sessionId: string }> {
    // Razorpay uses subscriptions directly, not checkout sessions
    // Create a subscription and return the short_url for hosted checkout
    const subscription = await this.razorpay.subscriptions.create({
      plan_id: params.priceId,
      customer_id: params.customerId,
      total_count: 12, // 12 billing cycles
      notes: params.metadata || {},
    });

    return {
      url: subscription.short_url,
      sessionId: subscription.id,
    };
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      const sub = await this.razorpay.subscriptions.fetch(subscriptionId);
      return this.mapSubscription(sub);
    } catch {
      return null;
    }
  }

  async updateSubscription(
    subscriptionId: string,
    priceId: string,
  ): Promise<Subscription> {
    // Razorpay requires canceling and creating new subscription for plan changes
    // For now, update the plan_id (limited support in Razorpay API)
    const sub = await this.razorpay.subscriptions.update(subscriptionId, {
      plan_id: priceId,
    });
    return this.mapSubscription(sub);
  }

  async cancelSubscription(
    subscriptionId: string,
    immediately = false,
  ): Promise<void> {
    await this.razorpay.subscriptions.cancel(subscriptionId, immediately);
  }

  async getInvoices(customerId: string, limit = 10): Promise<Invoice[]> {
    // Razorpay uses "invoices" for subscriptions
    const invoices = await this.razorpay.invoices.all({
      customer_id: customerId,
      count: limit,
    });

    return (invoices.items || []).map((inv: any) => ({
      id: inv.id,
      customerId: inv.customer_id,
      subscriptionId: inv.subscription_id || null,
      amount: inv.amount, // Razorpay amount is in paise
      currency: inv.currency,
      status: this.mapInvoiceStatus(inv.status),
      description: inv.description || null,
      pdfUrl: inv.short_url || null,
      createdAt: new Date(inv.created_at * 1000),
    }));
  }

  verifyWebhookSignature(payload: Buffer, signature: string): WebhookEvent {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid webhook signature');
    }

    const event = JSON.parse(payload.toString());
    return {
      type: event.event,
      data: event.payload,
    };
  }

  private mapSubscription(sub: any): Subscription {
    const statusMap: Record<string, Subscription['status']> = {
      created: 'incomplete',
      authenticated: 'incomplete',
      active: 'active',
      pending: 'past_due',
      halted: 'past_due',
      cancelled: 'canceled',
      completed: 'canceled',
      expired: 'canceled',
    };

    return {
      id: sub.id,
      customerId: sub.customer_id,
      status: statusMap[sub.status] || 'incomplete',
      currentPeriodStart: new Date(sub.current_start * 1000),
      currentPeriodEnd: new Date(sub.current_end * 1000),
      cancelAtPeriodEnd: sub.status === 'pending' || sub.ended_at != null,
      priceId: sub.plan_id,
      metadata: sub.notes,
    };
  }

  private mapInvoiceStatus(status: string): Invoice['status'] {
    const statusMap: Record<string, Invoice['status']> = {
      draft: 'draft',
      issued: 'open',
      paid: 'paid',
      cancelled: 'void',
      expired: 'void',
      partially_paid: 'open',
    };
    return statusMap[status] || 'draft';
  }
}
