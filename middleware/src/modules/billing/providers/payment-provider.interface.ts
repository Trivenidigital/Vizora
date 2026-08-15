export interface Customer {
  id: string;
  email: string;
  name: string;
  metadata?: Record<string, unknown>;
}

export interface CheckoutParams {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface Subscription {
  id: string;
  customerId: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  priceId: string;
  /**
   * Normalized billing interval of the subscription's price
   * (Stripe price `recurring.interval`: month → 'monthly', year → 'yearly').
   * Undefined when the provider does not expose it or the interval is neither
   * monthly nor yearly. Consumers must NOT default a missing interval to a
   * concrete value on a re-bill path — an unknown interval means "refuse and
   * surface" rather than "assume monthly".
   */
  interval?: 'monthly' | 'yearly';
  metadata?: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  description: string | null;
  pdfUrl: string | null;
  createdAt: Date;
}

/** Webhook event data from payment providers — deeply nested untyped objects */
export interface WebhookEventData {
  [key: string]: WebhookEventData | string | number | boolean | null | undefined;
}

export interface WebhookEvent {
  type: string;
  data: WebhookEventData;
  /**
   * Stable, provider-issued event identifier for idempotency/replay dedup.
   * Stripe: the `evt_...` event id. Razorpay: a content hash of the signed
   * payload (Razorpay has no top-level event id in the body), which is stable
   * across delivery retries but distinct across genuinely different events.
   */
  id: string;
  /**
   * When the PROVIDER emitted this event (Stripe `event.created`, Razorpay
   * top-level `created_at` — both unix SECONDS). Used only to order entitlement
   * writes against `Organization.billingEventAt` so a retried older event cannot
   * overwrite newer state.
   *
   * NOT an idempotency key: it is not unique (two events can share a second),
   * and it is distinct from the entity's own `created_at`. Dedup is `id`.
   * Optional — a provider that does not supply one simply gets no ordering
   * guard, never a fabricated timestamp.
   */
  createdAt?: Date;
}

export interface PaymentProvider {
  readonly name: 'stripe' | 'razorpay';

  // Customer management
  createCustomer(email: string, name: string, metadata?: Record<string, unknown>): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer | null>;

  // Subscription management
  createCheckoutSession(params: CheckoutParams): Promise<{ url: string; sessionId: string }>;
  getSubscription(subscriptionId: string): Promise<Subscription | null>;
  updateSubscription(subscriptionId: string, priceId: string): Promise<Subscription>;
  cancelSubscription(subscriptionId: string, immediately?: boolean): Promise<void>;

  // Billing portal (Stripe-only, optional)
  createBillingPortalSession?(customerId: string, returnUrl: string): Promise<{ url: string }>;

  // Invoices
  getInvoices(customerId: string, limit?: number): Promise<Invoice[]>;

  // Webhooks
  verifyWebhookSignature(payload: Buffer, signature: string): WebhookEvent;
}
