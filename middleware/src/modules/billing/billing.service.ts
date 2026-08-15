import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StripeProvider } from './providers/stripe.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import {
  PaymentProvider,
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
  BILLING_INTERVALS,
  getScreenQuotaForTier,
  getStripePriceId,
  getRazorpayPlanId,
  razorpayPlanIdToTier,
  stripePriceIdToTier,
  getBillingPlanIdConflicts,
  type ResolvedPlan,
} from './constants/plans';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { resolvePublicAppUrl } from '../common/utils/public-app-url';
import { EntitlementService } from './entitlement.service';

/** Webhook event data from Stripe/Razorpay — deeply nested untyped objects */
interface WebhookData {
  [key: string]: WebhookData | string | number | boolean | null | undefined;
}

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly stripeProvider: StripeProvider,
    private readonly razorpayProvider: RazorpayProvider,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
    private readonly entitlementService: EntitlementService,
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
    // Duplicate plan ids are a HARD failure regardless of BILLING_VALIDATION_STRICT
    // (B3-E1). Two tiers collapsed onto one provider plan id means the reverse map
    // entitles the wrong tier on every webhook for that plan — a silent
    // mis-entitlement that last-wins would hide. Unlike a MISSING id (which only
    // breaks checkout for that tier, loudly, at request time), this one is
    // undetectable at runtime, so it must not boot.
    const conflicts = getBillingPlanIdConflicts();
    if (conflicts.length > 0) {
      const detail = conflicts
        .map(
          (c) =>
            `${c.provider} plan id "${c.planId}" maps to both ` +
            `${c.existing.tier}/${c.existing.interval} and ${c.duplicate.tier}/${c.duplicate.interval}`,
        )
        .join('; ');
      const message = `Ambiguous billing plan id configuration: ${detail}`;
      this.logger.error(message);
      throw new Error(message);
    }

    const missing: string[] = [];
    for (const [tierId, tier] of Object.entries(PLAN_TIERS)) {
      const isPaidTier =
        tier.prices.usd.monthly > 0 || tier.prices.inr.monthly > 0;
      if (!isPaidTier) continue;
      for (const interval of BILLING_INTERVALS) {
        const stripeKey = `STRIPE_${tierId.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`;
        if (!process.env[stripeKey]) missing.push(stripeKey);
        // Razorpay is now interval-dimensioned too. Report the canonical key
        // name, but accept the legacy `RAZORPAY_<TIER>_PLAN_ID` monthly alias —
        // getRazorpayPlanId resolves it, so a deployment configured under the
        // old scheme is not reported as missing.
        if (!getRazorpayPlanId(tierId, interval)) {
          missing.push(`RAZORPAY_${tierId.toUpperCase()}_${interval.toUpperCase()}_PLAN_ID`);
        }
      }
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
    let degraded = false;

    const subscriptionId = org.stripeSubscriptionId || org.razorpaySubscriptionId;
    if (subscriptionId && org.paymentProvider) {
      // Degrade rather than fail. The provider throws before its own error
      // handling when it is not configured (`ensureConfigured()`), and a 503
      // here blanks the whole billing page — which then renders the org's
      // plan from no data at all. The tier below still comes from our own
      // database, so it stays true; only the provider-owned period fields are
      // unknown, and `degraded` says so rather than letting their defaults
      // read as facts (`cancelAtPeriodEnd: false` on an already-cancelled
      // subscription would offer "Cancel" to a customer who already did).
      try {
        const provider = this.getProvider(org.paymentProvider);
        const subscription = await provider.getSubscription(subscriptionId);
        if (subscription) {
          currentPeriodEnd = subscription.currentPeriodEnd.toISOString();
          cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
        }
      } catch (error) {
        degraded = true;
        this.logger.warn(
          `Unable to read subscription ${subscriptionId} from ${org.paymentProvider} for org ${organizationId}; ` +
            `returning database tier with period data marked degraded: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      ...(degraded ? { degraded: true as const } : {}),
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

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const effectiveCountry = country || org.country || 'US';
    const currency = effectiveCountry === 'IN' ? 'inr' : 'usd';
    const currentTier = org.subscriptionTier;

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

    // Determine the price/plan ID based on interval and provider. The Razorpay
    // arm used to DROP dto.interval, so a customer who picked yearly was
    // subscribed to the monthly Razorpay plan and billed monthly (B3-E1).
    const priceId =
      providerType === 'stripe'
        ? getStripePriceId(dto.planId, dto.interval)
        : getRazorpayPlanId(dto.planId, dto.interval);

    if (!priceId) {
      const currency = org.country === 'IN' ? 'inr' : 'usd';
      throw new BadRequestException(
        `Price not configured for ${dto.planId} ${dto.interval} (${currency})`,
      );
    }

    const baseUrl = resolvePublicAppUrl();
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

    // Persist the Razorpay subscription IDENTIFIER as soon as we have it (B3-P1).
    // `RazorpayProvider.createCheckoutSession` creates a real Razorpay
    // Subscription and returns its id as `sessionId` — nothing else ever wrote
    // that id, so `razorpaySubscriptionId` stayed null forever and both
    // `updateSubscription` and `cancelSubscription` 400'd with
    // "No active subscription found" for every paying Razorpay customer.
    //
    // IDENTIFIER ONLY. No tier, no status, no quota: at this instant the
    // subscription is in Razorpay state `created` and NOTHING has been paid.
    // Entitlement is granted by the subscription.activated / subscription.charged
    // webhooks via applyTierFromPlan — the single tier-write site.
    //
    // Stripe keeps its existing ordering (stripeSubscriptionId is written by
    // checkout.session.completed) because a Stripe Checkout Session id is NOT a
    // subscription id; there is no subscription to record yet.
    if (providerType === 'razorpay' && result.sessionId) {
      await this.db.organization.update({
        where: { id: organizationId },
        data: { razorpaySubscriptionId: result.sessionId },
      });
    }

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

      // Resolve the new price ID, preserving the subscriber's CURRENT billing
      // interval. A yearly subscriber changing plans must stay yearly —
      // hardcoding 'monthly' here silently re-bills them at the wrong amount and
      // cadence. The interval isn't stored locally, so read it from the live
      // provider subscription (Stripe price recurring.interval).
      let priceId: string | undefined;
      if (org.paymentProvider === 'stripe') {
        const currentSub = await provider.getSubscription(subscriptionId);
        const interval = currentSub?.interval;
        if (!interval) {
          // Never fall back to a concrete interval on a re-bill path: an unknown
          // interval must fail loudly rather than risk an incorrect charge.
          throw new BadRequestException(
            'Unable to determine the current billing interval for this subscription; ' +
              'refusing to change plans to avoid an incorrect charge.',
          );
        }
        priceId = getStripePriceId(dto.planId, interval);
      } else {
        // Razorpay plan ids ARE interval-dimensioned (B3-E1), so the same rule
        // applies here as on the Stripe arm: preserve the subscriber's current
        // cadence or refuse. Razorpay's subscription object exposes plan_id
        // rather than an interval, so recover the interval by reverse-mapping
        // the plan the subscriber is on today.
        const currentSub = await provider.getSubscription(subscriptionId);
        const currentPlan = razorpayPlanIdToTier(currentSub?.priceId);
        if (!currentPlan) {
          throw new BadRequestException(
            'Unable to determine the current billing interval for this subscription; ' +
              'refusing to change plans to avoid an incorrect charge.',
          );
        }
        priceId = getRazorpayPlanId(dto.planId, currentPlan.interval);
      }

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
    } else if (org.paymentProvider === 'stripe') {
      // "Cancel at period end": provider.cancelSubscription(id, false) set
      // Stripe's cancel_at_period_end=true and the subscription stays ACTIVE
      // through the paid period. Do NOT flip the local status to 'canceled' —
      // that would revoke dashboard write access the customer already paid for.
      // Leave subscriptionStatus untouched; getSubscriptionStatus derives
      // cancelAtPeriodEnd from the live sub, so the UI shows "access until
      // {periodEnd}" + a Reactivate action. Finalization to free/canceled happens
      // on the customer.subscription.deleted webhook (handleSubscriptionCanceled)
      // when Stripe actually ends the subscription at period end.
    } else {
      // Razorpay: provider.cancelSubscription(id, false) maps to the SDK's
      // cancel_at_cycle_end=false, which cancels the subscription IMMEDIATELY —
      // there is no period-end grace to honor. Finalize locally to match the
      // provider rather than fake a grace it won't keep. (Existing behavior.)
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

  /**
   * Read the current idempotency marker for a claimed webhook: 'completed',
   * 'pending', or null (key absent / Redis unavailable / read failed). Callers
   * treat anything other than 'completed' as not-yet-finished (retryable) so a
   * crashed-mid-processing claim is never mistaken for a done event.
   */
  private async getWebhookEventState(
    idempotencyKey: string,
  ): Promise<string | null> {
    const client = this.redisService.getClient();
    if (!client) return null;
    try {
      return await client.get(idempotencyKey);
    } catch (err) {
      this.logger.warn(`Failed to read webhook claim ${idempotencyKey}: ${err}`);
      return null;
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
      // A key already exists — but 'duplicate' conflates two very different
      // states, and acking 200 on the wrong one loses a money-path event:
      //   completed → genuinely processed already. Safe to ack 200.
      //   pending   → a prior delivery claimed the key then crashed BEFORE
      //               completing (or a concurrent delivery is still in flight).
      //               Acking 200 here tells the PSP "handled, stop retrying" and
      //               the event is lost forever, because processing never
      //               finished. Return 503 instead so the PSP keeps retrying;
      //               the pending key self-heals via its short TTL and a later
      //               retry re-enters cleanly.
      const state = await this.getWebhookEventState(idempotencyKey);
      if (state === 'completed') {
        this.logger.debug(`Skipping already-completed webhook: ${event.id}`);
        return { received: true };
      }
      // pending / expired-between-claim-and-read / redis-read-failed → retryable.
      // ServiceUnavailableException is special-cased by WebhooksController so it
      // surfaces as 503, NOT misclassified as a 401 "invalid signature".
      this.logger.warn(
        `Webhook ${event.id} is claimed-but-not-completed ('${state ?? 'expired'}'); ` +
          `returning 503 so the PSP retries rather than silently dropping the event`,
      );
      throw new ServiceUnavailableException(
        'Webhook is still being processed; please retry',
      );
    }

    try {
      switch (event.type) {
        // All four are "the provider is telling us what this subscription is
        // now" — they carry the subscription entity with its authoritative
        // plan_id/price id and status, and are handled identically (B3-P3).
        // subscription.activated and subscription.charged were previously
        // UNROUTED, which is why a paid Razorpay subscription never granted a
        // tier. subscription.charged also carries a payment entity, but the
        // money row is recorded by payment.captured — recording it here too
        // would double-count.
        case 'customer.subscription.updated':
        case 'subscription.updated':
        case 'subscription.activated':
        case 'subscription.charged':
          await this.handleSubscriptionUpdated(provider, event.data, event.createdAt);
          break;

        case 'customer.subscription.deleted':
        case 'subscription.cancelled':
          await this.handleSubscriptionCanceled(provider, event.data, event.createdAt);
          break;

        case 'invoice.payment_succeeded':
        case 'payment.captured':
          await this.handlePaymentSucceeded(provider, event.data, event.id, event.createdAt);
          break;

        case 'invoice.payment_failed':
        case 'payment.failed':
          await this.handlePaymentFailed(provider, event.data, event.createdAt);
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
   * Recover a Razorpay subscription id that never reached the database (B3-P1).
   *
   * `createCheckoutSession` writes it, but that write can be lost — the request
   * crashes between the Razorpay call and our update, or the subscription was
   * created out-of-band (Razorpay dashboard, a support-issued link). Every
   * `subscription.*` webhook carries the subscription entity, so the id is
   * recoverable from the first lifecycle event the org receives.
   *
   * IDENTIFIER ONLY — never tier, status or quota. Writes only on a real change
   * so a steady-state webhook does not touch the row.
   */
  private async reconcileRazorpaySubscriptionId(
    provider: string,
    org: { id: string; razorpaySubscriptionId: string | null },
    data: WebhookData,
  ): Promise<void> {
    if (provider !== 'razorpay') return;
    const subscription = data.subscription;
    const subscriptionId =
      subscription && typeof subscription === 'object' ? subscription.id : undefined;
    if (typeof subscriptionId !== 'string' || !subscriptionId) return;
    if (org.razorpaySubscriptionId === subscriptionId) return;

    await this.db.organization.update({
      where: { id: org.id },
      data: { razorpaySubscriptionId: subscriptionId },
    });
    this.logger.log(
      `Reconciled razorpaySubscriptionId for org ${org.id}: ` +
        `${org.razorpaySubscriptionId ?? 'null'} → ${subscriptionId}`,
    );
  }

  /**
   * Read a nested value out of an untyped webhook payload without asserting a
   * shape. Returns undefined the moment the path leaves an object, so a
   * provider changing its nesting degrades to "field absent" instead of
   * throwing inside a money-path handler.
   */
  private static readAt(source: unknown, path: (string | number)[]): unknown {
    let current: unknown = source;
    for (const key of path) {
      if (current === null || typeof current !== 'object') return undefined;
      current = (current as Record<string | number, unknown>)[key];
    }
    return current;
  }

  /**
   * The provider plan/price id a subscription lifecycle event is reporting.
   *
   * Razorpay: `payload.subscription.entity.plan_id` (the provider unwraps
   * `.entity` for us). Every subscription.* event carries the subscription
   * entity, and `plan_id` is AUTHORITATIVE for what the customer is being
   * billed for — including after a plan change.
   *
   * Stripe: `data.object.items.data[0].price.id` on customer.subscription.*.
   */
  private planIdFromSubscriptionEvent(
    provider: string,
    data: WebhookData,
  ): string | undefined {
    const raw =
      provider === 'stripe'
        ? BillingService.readAt(data, ['items', 'data', 0, 'price', 'id'])
        : BillingService.readAt(data, ['subscription', 'plan_id']);
    return typeof raw === 'string' && raw ? raw : undefined;
  }

  /**
   * Log-only cross-check of the `notes` we attached at checkout against the tier
   * the plan id resolved to (Razorpay).
   *
   * Deliberately NOT authoritative. Razorpay echoes subscription notes back on
   * webhooks, but (a) they serialize as `[]` — an ARRAY — when empty, so the
   * Array.isArray guard is required before any property read, and (b) whether
   * notes survive a plan change is inferred, not documented. `plan_id` is what
   * Razorpay actually bills, so a mismatch is a signal to investigate, never a
   * reason to write a different tier.
   */
  private crossCheckSubscriptionNotes(
    provider: string,
    organizationId: string,
    data: WebhookData,
    resolved: ResolvedPlan | null,
  ): void {
    if (provider !== 'razorpay' || !resolved) return;
    const notes = BillingService.readAt(data, ['subscription', 'notes']);
    if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return;
    const notedPlan = (notes as Record<string, unknown>).planId;
    if (typeof notedPlan !== 'string' || !notedPlan) return;
    if (notedPlan !== resolved.tier) {
      this.logger.warn(
        `Razorpay subscription notes for org ${organizationId} say planId="${notedPlan}" but ` +
          `plan_id resolves to tier "${resolved.tier}"; honouring plan_id (what Razorpay bills)`,
      );
    }
  }

  /** Entitlement rungs the degrade ladder owns (EntitlementService). */
  private static readonly DUNNING_STATUSES = ['past_due', 'publish_locked', 'suspended'];

  /**
   * Webhook ordering guard (B3-P4). True when this event was EMITTED BY THE
   * PROVIDER before the newest billing event we have already applied.
   *
   * Neither Stripe nor Razorpay guarantees delivery order, and both retry, so a
   * stale `basic` activation can land after a `pro` upgrade and silently
   * downgrade a paying customer. Equal timestamps pass: provider timestamps have
   * one-second resolution, two events can share a second, and tier writes are
   * idempotent — so equality must not drop the second one.
   *
   * Callers must apply this to ENTITLEMENT writes only. billing_transactions is
   * an append-only audit log and is never suppressed by ordering.
   */
  private isStaleBillingEvent(
    org: { id: string; billingEventAt: Date | null },
    eventAt: Date | undefined,
    context: string,
  ): boolean {
    if (!eventAt || !org.billingEventAt) return false;
    if (eventAt.getTime() >= org.billingEventAt.getTime()) return false;
    this.logger.warn(
      `Skipping ${context} entitlement write for org ${org.id}: event emitted ` +
        `${eventAt.toISOString()} is older than the applied mark ` +
        `${org.billingEventAt.toISOString()} (out-of-order delivery)`,
    );
    return true;
  }

  /**
   * THE SINGLE TIER-WRITE SITE for subscription lifecycle webhooks (B3-P3).
   *
   * Every path that grants or changes entitlement from a webhook goes through
   * here — subscription.activated, subscription.charged, subscription.updated
   * and customer.subscription.updated — so there is exactly one place where
   * "what Razorpay/Stripe says the customer is paying for" becomes
   * subscriptionTier + screenQuota + storageQuotaBytes. Do not add a second one.
   *
   * Rules, each load-bearing:
   *
   * - UNKNOWN plan id → tier write SKIPPED, status still written, logger.error
   *   + Sentry. It must NEVER fall back to 'free': that would silently downgrade
   *   a paying customer on the strength of a config gap, which is precisely the
   *   ratchet this change exists to remove.
   * - UNMAPPED status (null) → skip ONLY the status write. The old handler
   *   returned early on a null status, which threw away the tier write too.
   * - past_due → the LADDER owns entry into dunning, so delegate to
   *   entitlementService.beginPastDue (it stamps entitlementStateSince and is
   *   idempotent) instead of writing the status directly, and leave the tier
   *   alone: rungs gate capability, tier records what was bought (B3-E3).
   * - active while the org sits on a dunning rung → delegate to
   *   entitlementService.recover, which clears the episode clock and emits
   *   tenant:resumed. A direct write here would leave suspended screens on the
   *   holding screen forever.
   */
  private async applyTierFromPlan(
    provider: string,
    org: { id: string; subscriptionStatus: string; billingEventAt: Date | null },
    planId: string | undefined,
    status: 'trial' | 'active' | 'past_due' | 'canceled' | null,
    eventAt?: Date,
  ): Promise<void> {
    if (this.isStaleBillingEvent(org, eventAt, 'subscription lifecycle')) return;

    const resolved =
      provider === 'stripe' ? stripePriceIdToTier(planId) : razorpayPlanIdToTier(planId);

    if (planId && !resolved) {
      const message =
        `Unknown ${provider} plan/price id "${planId}" on a subscription event for org ${org.id}: ` +
        `subscriptionTier and quota were NOT written. The org keeps its previous tier — ` +
        `it is never coerced to 'free'. Configure the matching ` +
        `${provider === 'stripe' ? 'STRIPE_<TIER>_<INTERVAL>_PRICE_ID' : 'RAZORPAY_<TIER>_<INTERVAL>_PLAN_ID'} ` +
        `env var and replay the event.`;
      this.logger.error(message);
      BillingService.captureSentry(new Error(message), {
        provider,
        planId,
        organizationId: org.id,
      });
    }

    const data: Record<string, unknown> = {};

    if (status === 'past_due') {
      await this.entitlementService.beginPastDue(org.id);
    } else if (
      status === 'active' &&
      BillingService.DUNNING_STATUSES.includes(org.subscriptionStatus)
    ) {
      await this.entitlementService.recover(org.id);
    } else if (status !== null) {
      data.subscriptionStatus = status;
    } else {
      this.logger.warn(
        `Skipping subscriptionStatus update for org ${org.id}: unmapped/missing ${provider} status`,
      );
    }

    // Tier follows what the provider bills — upgrades AND downgrades (B3-E2).
    // Skipped for past_due: the dunning rung is a capability gate, not a
    // statement about which plan was purchased.
    if (resolved && status !== 'past_due') {
      const tierConfig = PLAN_TIERS[resolved.tier];
      data.subscriptionTier = resolved.tier;
      data.screenQuota = getScreenQuotaForTier(resolved.tier);
      data.trialEndsAt = null;
      if (tierConfig?.storageQuotaMb) {
        data.storageQuotaBytes = BigInt(tierConfig.storageQuotaMb * 1024 * 1024);
      }
    }

    if (Object.keys(data).length === 0) return;

    // Advance the ordering mark only for events whose entitlement write we
    // actually applied, so a later out-of-order delivery is recognisable.
    if (eventAt) data.billingEventAt = eventAt;

    await this.db.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: org.id }, data });
    });

    this.logger.log(
      `Applied ${provider} subscription event for org ${org.id}: ` +
        `${Object.keys(data).sort().join(', ')}`,
    );
  }

  /**
   * Lazy Sentry capture — middleware boot wires Sentry but tests don't load it,
   * so an import failure must not poison the webhook path. Mirrors
   * `AgentsOnboardingService.captureSentry`. Deliberately NOT the global
   * SentryInterceptor: that only reports 5xx, and an unknown plan id returns
   * 200 (the event IS handled; the config is what is wrong).
   */
  private static captureSentry(err: unknown, tags: Record<string, unknown>): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/nestjs');
      Sentry.captureException(err, { tags: { event: 'billing_unknown_plan_id', ...tags } });
    } catch {
      /* Sentry not loaded — silent drop, logger.error already fired */
    }
  }

  /**
   * Handle subscription lifecycle webhooks: subscription.activated,
   * subscription.charged, subscription.updated (Razorpay) and
   * customer.subscription.updated (Stripe).
   *
   * Never map an EVENT NAME to a status — Razorpay ships ten subscription
   * events and the entity status is the only truth (subscription.resumed, for
   * instance, carries status "active"). Read the status off the entity and let
   * mapSubscriptionStatus fail closed on anything unrecognized.
   */
  private async handleSubscriptionUpdated(
    provider: string,
    data: WebhookData,
    eventAt?: Date,
  ): Promise<void> {
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

    await this.reconcileRazorpaySubscriptionId(provider, org, data);

    // Map status. A missing/unmapped status returns null → leave the org's
    // last-known subscriptionStatus untouched (fail-closed) rather than flip
    // entitlement on a webhook we don't understand. (audit S2-6)
    const status = this.mapSubscriptionStatus(provider, data.status || data.subscription?.status);
    const planId = this.planIdFromSubscriptionEvent(provider, data);

    this.crossCheckSubscriptionNotes(
      provider,
      org.id,
      data,
      provider === 'stripe' ? stripePriceIdToTier(planId) : razorpayPlanIdToTier(planId),
    );

    await this.applyTierFromPlan(provider, org, planId, status, eventAt);
  }

  /**
   * Handle subscription canceled webhook
   */
  private async handleSubscriptionCanceled(
    provider: string,
    data: WebhookData,
    eventAt?: Date,
  ): Promise<void> {
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

    // A stale cancellation must not undo a newer reactivation/upgrade.
    if (this.isStaleBillingEvent(org, eventAt, 'subscription cancellation')) return;

    // Downgrade to free tier
    await this.db.organization.update({
      where: { id: org.id },
      data: {
        subscriptionTier: 'free',
        subscriptionStatus: 'canceled',
        screenQuota: getScreenQuotaForTier('free'),
        stripeSubscriptionId: provider === 'stripe' ? null : org.stripeSubscriptionId,
        razorpaySubscriptionId: provider === 'razorpay' ? null : org.razorpaySubscriptionId,
        ...(eventAt ? { billingEventAt: eventAt } : {}),
      },
    });

    this.logger.log(`Subscription canceled for org ${org.id}, downgraded to free tier`);
  }

  /**
   * Resolve the Razorpay customer id from a MONEY event (B3-P2).
   *
   * `payment.captured` / `payment.failed` always deliver `contains: ["payment"]`
   * — the payload carries a payment entity and NEVER an invoice entity, not even
   * for a subscription-linked payment (those carry `invoice_id` as a plain
   * STRING on the payment entity, not a nested invoice object). The previous
   * `data.invoice?.customer_id` read was therefore dead on every single
   * Razorpay money event, and both handlers early-returned in silence:
   * no billing_transactions row, no entitlementService.recover(), no
   * beginPastDue(), no receipt email.
   *
   * Order: invoice (defensive — invoice.* events do carry one) → payment →
   * subscription. `payment.entity.customer_id` is present for customer-linked
   * payments and the KEY IS ABSENT (not null) otherwise, hence the
   * warn-and-return branch at each call site.
   *
   * Docs: https://razorpay.com/docs/webhooks/payloads/payments/
   */
  private razorpayCustomerIdFromMoneyEvent(data: WebhookData): string | undefined {
    for (const key of ['invoice', 'payment', 'subscription'] as const) {
      const entity = data[key];
      if (!entity || typeof entity !== 'object') continue;
      const customerId = entity.customer_id;
      if (typeof customerId === 'string' && customerId) return customerId;
    }
    return undefined;
  }

  /**
   * Handle payment succeeded webhook
   */
  private async handlePaymentSucceeded(
    provider: string,
    data: WebhookData,
    eventId?: string,
    eventAt?: Date,
  ): Promise<void> {
    const invoiceId = provider === 'stripe' ? data.id : data.invoice?.id;
    const amount = provider === 'stripe' ? data.amount_paid : data.payment?.amount;
    const currency = provider === 'stripe' ? data.currency : data.payment?.currency;

    const customerId =
      provider === 'stripe'
        ? typeof data.customer === 'string'
          ? data.customer
          : data.customer?.id
        : this.razorpayCustomerIdFromMoneyEvent(data);

    if (!customerId) {
      // A dropped money event must be VISIBLE. Silence here is how the original
      // bug survived: every payment.captured resolved undefined and returned.
      this.logger.warn(
        `payment succeeded webhook (${provider}) carried no resolvable customer id; ` +
          `no transaction recorded and no entitlement recovery attempted`,
      );
      return;
    }

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

    if (!org) {
      this.logger.warn(
        `payment succeeded webhook (${provider}) for unknown customer ${customerId}; event dropped`,
      );
      return;
    }

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

    // Recover from any degradation rung → active. EntitlementService clears the
    // episode clock and emits tenant:resumed IFF the org had reached `suspended`
    // (B3 ladder). Covers past_due / publish_locked / suspended uniformly.
    //
    // The ordering guard applies to this ENTITLEMENT write only — the
    // billing_transactions insert above is append-only audit and is deliberately
    // recorded first, unconditionally. The mark is NOT advanced here: money
    // events are not the tier authority, the subscription lifecycle events are.
    if (
      BillingService.DUNNING_STATUSES.includes(org.subscriptionStatus) &&
      !this.isStaleBillingEvent(org, eventAt, 'payment recovery')
    ) {
      await this.entitlementService.recover(org.id);
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
  private async handlePaymentFailed(
    provider: string,
    data: WebhookData,
    eventAt?: Date,
  ): Promise<void> {
    const customerId =
      provider === 'stripe'
        ? typeof data.customer === 'string'
          ? data.customer
          : data.customer?.id
        : this.razorpayCustomerIdFromMoneyEvent(data);

    if (!customerId) {
      this.logger.warn(
        `payment failed webhook (${provider}) carried no resolvable customer id; ` +
          `dunning was NOT started for this failure`,
      );
      return;
    }

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

    if (!org) {
      this.logger.warn(
        `payment failed webhook (${provider}) for unknown customer ${customerId}; event dropped`,
      );
      return;
    }

    // Begin the degradation episode (past_due + episode clock). Idempotent — a
    // repeat payment-failed while already past_due/publish_locked/suspended does
    // NOT reset the clock or un-advance the ladder (B3). The ordering guard stops
    // a stale failure from re-opening dunning after a newer recovery; the mark is
    // not advanced (money events are not the tier authority).
    if (!this.isStaleBillingEvent(org, eventAt, 'payment failure dunning')) {
      await this.entitlementService.beginPastDue(org.id);
    }

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
    status: string | undefined,
  ): 'trial' | 'active' | 'past_due' | 'canceled' | null {
    // Fail CLOSED on entitlement: a missing or unrecognized status must NEVER
    // coerce to 'active'. Silently granting entitlement to a paused/unknown
    // subscription is revenue leakage that defaults the wrong way. Returning
    // null tells the caller to leave the last-known status untouched and log,
    // rather than flip entitlement in either direction on a webhook we don't
    // understand. (audit S2-6)
    if (!status) {
      this.logger.warn(
        `Subscription webhook for ${provider} had no status field; leaving subscriptionStatus unchanged`,
      );
      return null;
    }
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
      const mapped = statusMap[status];
      if (!mapped) {
        this.logger.warn(`Unmapped Stripe subscription status "${status}"; leaving subscriptionStatus unchanged`);
        return null;
      }
      return mapped;
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
      const mapped = statusMap[status];
      if (!mapped) {
        this.logger.warn(`Unmapped ${provider} subscription status "${status}"; leaving subscriptionStatus unchanged`);
        return null;
      }
      return mapped;
    }
  }
}
