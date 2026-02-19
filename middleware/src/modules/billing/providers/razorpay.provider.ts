import { Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
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
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';

const RAZORPAY_CIRCUIT_CONFIG = {
  failureThreshold: 3,
  resetTimeout: 10000,
};

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;
  private readonly razorpay: Razorpay | null = null;
  private readonly logger = new Logger(RazorpayProvider.name);
  private readonly webhookSecret: string;
  private readonly keyId: string;
  private readonly isConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly circuitBreaker?: CircuitBreakerService,
  ) {
    this.keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || '';
    const keySecret =
      this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';

    this.isConfigured = !!(this.keyId && keySecret);
    if (!this.isConfigured) {
      this.logger.warn('Razorpay credentials not configured - Razorpay payments disabled');
    } else {
      this.razorpay = new Razorpay({
        key_id: this.keyId,
        key_secret: keySecret,
      });
    }
    this.webhookSecret =
      this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') || '';
  }

  private ensureConfigured(): void {
    if (!this.razorpay) {
      throw new ServiceUnavailableException('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
    }
  }

  private async withCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.circuitBreaker) {
      return fn();
    }
    return this.circuitBreaker.execute('razorpay-api', fn, RAZORPAY_CIRCUIT_CONFIG);
  }

  async createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, any>,
  ): Promise<Customer> {
    this.ensureConfigured();
    const customer = await this.withCircuitBreaker(() =>
      this.razorpay!.customers.create({
        name,
        email,
        notes: metadata || {},
      }),
    );
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      metadata: customer.notes,
    };
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    this.ensureConfigured();
    try {
      const customer = await this.withCircuitBreaker(() =>
        this.razorpay!.customers.fetch(customerId),
      );
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
    this.ensureConfigured();
    const subscription = await this.withCircuitBreaker(() =>
      this.razorpay!.subscriptions.create({
        plan_id: params.priceId,
        customer_id: params.customerId,
        total_count: 12,
        notes: params.metadata || {},
      }),
    );

    return {
      url: subscription.short_url,
      sessionId: subscription.id,
    };
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    this.ensureConfigured();
    try {
      const sub = await this.withCircuitBreaker(() =>
        this.razorpay!.subscriptions.fetch(subscriptionId),
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
      this.razorpay!.subscriptions.update(subscriptionId, {
        plan_id: priceId,
      }),
    );
    return this.mapSubscription(sub);
  }

  async cancelSubscription(
    subscriptionId: string,
    immediately = false,
  ): Promise<void> {
    this.ensureConfigured();
    await this.withCircuitBreaker(() =>
      this.razorpay!.subscriptions.cancel(subscriptionId, immediately),
    );
  }

  async getInvoices(customerId: string, limit = 10): Promise<Invoice[]> {
    this.ensureConfigured();
    const invoices = await this.withCircuitBreaker(() =>
      this.razorpay!.invoices.all({
        customer_id: customerId,
        count: limit,
      }),
    );

    return (invoices.items || []).map((inv: any) => ({
      id: inv.id,
      customerId: inv.customer_id,
      subscriptionId: inv.subscription_id || null,
      amount: inv.amount,
      currency: inv.currency,
      status: this.mapInvoiceStatus(inv.status),
      description: inv.description || null,
      pdfUrl: inv.short_url || null,
      createdAt: new Date(inv.created_at * 1000),
    }));
  }

  verifyWebhookSignature(payload: Buffer, signature: string): WebhookEvent {
    if (!this.webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    if (!signature || typeof signature !== 'string') {
      throw new Error('Missing or invalid webhook signature');
    }

    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
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
