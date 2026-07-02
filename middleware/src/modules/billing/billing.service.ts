import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { StripeProvider } from './providers/stripe.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import {
  PaymentProvider,
  Subscription,
  WebhookEvent,
} from './providers/payment-provider.interface';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import {
  SubscriptionStatusResponse,
  PlanResponse,
  QuotaResponse,
  InvoiceResponse,
  CheckoutSessionResponse,
  BillingPortalResponse,
} from './dto/billing-response.dto';
import {
  PLAN_TIERS,
  getScreenQuotaForTier,
  getStripePriceId,
  getRazorpayPlanId,
} from './constants/plans';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';

/** Webhook event data from Stripe/Razorpay — deeply nested untyped objects */
interface WebhookData {
  [key: string]: WebhookData | string | number | boolean | null | undefined;
}

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly stripeProvider: StripeProvider,
    private readonly razorpayProvider: RazorpayProvider,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Validate at startup that price/plan IDs are configured for every
   * paid tier in PLAN_TIERS. Default behavior: warn. Hard-fail only
   * when `BILLING_VALIDATION_STRICT=true` — that's a deliberate opt-in
   * for environments that actually have paid plans wired up (Stripe/
   * Razorpay products created, customers actively subscribing).
   *
   * Hotfix rationale: an earlier version of this method threw in any
   * `NODE_ENV=production` boot, which crashed prod the moment the
   * commit landed — prod was running free-tier-only at the time and
   * had never needed the env vars. The validation is still useful
   * (catches misconfig before a customer hits checkout), but the
   * blast radius of forced-fail-at-boot is too large to default to.
   * Opt in once the org's billing path is live.
   */
  onModuleInit(): void {
    const missing: string[] = [];
    for (const [tierId, tier] of Object.entries(PLAN_TIERS)) {
      const isPaidTier =
        tier.prices.usd.monthly > 0 || tier.prices.inr.monthly > 0;
      if (!isPaidTier) continue;
      for (const interval of ['monthly', 'yearly'] as const) {
        const stripeKey = `STRIPE_${tierId.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`;
        if (!process.env[stripeKey]) missing.push(stripeKey);
      }
      const razorpayKey = `RAZORPAY_${tierId.toUpperCase()}_PLAN_ID`;
      if (!process.env[razorpayKey]) missing.push(razorpayKey);
    }

    if (missing.length === 0) {
      this.logger.log(
        `Billing price IDs validated for ${Object.keys(PLAN_TIERS).length} tier(s)`,
      );
      return;
    }

    const summary = `Missing billing price/plan env vars: ${missing.join(', ')}`;
    if (process.env.BILLING_VALIDATION_STRICT === 'true') {
      this.logger.error(summary);
      throw new Error(summary);
    }
    this.logger.warn(
      `${summary} (warn-only; set BILLING_VALIDATION_STRICT=true to fail boot)`,
    );
  }

  /**
   * Get the appropriate payment provider for an organization
   */
  private getProvider(paymentProvider: string | null): PaymentProvider {
    if (paymentProvider === 'razorpay') {
      return this.razorpayProvider;
    }
    return this.stripeProvider;
  }

  /**
   * Determine the default payment provider based on country
   */
  private getDefaultProviderForCountry(country: string | null): 'stripe' | 'razorpay' {
    // Use Razorpay for India, Stripe for all other countries
    return country === 'IN' ? 'razorpay' : 'stripe';
  }

  /**
   * Get subscription status for an organization
   */
  async getSubscriptionStatus(organizationId: string): Promise<SubscriptionStatusResponse> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: { displays: true },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // If there's an active subscription, fetch details from the provider
    let currentPeriodEnd: string | null = null;
    let cancelAtPeriodEnd = false;

    const subscriptionId = org.stripeSubscriptionId || org.razorpaySubscriptionId;
    if (subscriptionId && org.paymentProvider) {
      const provider = this.getProvider(org.paymentProvider);
      const subscription = await provider.getSubscription(subscriptionId);
      if (subscription) {
        currentPeriodEnd = subscription.currentPeriodEnd.toISOString();
        cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
      }
    }

    return {
      subscriptionTier: org.subscriptionTier,
      subscriptionStatus: org.subscriptionStatus,
      screenQuota: org.screenQuota,
      screensUsed: org._count.displays,
      trialEndsAt: org.trialEndsAt?.toISOString() || null,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      paymentProvider: org.paymentProvider,
    };
  }

  /**
   * Get available plans with pricing for a country
   */
  async getPlans(
    organizationId: string,
    country?: string,
    interval: 'monthly' | 'yearly' = 'monthly',
  ): Promise<PlanResponse[]> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionTier: true, country: true },
    });

    const effectiveCountry = country || org?.country || 'US';
    const currency = effectiveCountry === 'IN' ? 'inr' : 'usd';
    const currentTier = org?.subscriptionTier || 'free';

    return Object.values(PLAN_TIERS).map((plan) => {
      const priceData = plan.prices[currency];
      const price = interval === 'monthly' ? priceData.monthly : priceData.yearly;

      return {
        id: plan.id,
        name: plan.name,
        screenQuota: plan.screenQuota,
        price,
        currency,
        interval,
        features: plan.features,
        isCurrent: plan.id === currentTier,
      };
    });
  }

  /**
   * Get quota usage for an organization
   */
  async getQuotaUsage(organizationId: string): Promise<QuotaResponse> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: { displays: true },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const screenQuota = org.screenQuota;
    const screensUsed = org._count.displays;
    const remaining = screenQuota === -1 ? -1 : Math.max(0, screenQuota - screensUsed);
    const percentUsed = screenQuota === -1 ? 0 : Math.round((screensUsed / screenQuota) * 100);

    return {
      screenQuota,
      screensUsed,
      remaining,
      percentUsed,
    };
  }

  /**
   * Create a checkout session for subscription purchase
   */
  async createCheckoutSession(
    organizationId: string,
    dto: CreateCheckoutDto,
  ): Promise<CheckoutSessionResponse> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          where: { role: 'admin' },
          take: 1,
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const plan = PLAN_TIERS[dto.planId];
    if (!plan || plan.prices.usd.monthly === 0 || plan.prices.usd.monthly === -1) {
      throw new BadRequestException('Invalid plan for checkout');
    }

    // Determine provider based on org's country
    const providerType = this.getDefaultProviderForCountry(org.country);
    const provider = this.getProvider(providerType);

    // Get or create customer
    const customerEmail = org.billingEmail || org.users[0]?.email;
    if (!customerEmail) {
      throw new BadRequestException('No billing email found for organization');
    }

    let customerId = providerType === 'stripe' ? org.stripeCustomerId : org.razorpayCustomerId;

    if (!customerId) {
      const customer = await provider.createCustomer(customerEmail, org.name, {
        organizationId: org.id,
      });
      customerId = customer.id;

      // Save customer ID
      await this.db.organization.update({
        where: { id: organizationId },
        data:
          providerType === 'stripe'
            ? { stripeCustomerId: customerId, paymentProvider: 'stripe' }
            : { razorpayCustomerId: customerId, paymentProvider: 'razorpay' },
      });
    }

    // Determine the price/plan ID based on interval and provider
    const priceId =
      providerType === 'stripe'
        ? getStripePriceId(dto.planId, dto.interval)
        : getRazorpayPlanId(dto.planId);

    if (!priceId) {
      const currency = org.country === 'IN' ? 'inr' : 'usd';
      throw new BadRequestException(`Price not configured for ${dto.planId} (${currency})`);
    }

    const baseUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3001';
    const successUrl = dto.successUrl || `${baseUrl}/dashboard/settings/billing/success`;
    const cancelUrl = dto.cancelUrl || `${baseUrl}/dashboard/settings/billing/cancel`;

    const result = await provider.createCheckoutSession({
      customerId,
      priceId,
      successUrl,
      cancelUrl,
      metadata: {
        organizationId,
        planId: dto.planId,
        interval: dto.interval,
      },
    });

    return {
      checkoutUrl: result.url,
      sessionId: result.sessionId,
    };
  }

  /**
   * Update subscription (change plan or set cancelAtPeriodEnd)
   */
  async updateSubscription(
    organizationId: string,
    dto: UpdateSubscriptionDto,
  ): Promise<SubscriptionStatusResponse> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const subscriptionId = org.stripeSubscriptionId || org.razorpaySubscriptionId;
    if (!subscriptionId || !org.paymentProvider) {
      throw new BadRequestException('No active subscription found');
    }

    const provider = this.getProvider(org.paymentProvider);

    // Handle plan change
    if (dto.planId && dto.planId !== org.subscriptionTier) {
      const plan = PLAN_TIERS[dto.planId];
      if (!plan) {
        throw new BadRequestException('Invalid plan');
      }

      // Get price ID from environment at runtime
      const priceId =
        org.paymentProvider === 'stripe'
          ? getStripePriceId(dto.planId, 'monthly') // Default to monthly for upgrades
          : getRazorpayPlanId(dto.planId);

      if (!priceId) {
        throw new BadRequestException(`Price not configured for ${dto.planId}`);
      }

      await provider.updateSubscription(subscriptionId, priceId);

      // Update organization with new tier, screen quota, and storage quota
      // Wrapped in $transaction to ensure atomicity of local DB changes
      const tierConfig = PLAN_TIERS[dto.planId];
      try {
        await this.db.$transaction(async (tx) => {
          await tx.organization.update({
            where: { id: organizationId },
            data: {
              subscriptionTier: dto.planId,
              screenQuota: getScreenQuotaForTier(dto.planId),
              ...(tierConfig?.storageQuotaMb
                ? { storageQuotaBytes: BigInt(tierConfig.storageQuotaMb * 1024 * 1024) }
                : {}),
            },
          });
        });
      } catch (dbError) {
        this.logger.error(
          `DB update failed after Stripe subscription change (org: ${organizationId}, stripe sub: ${subscriptionId}). Manual reconciliation needed.`,
          dbError,
        );
        throw dbError;
      }
    }

    // Handle cancel at period end (Stripe-specific)
    if (
      dto.cancelAtPeriodEnd !== undefined &&
      org.paymentProvider === 'stripe' &&
      provider.createBillingPortalSession
    ) {
      if (dto.cancelAtPeriodEnd) {
        await provider.cancelSubscription(subscriptionId, false);
      }
      // Note: Reactivation is handled by reactivateSubscription method
    }

    return this.getSubscriptionStatus(organizationId);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    organizationId: string,
    immediately = false,
  ): Promise<SubscriptionStatusResponse> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          where: { role: 'admin' },
          take: 1,
          select: { email: true, firstName: true },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const subscriptionId = org.stripeSubscriptionId || org.razorpaySubscriptionId;
    if (!subscriptionId || !org.paymentProvider) {
      throw new BadRequestException('No active subscription found');
    }

    const provider = this.getProvider(org.paymentProvider);
    await provider.cancelSubscription(subscriptionId, immediately);

    if (immediately) {
      // Downgrade to free tier immediately
      await this.db.organization.update({
        where: { id: organizationId },
        data: {
          subscriptionTier: 'free',
          subscriptionStatus: 'canceled',
          screenQuota: getScreenQuotaForTier('free'),
          stripeSubscriptionId: org.paymentProvider === 'stripe' ? null : org.stripeSubscriptionId,
          razorpaySubscriptionId:
            org.paymentProvider === 'razorpay' ? null : org.razorpaySubscriptionId,
        },
      });
    } else {
      // Mark as pending cancellation
      await this.db.organization.update({
        where: { id: organizationId },
        data: {
          subscriptionStatus: 'canceled',
        },
      });
    }

    // Send cancellation confirmation email
    const admin = org.users[0];
    if (admin?.email) {
      try {
        // Get the period end for access-until date
        const status = await this.getSubscriptionStatus(organizationId);
        const accessUntil = status.currentPeriodEnd
          ? new Date(status.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : 'the end of your billing period';
        await this.mailService.sendSubscriptionCanceledEmail(
          admin.email,
          admin.firstName || admin.email.split('@')[0],
          accessUntil,
        );
      } catch (emailError) {
        this.logger.warn(`Failed to send cancellation email for org ${organizationId}: ${emailError}`);
      }
    }

    return this.getSubscriptionStatus(organizationId);
  }

  /**
   * Reactivate a subscription that was set to cancel at period end
   */
  async reactivateSubscription(organizationId: string): Promise<SubscriptionStatusResponse> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.paymentProvider !== 'stripe') {
      throw new BadRequestException('Reactivation only supported for Stripe subscriptions');
    }

    if (!org.stripeSubscriptionId) {
      throw new BadRequestException('No subscription found to reactivate');
    }

    // Use Stripe API to reactivate (remove cancel_at_period_end)
    const provider = this.stripeProvider;
    const subscription = await provider.getSubscription(org.stripeSubscriptionId);

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('Subscription is not scheduled for cancellation');
    }

    // Update subscription to remove cancellation
    await provider.updateSubscription(org.stripeSubscriptionId, subscription.priceId);

    await this.db.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: 'active',
      },
    });

    return this.getSubscriptionStatus(organizationId);
  }

  /**
   * Get billing portal URL for customer self-service (Stripe only)
   */
  async getBillingPortalUrl(
    organizationId: string,
    returnUrl: string,
  ): Promise<BillingPortalResponse> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (!org.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer found. Please subscribe first.');
    }

    const result = await this.stripeProvider.createBillingPortalSession(
      org.stripeCustomerId,
      returnUrl,
    );

    return { portalUrl: result.url };
  }

  /**
   * Get invoice history for an organization
   */
  async getInvoices(organizationId: string, limit = 10): Promise<InvoiceResponse[]> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const customerId = org.stripeCustomerId || org.razorpayCustomerId;
    if (!customerId || !org.paymentProvider) {
      // No invoices if no payment provider set up
      return [];
    }

    const provider = this.getProvider(org.paymentProvider);
    const invoices = await provider.getInvoices(customerId, limit);

    return invoices.map((inv) => ({
      id: inv.id,
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      description: inv.description,
      createdAt: inv.createdAt.toISOString(),
      pdfUrl: inv.pdfUrl,
    }));
  }

  /**
   * Handle webhook events from payment providers.
   * Verifies the webhook signature before processing events.
   */
  // Idempotency state machine (webhook dedup):
  //   absent   → claim it (write 'pending', short TTL), process
  //   pending  → someone else is processing (or crashed); skip this delivery.
  //              The short TTL means a crashed 'pending' auto-expires so a later
  //              PSP retry can re-enter — no permanent silent drop.
  //   completed→ genuinely processed; skip (true duplicate).
  // On a processing THROW we release the claim immediately so the retry re-enters
  // without waiting for the TTL. This closes the claim-then-crash silent-drop that
  // bare SET-NX-before-processing has (key set, processing fails, retry sees the
  // key and drops the event forever).
  private static readonly WEBHOOK_PENDING_TTL_S = 300; // 5 min — > max handler time
  private static readonly WEBHOOK_COMPLETED_TTL_S = 172800; // 48h — outlives retry burst

  private async claimWebhookEvent(
    idempotencyKey: string,
  ): Promise<'claimed' | 'duplicate'> {
    const client = this.redisService.getClient();
    if (!client) {
      // Fail-CLOSED: cannot guarantee idempotency → 5xx → PSP retries.
      throw new ServiceUnavailableException(
        'Idempotency store unavailable; webhook will be retried',
      );
    }
    const result = await client.set(
      idempotencyKey,
      'pending',
      'EX',
      BillingService.WEBHOOK_PENDING_TTL_S,
      'NX',
    );
    if (result === 'OK') return 'claimed';
    // Key exists: completed → real duplicate; pending → concurrent/crashed worker.
    // Either way we skip THIS delivery; a crashed pending self-heals via TTL.
    return 'duplicate';
  }

  private async completeWebhookEvent(idempotencyKey: string): Promise<void> {
    const client = this.redisService.getClient();
    if (!client) return; // best-effort; a stuck 'pending' expires and allows re-process
    await client.set(
      idempotencyKey,
      'completed',
      'EX',
      BillingService.WEBHOOK_COMPLETED_TTL_S,
    );
  }

  private async releaseWebhookClaim(idempotencyKey: string): Promise<void> {
    const client = this.redisService.getClient();
    if (!client) return;
    try {
      await client.del(idempotencyKey);
    } catch (err) {
      // Non-fatal: the pending TTL will expire and allow the retry to re-enter.
      this.logger.warn(`Failed to release webhook claim ${idempotencyKey}: ${err}`);
    }
  }

  async handleWebhookEvent(
    provider: 'stripe' | 'razorpay',
    rawEvent: { rawBody: Buffer; signature: string },
  ): Promise<{ received: boolean }> {
    const paymentProvider =
      provider === 'stripe' ? this.stripeProvider : this.razorpayProvider;

    // Verify signature and parse the event
    const event = paymentProvider.verifyWebhookSignature(
      rawEvent.rawBody,
      rawEvent.signature,
    );

    this.logger.log(`Processing ${provider} webhook: ${event.type} (${event.id})`);

    // Idempotency: skip duplicate events. Keyed on the provider EVENT id
    // (event.id) — NOT the object id, which is shared across distinct events for
    // the same subscription/invoice and would wrongly drop the second one.
    // Claimed atomically with SET NX so two concurrent deliveries of the same
    // event cannot both pass the check (the previous get-then-set had a race).
    const idempotencyKey = `webhook:processed:${provider}:${event.id}`;
    const claim = await this.claimWebhookEvent(idempotencyKey);
    if (claim === 'duplicate') {
      this.logger.debug(`Skipping duplicate webhook: ${event.id}`);
      return { received: true };
    }

    try {
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'subscription.updated':
          await this.handleSubscriptionUpdated(provider, event.data);
          break;

        case 'customer.subscription.deleted':
        case 'subscription.cancelled':
          await this.handleSubscriptionCanceled(provider, event.data);
          break;

        case 'invoice.payment_succeeded':
        case 'payment.captured':
          await this.handlePaymentSucceeded(provider, event.data, event.id);
          break;

        case 'invoice.payment_failed':
        case 'payment.failed':
          await this.handlePaymentFailed(provider, event.data);
          break;

        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(provider, event.data);
          break;

        default:
          this.logger.debug(`Unhandled webhook event: ${event.type}`);
      }
    } catch (error) {
      // Release the pending claim so the PSP's retry re-enters immediately
      // rather than being dropped as a "duplicate" of a never-completed claim.
      await this.releaseWebhookClaim(idempotencyKey);
      this.logger.error(`Error processing webhook: ${error}`);
      throw error;
    }

    // Mark completed only after the work succeeded (flips 'pending' → 'completed').
    await this.completeWebhookEvent(idempotencyKey);
    return { received: true };
  }

  /**
   * Record a billing transaction
   */
  async recordTransaction(data: {
    organizationId: string;
    provider: 'stripe' | 'razorpay';
    providerTransactionId: string;
    type: 'subscription' | 'one_time' | 'refund';
    status: 'pending' | 'succeeded' | 'failed';
    amount: number;
    currency: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.db.billingTransaction.create({
      data: {
        organizationId: data.organizationId,
        provider: data.provider,
        providerTransactionId: data.providerTransactionId,
        type: data.type,
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        metadata: data.metadata,
      },
    });
  }

  /**
   * Handle subscription updated webhook
   */
  private async handleSubscriptionUpdated(provider: string, data: WebhookData): Promise<void> {
    const customerId =
      provider === 'stripe'
        ? typeof data.customer === 'string'
          ? data.customer
          : data.customer?.id
        : data.subscription?.customer_id;

    if (!customerId) {
      this.logger.warn('No customer ID in subscription updated event');
      return;
    }

    const org = await this.db.organization.findFirst({
      where:
        provider === 'stripe'
          ? { stripeCustomerId: customerId }
          : { razorpayCustomerId: customerId },
    });

    if (!org) {
      this.logger.warn(`Organization not found for customer: ${customerId}`);
      return;
    }

    // Map status
    const status = this.mapSubscriptionStatus(provider, data.status || data.subscription?.status);

    await this.db.organization.update({
      where: { id: org.id },
      data: {
        subscriptionStatus: status,
      },
    });

    this.logger.log(`Updated subscription status for org ${org.id}: ${status}`);
  }

  /**
   * Handle subscription canceled webhook
   */
  private async handleSubscriptionCanceled(provider: string, data: WebhookData): Promise<void> {
    const customerId =
      provider === 'stripe'
        ? typeof data.customer === 'string'
          ? data.customer
          : data.customer?.id
        : data.subscription?.customer_id;

    if (!customerId) return;

    const org = await this.db.organization.findFirst({
      where:
        provider === 'stripe'
          ? { stripeCustomerId: customerId }
          : { razorpayCustomerId: customerId },
    });

    if (!org) return;

    // Downgrade to free tier
    await this.db.organization.update({
      where: { id: org.id },
      data: {
        subscriptionTier: 'free',
        subscriptionStatus: 'canceled',
        screenQuota: getScreenQuotaForTier('free'),
        stripeSubscriptionId: provider === 'stripe' ? null : org.stripeSubscriptionId,
        razorpaySubscriptionId: provider === 'razorpay' ? null : org.razorpaySubscriptionId,
      },
    });

    this.logger.log(`Subscription canceled for org ${org.id}, downgraded to free tier`);
  }

  /**
   * Handle payment succeeded webhook
   */
  private async handlePaymentSucceeded(provider: string, data: WebhookData, eventId?: string): Promise<void> {
    const invoiceId = provider === 'stripe' ? data.id : data.invoice?.id;
    const amount = provider === 'stripe' ? data.amount_paid : data.payment?.amount;
    const currency = provider === 'stripe' ? data.currency : data.payment?.currency;

    const customerId =
      provider === 'stripe'
        ? typeof data.customer === 'string'
          ? data.customer
          : data.customer?.id
        : data.invoice?.customer_id;

    if (!customerId) return;

    const org = await this.db.organization.findFirst({
      where:
        provider === 'stripe'
          ? { stripeCustomerId: customerId }
          : { razorpayCustomerId: customerId },
      include: {
        users: {
          where: { role: 'admin' },
          take: 1,
          select: { email: true, firstName: true },
        },
      },
    });

    if (!org) return;

    // Record the transaction. Fall back to the webhook EVENT id (stable across
    // retries) rather than Date.now() (which changes per delivery and defeats the
    // @@unique([provider, providerTransactionId]) dedup → duplicate rows on replay
    // of a no-invoice-id payment). Only a genuinely id-less event uses a synthetic
    // key, and that key is still replay-stable.
    await this.recordTransaction({
      organizationId: org.id,
      provider: provider as 'stripe' | 'razorpay',
      providerTransactionId: invoiceId || eventId || `payment_${provider}_unknown`,
      type: 'subscription',
      status: 'succeeded',
      amount: amount || 0,
      currency: currency || 'usd',
      description: 'Subscription payment',
    });

    // Update subscription status to active if it was past_due
    if (org.subscriptionStatus === 'past_due') {
      await this.db.organization.update({
        where: { id: org.id },
        data: { subscriptionStatus: 'active' },
      });
    }

    // Send payment receipt email
    const admin = org.users[0];
    if (admin?.email) {
      const formattedAmount = currency === 'inr'
        ? `₹${((amount || 0) / 100).toFixed(2)}`
        : `$${((amount || 0) / 100).toFixed(2)}`;
      try {
        await this.mailService.sendPaymentReceiptEmail(
          admin.email,
          admin.firstName || admin.email.split('@')[0],
          PLAN_TIERS[org.subscriptionTier]?.name || org.subscriptionTier,
          formattedAmount,
          (currency || 'usd').toUpperCase(),
        );
      } catch (emailError) {
        this.logger.warn(`Failed to send receipt email for org ${org.id}: ${emailError}`);
      }
    }

    this.logger.log(`Payment succeeded for org ${org.id}`);
  }

  /**
   * Handle payment failed webhook
   */
  private async handlePaymentFailed(provider: string, data: WebhookData): Promise<void> {
    const customerId =
      provider === 'stripe'
        ? typeof data.customer === 'string'
          ? data.customer
          : data.customer?.id
        : data.invoice?.customer_id;

    if (!customerId) return;

    const org = await this.db.organization.findFirst({
      where:
        provider === 'stripe'
          ? { stripeCustomerId: customerId }
          : { razorpayCustomerId: customerId },
      include: {
        users: {
          where: { role: 'admin' },
          take: 1,
          select: { email: true, firstName: true },
        },
      },
    });

    if (!org) return;

    await this.db.organization.update({
      where: { id: org.id },
      data: { subscriptionStatus: 'past_due' },
    });

    // Send payment failed email
    const admin = org.users[0];
    if (admin?.email) {
      try {
        await this.mailService.sendPaymentFailedEmail(
          admin.email,
          admin.firstName || admin.email.split('@')[0],
        );
      } catch (emailError) {
        this.logger.warn(`Failed to send payment failed email for org ${org.id}: ${emailError}`);
      }
    }

    this.logger.log(`Payment failed for org ${org.id}, marked as past_due`);
  }

  /**
   * Handle checkout session completed webhook (Stripe)
   */
  private async handleCheckoutCompleted(provider: string, data: WebhookData): Promise<void> {
    if (provider !== 'stripe') return;

    const metadata = data.metadata || {};
    const organizationId = metadata.organizationId;
    const planId = metadata.planId;

    if (!organizationId || !planId) {
      this.logger.warn('Missing metadata in checkout.session.completed');
      return;
    }

    const subscriptionId =
      typeof data.subscription === 'string' ? data.subscription : data.subscription?.id;

    if (!subscriptionId) {
      this.logger.warn('No subscription ID in checkout.session.completed');
      return;
    }

    // Update organization with subscription details and storage quota
    const tierConfig = PLAN_TIERS[planId];
    await this.db.organization.update({
      where: { id: organizationId },
      data: {
        stripeSubscriptionId: subscriptionId,
        subscriptionTier: planId,
        subscriptionStatus: 'active',
        screenQuota: getScreenQuotaForTier(planId),
        paymentProvider: 'stripe',
        trialEndsAt: null, // End any trial
        ...(tierConfig?.storageQuotaMb
          ? { storageQuotaBytes: BigInt(tierConfig.storageQuotaMb * 1024 * 1024) }
          : {}),
      },
    });

    this.logger.log(`Checkout completed for org ${organizationId}, plan: ${planId}`);
  }

  /**
   * Map provider-specific subscription status to our status
   */
  private mapSubscriptionStatus(
    provider: string,
    status: string,
  ): 'trial' | 'active' | 'past_due' | 'canceled' {
    if (provider === 'stripe') {
      const statusMap: Record<string, 'trial' | 'active' | 'past_due' | 'canceled'> = {
        trialing: 'trial',
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        incomplete: 'past_due',
        incomplete_expired: 'canceled',
        unpaid: 'past_due',
      };
      return statusMap[status] || 'active';
    } else {
      const statusMap: Record<string, 'trial' | 'active' | 'past_due' | 'canceled'> = {
        created: 'trial',
        authenticated: 'trial',
        active: 'active',
        pending: 'past_due',
        halted: 'past_due',
        cancelled: 'canceled',
        completed: 'canceled',
        expired: 'canceled',
      };
      return statusMap[status] || 'active';
    }
  }
}
