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
  WebhookEventData,
} from './payment-provider.interface';
import { BillingInterval } from '../constants/plans';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';

const RAZORPAY_CIRCUIT_CONFIG = {
  failureThreshold: 3,
  resetTimeout: 10000,
};

/**
 * How many billing cycles a new Razorpay subscription is created with (B3b).
 *
 * VIZORA SELLS RECURRING-UNTIL-CANCELLED. The plans page answers the question
 * literally — "Is there a contract or commitment? / No, all plans are
 * pay-as-you-go with no long-term contracts. You can cancel at any time."
 * (`web/src/app/dashboard/settings/billing/plans/page.tsx:181-184`); billing
 * settings shows an unconditional "Renews <date>" with no cycle counter, and the
 * refund policy describes termination as exclusively customer-initiated. Nothing
 * anywhere in the product promises a fixed term.
 *
 * This value used to be a bare `total_count: 12` with no comment, constant, doc
 * or rationale behind it. Twelve cycles is a ONE-YEAR TERM: a monthly subscriber
 * would have been quietly moved to Razorpay's `completed` state after 12 charges
 * and stopped being billed while still using Vizora.
 *
 * WHY A COMPUTED BOUND RATHER THAN A NUMBER WE PICK:
 * Razorpay has NO perpetual/until-cancelled primitive — every subscription is
 * bounded, and the API requires exactly one of `total_count` or `end_at`. So the
 * contract cannot be expressed exactly; the closest honest encoding is a bound
 * far beyond any real customer lifetime, taken from Razorpay's own published
 * figures rather than invented. Their documented maximum is self-contradictory
 * (one page says 30 years, another 100), so:
 *   - monthly: 1200 — the only ceiling Razorpay's docs actually COMPUTE, in
 *     their own monthly worked example.
 *   - yearly:  30 — no yearly example is computed anywhere, so this takes the
 *     CONSERVATIVE side of the 30-vs-100-year contradiction: 30 cycles = 30
 *     years.
 * Both bounds are ≥ 30 years of continuous service.
 *
 * THE BOUND MUST NEVER BE REACHED. Razorpay's `completed` state is TERMINAL and
 * unrecoverable: `PATCH /v1/subscriptions/:id` refuses with "Can't update
 * Subscription when Subscription is not in Authenticated or Active state", and
 * there is no revival API. A subscription that exhausts its count cannot be
 * extended, only replaced by making the customer subscribe again.
 *
 * Creation time is also the ONLY lever for some customers: `remaining_count`
 * PATCH is refused outright for UPI/eMandate payment modes ("Subscriptions
 * cannot be updated when payment mode is UPI/emandate"), which is the second
 * reason to set the bound high here rather than plan on raising it later.
 *
 * NOT YET VERIFIED AGAINST A LIVE RAZORPAY ACCOUNT — no Razorpay credentials
 * exist in any Vizora environment today, so nothing on this path has ever run.
 * The pre-launch test-mode checklist (which webhooks fire at exhaustion, whether
 * a count above 12 is accepted for every interval, where the real ceiling is) is
 * in the PR that introduced this and in `backlog.md`.
 */
const RAZORPAY_TOTAL_COUNT_BY_INTERVAL: Record<BillingInterval, number> = {
  monthly: 1200,
  yearly: 30,
};

/**
 * The `total_count` to create a Razorpay subscription with for a given billing
 * interval. See RAZORPAY_TOTAL_COUNT_BY_INTERVAL above for the derivation.
 */
export const razorpaySubscriptionTotalCount = (interval: BillingInterval): number =>
  RAZORPAY_TOTAL_COUNT_BY_INTERVAL[interval];

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
    metadata?: Record<string, unknown>,
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
        // Derived from the SAME interval that resolved params.priceId, so the
        // cycle count can never describe a different cadence than the plan.
        total_count: razorpaySubscriptionTotalCount(params.interval),
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

    return (invoices.items || []).map((inv: { id: string; customer_id: string; subscription_id?: string; amount: number; currency: string; status: string; description?: string; short_url?: string; created_at: number }) => ({
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
    // Razorpay nests each entity under payload.<entity>.entity (e.g.
    // payload.subscription.entity, payload.payment.entity, payload.invoice.entity),
    // whereas the billing webhook handlers read data.subscription.customer_id /
    // data.payment.amount / data.invoice.customer_id directly. Unwrap the .entity
    // layer here — otherwise customerId/amount resolve to undefined and every
    // Razorpay money event is silently dropped (billing #6).
    const rawPayload: Record<string, unknown> = event.payload ?? {};
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawPayload)) {
      data[key] =
        value && typeof value === 'object' && 'entity' in value
          ? (value as { entity: unknown }).entity
          : value;
    }
    return {
      // Razorpay has no top-level event id in the body; derive a stable id from
      // the signed payload. Retries of the same event carry an identical body →
      // identical hash → deduped; genuinely different events differ → not deduped.
      id: `rzp_${crypto.createHash('sha256').update(payload).digest('hex').slice(0, 40)}`,
      type: event.event,
      data: data as WebhookEventData,
      // Top-level `created_at` is the EVENT emission time in unix SECONDS — a
      // different field from each entity's own created_at. It is not unique
      // (Razorpay can emit several events in the same second), so it orders
      // entitlement writes and is never used for dedup.
      createdAt:
        typeof event.created_at === 'number' && Number.isFinite(event.created_at)
          ? new Date(event.created_at * 1000)
          : undefined,
    };
  }

  private mapSubscription(sub: { id: string; customer_id: string; status: string; current_start: number; current_end: number; ended_at?: number | null; plan_id: string; notes?: Record<string, unknown> }): Subscription {
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
