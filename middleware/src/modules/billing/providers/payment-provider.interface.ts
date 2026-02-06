export interface Customer {
  id: string;
  email: string;
  name: string;
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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

export interface WebhookEvent {
  type: string;
  data: any;
}

export interface PaymentProvider {
  readonly name: 'stripe' | 'razorpay';

  // Customer management
  createCustomer(email: string, name: string, metadata?: Record<string, any>): Promise<Customer>;
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
