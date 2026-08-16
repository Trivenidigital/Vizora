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
  getStripePriceId,
  getRazorpayPlanId,
  razorpayPlanIdToTier,
  stripePriceIdToTier,
  getBillingPlanIdConflicts,
  tierEntitlementFields,
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
    // Duplicate plan ids are reported LOUDLY but do NOT stop the boot (B3-E1,
    // review C-F2). Two tiers collapsed onto one provider plan id is a real
    // misconfiguration, but throwing here takes the whole middleware down —
    // displays, content and auth included, in both PM2 cluster instances, with
    // exponential backoff — over a billing typo, on a deployment where billing
    // may be entirely dormant. That is the #101 boot-validator lesson.
    //
    // Degrading is safe because the ambiguous id is removed from the reverse
    // index (constants/plans.ts), so it resolves to null and every webhook for
    // it takes the existing skip-the-tier-write-and-escalate path. Nothing gets
    // the wrong entitlement; the operator gets an error log and a Sentry issue.
    const conflicts = getBillingPlanIdConflicts();
    if (conflicts.length > 0) {
      const detail = conflicts
        .map(
          (c) =>
            `${c.provider} plan id "${c.planId}" maps to both ` +
            `${c.existing.tier}/${c.existing.interval} and ${c.duplicate.tier}/${c.duplicate.interval}`,
        )
        .join('; ');
      const message =
        `Ambiguous billing plan id configuration: ${detail}. ` +
        `These ids now resolve to NOTHING — subscription webhooks carrying them will ` +
        `skip the tier write and escalate rather than entitle a guessed tier. Fix the env.`;
      this.logger.error(message);
      BillingService.captureSentry(new Error(message), { reason: 'ambiguous_plan_ids' });
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

    // B-H2: never start a SECOND subscription while a live one exists.
    // `createCheckoutSession` creates a real Razorpay Subscription and P1 stores
    // its id, unconditionally overwriting whatever was there. A double-click, a
    // back-button re-submit or a second purchase attempt therefore replaced the
    // id of the subscription that is actually CHARGING the customer with an
    // unpaid one — after which `cancelSubscription` cancels the unpaid shell,
    // reports success, and the real subscription keeps billing forever.
    //
    // Refuse instead, and point the customer at the plan-change path. Only an
    // ACTIVE provider-side subscription blocks: a `created`/`authenticated`
    // shell from an abandoned or double-clicked checkout is not charging
    // anybody, so overwriting it is correct and keeps retrying possible. Any
    // transient id churn between two unpaid shells self-heals — whichever one
    // is actually paid emits subscription.activated, and
    // reconcileRazorpaySubscriptionId adopts that id.
    //
    // NOTE: `getSubscription` catches and returns null for API errors, so an
    // unreachable provider reads as "no live subscription" and the checkout is
    // allowed. That window is narrow (the create call goes to the same API and
    // would fail too) and favours availability over a hard block.
    //
    // The first cut applied this to RAZORPAY ONLY, which combined badly with the
    // A-F5 gate below: a past_due STRIPE customer was refused a plan change with
    // "Complete checkout first", and checkout then happily created a SECOND
    // Stripe subscription while the original kept billing and dunning. Both
    // providers are guarded, and `past_due`/`unpaid` count as LIVE — a
    // subscription in dunning is still the customer's subscription.
    const existingSubscriptionId =
      providerType === 'stripe' ? org.stripeSubscriptionId : org.razorpaySubscriptionId;
    if (existingSubscriptionId) {
      const existing = await provider.getSubscription(existingSubscriptionId);
      if (existing && BillingService.LIVE_PROVIDER_STATUSES.includes(existing.status)) {
        throw new BadRequestException(
          'This organization already has a subscription with this payment provider. ' +
            'Change the plan on the existing subscription instead of starting a new one; ' +
            'if payment is failing, update the payment method on that subscription.',
        );
      }
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
      // Same `dto.interval` that resolved `priceId` two statements above — the
      // Razorpay provider derives the subscription's total_count from it, and a
      // yearly plan id bounded by a monthly cycle count (or vice versa) would be
      // wrong in exactly the way B3-E1 was (B3b).
      interval: dto.interval,
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
      // A-F5: the SAME paid-plan validity check checkout applies. Without it,
      // `{planId:'enterprise'}` self-serves screenQuota -1 (unlimited) + 500GB
      // storage, because `enterprise` is priced -1 (custom/sales-led) and
      // `free` is priced 0 — neither is purchasable, but both are valid
      // PLAN_TIERS keys and the old `if (!plan)` check let them through.
      const plan = PLAN_TIERS[dto.planId];
      if (!plan || plan.prices.usd.monthly === 0 || plan.prices.usd.monthly === -1) {
        throw new BadRequestException('Invalid plan for subscription change');
      }

      // A-F5: require a LIVE subscription before touching anything. Until B3-P1
      // this endpoint was unreachable for Razorpay (razorpaySubscriptionId was
      // always null, so the guard above 400'd) — persisting the id removed that
      // accidental gate, and an org that has paid NOTHING (a `created` shell
      // from an abandoned checkout) could otherwise call this and be granted a
      // paid tier locally. The provider's own status is the only trustworthy
      // signal here.
      //
      // `past_due`/`unpaid` ARE allowed to change plan. Refusing them was wrong
      // twice over: it is the same state `SubscriptionActiveGuard` grants full
      // dashboard write access to, and downgrading to a cheaper plan is exactly
      // what a customer in dunning is most likely to want. The error text also
      // must never say "complete checkout" — that sent them to create a second,
      // parallel subscription.
      const liveSub = await provider.getSubscription(subscriptionId);
      if (!liveSub || !BillingService.LIVE_PROVIDER_STATUSES.includes(liveSub.status)) {
        throw new BadRequestException(
          'No live subscription to change. If your subscription has ended, start a new one; ' +
            'if it was never completed, finish the original checkout rather than starting another.',
        );
      }

      // Entitlement still requires PAYMENT. The provider-side plan change goes
      // through for a dunning subscriber, but the local paid-tier write is
      // deferred to the money path (`handlePaymentSucceeded` → `recover()` and
      // the subsequent lifecycle event), so nobody is granted a higher tier on
      // the strength of a subscription that is not currently being paid.
      const grantsTierLocally = liveSub.status === 'active';

      // Resolve the new price ID, preserving the subscriber's CURRENT billing
      // interval. A yearly subscriber changing plans must stay yearly —
      // hardcoding 'monthly' here silently re-bills them at the wrong amount and
      // cadence. The interval isn't stored locally, so read it from the live
      // provider subscription (Stripe price recurring.interval).
      let priceId: string | undefined;
      if (org.paymentProvider === 'stripe') {
        const interval = liveSub.interval;
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
        const currentPlan = razorpayPlanIdToTier(liveSub.priceId);
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

      // Update organization with new tier, screen quota, and storage quota.
      // `billingEventAt` is stamped with NOW (B-M2): an operator/API-initiated
      // change is authoritative by definition, and without the stamp an
      // in-flight OLDER webhook would sail past the ordering guard and revert
      // the upgrade the customer just paid for.
      const newTier = dto.planId;
      if (!grantsTierLocally) {
        this.logger.log(
          `Provider plan change applied for org ${organizationId} → ${newTier}, but the ` +
            `subscription is '${liveSub.status}', so the local tier write is deferred to the ` +
            `money path. Entitlement follows payment, not intent.`,
        );
      }
      try {
        if (grantsTierLocally) {
          await this.db.$transaction(async (tx) => {
            await tx.organization.update({
              where: { id: organizationId },
              data: {
                ...tierEntitlementFields(newTier),
                billingEventAt: new Date(),
              },
            });
          });
        }
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
      // Downgrade to free tier immediately. `tierEntitlementFields('free')`
      // carries storageQuotaBytes too — writing tier + screenQuota alone left a
      // cancelled ex-Pro org on a 100GB storage quota forever (A-F3), which
      // StorageQuotaService enforces verbatim.
      await this.db.organization.update({
        where: { id: organizationId },
        data: {
          ...tierEntitlementFields('free'),
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: org.paymentProvider === 'stripe' ? null : org.stripeSubscriptionId,
          razorpaySubscriptionId:
            org.paymentProvider === 'razorpay' ? null : org.razorpaySubscriptionId,
          billingEventAt: new Date(),
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
      // cancel_at_cycle_end=false, which cancels the subscription IMMEDIATELY
      // (razorpay.provider.ts:152) — there is no period-end grace to honor.
      // Finalize locally to match the provider rather than fake a grace it
      // won't keep.
      //
      // Writes the SAME entitlement fields as the immediate branch above and as
      // handleSubscriptionCanceled (B3-P5) — tier, screenQuota, storageQuota AND
      // the now-dead razorpaySubscriptionId. Before B3 this wrote status only,
      // which was invisible because subscriptionTier was never raised off 'free'
      // for Razorpay in the first place. Now that the purchase path grants a
      // real tier, leaving any of them behind would keep a cancelled customer on
      // paid entitlement until the subscription.cancelled webhook happened to
      // arrive — or forever if it did not. Keeping the id would additionally let
      // a later plan-change/cancel act on a subscription Razorpay has closed
      // (A-F7).
      await this.db.organization.update({
        where: { id: organizationId },
        data: {
          ...tierEntitlementFields('free'),
          subscriptionStatus: 'canceled',
          razorpaySubscriptionId: null,
          billingEventAt: new Date(),
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

    // Through the same ordering-aware write as everything else (B-M2). This site
    // was missed by the first stamping sweep, which re-opened the hole on the
    // Stripe reactivate flow: an in-flight older webhook could revert it.
    await this.writeEntitlement(
      { id: organizationId },
      { subscriptionStatus: 'active' },
      new Date(),
      'stripe subscription reactivation',
    );

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

    const eventAt = this.sanitizeEventAt(event.createdAt, provider);

    try {
      switch (event.type) {
        // EVERY non-cancellation subscription lifecycle event lands here. They
        // all carry the subscription entity with its authoritative plan_id/price
        // id and status, so one handler reading the ENTITY (never the event
        // name) covers all of them uniformly — an unmapped status simply writes
        // nothing.
        //
        // Routing the full set matters commercially. `subscription.completed` is
        // emitted when a subscription reaches its `total_count` — and
        // `razorpay.provider.ts` creates every subscription with
        // `total_count: 12`, so EVERY monthly Razorpay subscriber stops being
        // billed after twelve months. While this event was unrouted they kept
        // paid tier, quota, storage and API access indefinitely, for free. The
        // `total_count` policy itself is a separate product question (backlog
        // B3b). `halted`/`pending` additionally restore Razorpay's own
        // authoritative dunning-entry signals instead of single-sourcing dunning
        // on payment.failed.
        //
        // subscription.charged also carries a payment entity, but the money row
        // is recorded by payment.captured — recording it here too would
        // double-count.
        case 'customer.subscription.updated':
        case 'subscription.updated':
        case 'subscription.activated':
        case 'subscription.authenticated':
        case 'subscription.charged':
        case 'subscription.completed':
        case 'subscription.halted':
        case 'subscription.pending':
        case 'subscription.paused':
        case 'subscription.resumed':
          await this.handleSubscriptionUpdated(provider, event.data, eventAt);
          break;

        case 'customer.subscription.deleted':
        case 'subscription.cancelled':
          await this.handleSubscriptionCanceled(provider, event.data, eventAt);
          break;

        case 'invoice.payment_succeeded':
        case 'payment.captured':
          await this.handlePaymentSucceeded(provider, event.data, event.id, eventAt);
          break;

        case 'invoice.payment_failed':
        case 'payment.failed':
          await this.handlePaymentFailed(provider, event.data, eventAt);
          break;

        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(provider, event.data, eventAt);
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
    const row = {
      organizationId: data.organizationId,
      provider: data.provider,
      providerTransactionId: data.providerTransactionId,
      type: data.type,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      metadata: data.metadata,
    };

    // UPSERT, not create (B-H1). This runs FIRST on the money path, before
    // entitlementService.recover(). A bare create against
    // @@unique([provider, providerTransactionId]) means that if the insert
    // succeeds and anything after it fails — a DB blip, a Redis hiccup, the
    // process being killed mid-handler — every PSP retry then dies on P2002
    // BEFORE reaching recover(). A paying, suspended organization would stay
    // suspended forever, and the retries would look like a signature problem in
    // the logs. The row is append-only audit, so re-observing it is a no-op:
    // `update: {}` makes the retry idempotent and lets the handler continue.
    return this.db.billingTransaction.upsert({
      where: {
        provider_providerTransactionId: {
          provider: data.provider,
          providerTransactionId: data.providerTransactionId,
        },
      },
      create: row,
      update: {},
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

    // ADOPT ONLY WHEN WE HOLD NOTHING. Overwriting a non-null id with whatever
    // subscription happened to emit an event is how a stale/abandoned
    // subscription hijacks a paying org's record (B-H3): the next cancel would
    // then act on the wrong subscription. A genuine replacement arrives through
    // checkout (which refuses while a live subscription exists) or through
    // cancellation, which clears the field first.
    if (org.razorpaySubscriptionId) return;

    await this.db.organization.update({
      where: { id: org.id },
      data: { razorpaySubscriptionId: subscriptionId },
    });
    this.logger.log(
      `Reconciled razorpaySubscriptionId for org ${org.id}: null → ${subscriptionId}`,
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
  /**
   * The subscription id this lifecycle event is ABOUT.
   * Razorpay: `payload.subscription.entity.id`. Stripe: the Subscription
   * object's own `id` (data.object.id on customer.subscription.*).
   */
  private subscriptionIdFromEvent(provider: string, data: WebhookData): string | undefined {
    const raw =
      provider === 'stripe'
        ? BillingService.readAt(data, ['id'])
        : BillingService.readAt(data, ['subscription', 'id']);
    return typeof raw === 'string' && raw ? raw : undefined;
  }

  /**
   * True when the event is about a subscription this organization is NOT
   * currently on (B-H3).
   *
   * Both subscription handlers resolve the org by customer id alone, and one
   * customer can accumulate several subscriptions — an abandoned checkout shell,
   * a superseded plan, a resurrected cancel. `subscription.cancelled` for any of
   * those would otherwise downgrade the org to free and null the id while the
   * LIVE subscription keeps billing, and the app would report "cancelled".
   *
   * Customer ids are `@unique` per provider, so there is no cross-ORG exposure
   * here; this is strictly cross-SUBSCRIPTION within one org.
   *
   * A null stored id means we have nothing to compare against — the reconcile
   * path is about to adopt this one, so let it through.
   */
  private isForeignSubscription(
    provider: string,
    org: { id: string; stripeSubscriptionId: string | null; razorpaySubscriptionId: string | null },
    data: WebhookData,
  ): boolean {
    const storedId =
      provider === 'stripe' ? org.stripeSubscriptionId : org.razorpaySubscriptionId;
    if (!storedId) return false;
    const eventSubscriptionId = this.subscriptionIdFromEvent(provider, data);
    if (!eventSubscriptionId || eventSubscriptionId === storedId) return false;

    const message =
      `Ignoring ${provider} subscription event for org ${org.id}: the event is about ` +
      `subscription ${eventSubscriptionId} but the organization is on ${storedId}. ` +
      `Applying it would change entitlement from a subscription that is not the live one.`;
    this.logger.warn(message);
    BillingService.captureSentry(new Error(message), {
      reason: 'foreign_subscription_event',
      organizationId: org.id,
      eventSubscriptionId,
      storedSubscriptionId: storedId,
    });
    return true;
  }

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
   * Provider-side statuses where the subscription is the customer's CURRENT one
   * — it exists, it is theirs, and starting a second one would double-bill.
   *
   * Deliberately broader than TIER_GRANTING_STATUSES: a `past_due` subscription
   * is live (and must be plan-changeable and must block a second checkout) but
   * it does NOT by itself grant a paid tier. Live-ness and entitlement are
   * different questions and are answered by different sets.
   */
  private static readonly LIVE_PROVIDER_STATUSES = ['active', 'past_due', 'unpaid'];

  /**
   * Statuses that ASSERT A LIVE, PAID SUBSCRIPTION — the complete allow-list of
   * statuses permitted to write a paid tier, quota and storage.
   *
   * This is an allow-list on purpose. The first cut gated the tier write on
   * `status !== 'past_due'`, which let every OTHER mapped status through, and
   * two of those are catastrophic:
   *
   *   PRE-PAYMENT — Razorpay `created`/`authenticated` and Stripe `trialing` all
   *   map to 'trial'. Granting a paid tier there hands entitlement to someone
   *   who has paid nothing, and the accompanying `trialEndsAt: null` then makes
   *   SubscriptionActiveGuard deny EVERY write: its trial branch needs a future
   *   trialEndsAt, and its free-tier escape hatch no longer applies because the
   *   tier is now 'pro'. The tenant loses write access it previously had.
   *
   *   TERMINAL — Razorpay `cancelled`/`completed`/`expired` and Stripe
   *   `canceled`/`incomplete_expired` all map to 'canceled'. `incomplete_expired`
   *   means the initial payment NEVER succeeded, and Stripe's
   *   `customer.subscription.updated(canceled)` sibling arrives alongside
   *   `deleted` with an equal-second timestamp that the ordering guard admits by
   *   design — so a paid tier written here re-grants entitlement immediately
   *   after cancellation finalized it.
   *
   * Anything not listed writes status only, never tier/quota/storage/trialEndsAt.
   */
  private static readonly TIER_GRANTING_STATUSES = ['active'];

  /**
   * Statuses where entitlement COLLAPSES to free — the mirror of the allow-list.
   * Routed to the same write set `handleSubscriptionCanceled` uses so a terminal
   * lifecycle event and a cancellation event agree.
   */
  private static readonly TERMINAL_STATUSES = ['canceled'];

  /**
   * How far into the future a provider timestamp may sit before we refuse to
   * believe it. A single corrupt `created_at` (milliseconds mistaken for
   * seconds puts it in the year 56000) written into `billingEventAt` would
   * freeze EVERY subsequent entitlement write for that organization forever,
   * warning-only, with no way back except a manual DB edit (B-M4).
   */
  private static readonly MAX_EVENT_CLOCK_SKEW_MS = 5 * 60 * 1000;

  /**
   * Discard an implausible provider timestamp rather than trusting it. Returns
   * undefined, which means "no ordering guard for this event" — strictly better
   * than a poisoned mark.
   */
  private sanitizeEventAt(eventAt: Date | undefined, context: string): Date | undefined {
    if (!eventAt) return undefined;
    const time = eventAt.getTime();
    if (!Number.isFinite(time)) return undefined;
    if (time > Date.now() + BillingService.MAX_EVENT_CLOCK_SKEW_MS) {
      const message =
        `Ignoring implausible ${context} webhook timestamp ${eventAt.toISOString()} ` +
        `(more than ${BillingService.MAX_EVENT_CLOCK_SKEW_MS}ms in the future). ` +
        `Storing it would freeze all future entitlement writes for this org.`;
      this.logger.error(message);
      BillingService.captureSentry(new Error(message), { reason: 'implausible_event_timestamp' });
      return undefined;
    }
    return eventAt;
  }

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
   * This is the CHEAP pre-check that avoids pointless work and gives a precise
   * log line. It is NOT the enforcement point — read-then-write is not atomic
   * across two PM2 cluster instances. `writeEntitlement` repeats the comparison
   * as a conditional UPDATE (compare-and-set) so the database, not this
   * function, decides the winner.
   *
   * Callers must apply this to ENTITLEMENT writes only. billing_transactions is
   * an append-only audit log and is never suppressed by ordering.
   */
  /**
   * The bare ordering predicate, with no logging and no Sentry. Used where we
   * need to KNOW an event is stale without reporting it a second time (the
   * reconcile guard) — `isStaleBillingEvent` is the reporting wrapper.
   */
  private isOlderThanMark(
    org: { billingEventAt: Date | null },
    eventAt: Date | undefined,
  ): boolean {
    if (!eventAt || !org.billingEventAt) return false;
    return eventAt.getTime() < org.billingEventAt.getTime();
  }

  private isStaleBillingEvent(
    org: { id: string; billingEventAt: Date | null },
    eventAt: Date | undefined,
    context: string,
  ): boolean {
    if (!this.isOlderThanMark(org, eventAt)) return false;
    if (!eventAt || !org.billingEventAt) return false;
    const message =
      `Skipping ${context} entitlement write for org ${org.id}: event emitted ` +
      `${eventAt.toISOString()} is older than the applied mark ` +
      `${org.billingEventAt.toISOString()} (out-of-order delivery)`;
    this.logger.warn(message);
    // Out-of-order delivery is normal in small doses; a stream of them means
    // something is genuinely wrong (a poisoned mark, a replay storm, a provider
    // fault) and the operator should not have to be reading logs to find out.
    BillingService.captureSentry(new Error(message), {
      reason: 'out_of_order_billing_event',
      organizationId: org.id,
    });
    return true;
  }

  /**
   * The ONE entitlement write. Compare-and-set on `billingEventAt`.
   *
   * `updateMany` with the ordering predicate IN THE WHERE CLAUSE is what makes
   * the guard real (B-M1). The previous shape read `billingEventAt`, compared it
   * in JS and then wrote — and wrapping that single write in `$transaction`
   * bought exactly nothing, because there was only ever one statement in it. Two
   * PM2 cluster instances processing an older and a newer event concurrently
   * could both pass the JS check and let the OLDER one land last, regressing
   * both the entitlement and the mark. Postgres now arbitrates: the row only
   * matches while its mark is still `<= eventAt`.
   *
   * `count === 0` means another writer got there with a newer event — expected
   * under concurrency, so it logs rather than throws.
   *
   * Returns whether the write was applied.
   */
  private async writeEntitlement(
    org: { id: string },
    data: Record<string, unknown>,
    eventAt: Date | undefined,
    context: string,
    options: { advanceMark?: boolean } = {},
  ): Promise<boolean> {
    if (Object.keys(data).length === 0) return false;

    // `advanceMark: false` still ORDERS the write — it only declines to move the
    // mark forward. Dropping `eventAt` entirely to skip the stamp (the first
    // shape of this) also dropped the WHERE predicate, turning the write
    // unconditional so a concurrent newer status could be clobbered by it
    // (B-M3 review). Ordering and mark-advancement are separate decisions.
    const advanceMark = options.advanceMark ?? true;
    const payload = { ...data, ...(eventAt && advanceMark ? { billingEventAt: eventAt } : {}) };
    const result = await this.db.organization.updateMany({
      where: {
        id: org.id,
        ...(eventAt
          ? { OR: [{ billingEventAt: null }, { billingEventAt: { lte: eventAt } }] }
          : {}),
      },
      data: payload,
    });

    if (result.count === 0) {
      this.logger.warn(
        `Entitlement write for org ${org.id} (${context}) did not apply: a newer ` +
          `billing event won the compare-and-set on billingEventAt`,
      );
      return false;
    }

    this.logger.log(
      `Applied ${context} for org ${org.id}: ${Object.keys(payload).sort().join(', ')}`,
    );
    return true;
  }

  /**
   * CLAIM the right to run a ladder transition, by winning the compare-and-set
   * on `billingEventAt` FIRST. Returns false when a newer event already won.
   *
   * The ladder delegations (`beginPastDue`/`recover`) own their own status
   * write, so they cannot go through `writeEntitlement`. The first shape of this
   * called the ladder and THEN stamped the mark — which left the ladder mutation
   * completely outside the CAS (HIGH-2). Two cluster instances handling
   * `payment.failed`(T1) and `payment.captured`(T2 > T1) both pass the cheap JS
   * pre-check against the old mark; capture wins the CAS and sets `active`;
   * failure's `beginPastDue` then still matches its own
   * `status IN ('active','trial')` guard and flips the org to past_due with a
   * fresh episode clock. Its stamp correctly loses — but the damage is already
   * committed, and because `applyTierFromPlan` leaves the status to the ladder
   * while an episode is open, NO later lifecycle event rescues them: they ride
   * the ladder down to publish_locked and suspended having actually paid.
   *
   * Claiming first makes the mark the mutex. An event with no timestamp has
   * nothing to order against and is allowed through unchanged.
   */
  private async claimEntitlementTransition(
    org: { id: string },
    eventAt: Date | undefined,
    context: string,
  ): Promise<boolean> {
    if (!eventAt) return true;
    return this.writeEntitlement(org, { billingEventAt: eventAt }, eventAt, context);
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
   * - The status must be in TIER_GRANTING_STATUSES before ANY paid tier is
   *   written. See that constant — pre-payment and terminal statuses are the two
   *   ways this went badly wrong.
   * - UNKNOWN plan id → tier write SKIPPED, status still written, logger.error
   *   + Sentry, and the ordering mark is NOT advanced (so the eventual corrected
   *   delivery is not rejected as stale). It must NEVER fall back to 'free':
   *   that would silently downgrade a paying customer on the strength of a
   *   config gap, which is precisely the ratchet this change exists to remove.
   * - UNMAPPED status (null) → nothing is written at all. An unrecognized status
   *   cannot assert a live paid subscription, so it fails closed on BOTH the
   *   status and the tier.
   * - past_due → the LADDER owns entry into dunning, so delegate to
   *   entitlementService.beginPastDue (it stamps entitlementStateSince and is
   *   idempotent) instead of writing the status directly, and leave the tier
   *   alone: rungs gate capability, tier records what was bought (B3-E3).
   * - terminal → the free-tier write set, identical to handleSubscriptionCanceled.
   * - active while the org sits on a dunning rung → the tier still follows the
   *   plan, but the STATUS is left to the ladder. `recover()` is deliberately not
   *   called from here (A-F8): Stripe emits `customer.subscription.updated` with
   *   status `active` for metadata edits, quantity changes and payment-method
   *   attaches, none of which are evidence that the debt was paid. Recovery
   *   belongs to the money path (`handlePaymentSucceeded`), which fires on an
   *   actual payment.
   */
  private async applyTierFromPlan(
    provider: string,
    org: {
      id: string;
      subscriptionStatus: string;
      billingEventAt: Date | null;
      stripeSubscriptionId: string | null;
      razorpaySubscriptionId: string | null;
    },
    planId: string | undefined,
    status: 'trial' | 'active' | 'past_due' | 'canceled' | null,
    eventAt?: Date,
    rawStatus?: string,
  ): Promise<void> {
    if (this.isStaleBillingEvent(org, eventAt, 'subscription lifecycle')) return;

    // Dunning entry is the ladder's, not ours (B3-E3). Tier untouched: a rung
    // gates capability, it does not restate which plan was purchased.
    if (status === 'past_due') {
      // Claim FIRST (HIGH-2): the ladder write is unconditional, so it must not
      // run at all unless this event owns the ordering.
      if (await this.claimEntitlementTransition(org, eventAt, 'dunning entry')) {
        await this.entitlementService.beginPastDue(org.id);
      }
      return;
    }

    // Terminal: entitlement collapses to free, exactly as on the cancellation
    // event. Resolving the plan id first would be pointless — a cancelled
    // subscription's plan says what they USED to buy.
    //
    // A subscription that is DEAD also clears the stored subscription id, which
    // the first cut omitted (HIGH-3). That divergence from
    // `handleSubscriptionCanceled` is guaranteed to bite: `total_count: 12`
    // makes every monthly Razorpay subscriber emit `subscription.completed` at
    // month twelve. Holding a dead id afterwards is doubly bad — an out-of-band
    // replacement subscription has EVERY event rejected by
    // `isForeignSubscription` (the reconcile only adopts into a null field), so
    // the org can never regain a tier and Sentry fills with
    // foreign_subscription_event; and `cancelSubscription` passes its null-check
    // and calls the provider on a subscription that no longer exists, 5xx-ing
    // the customer.
    //
    // `paused` is deliberately NOT dead: Razorpay has stopped billing (so
    // entitlement collapses) but the subscription is resumable, and nulling the
    // id would make it uncancellable and unresumable.
    if (status && BillingService.TERMINAL_STATUSES.includes(status)) {
      const ended = BillingService.isDeadSubscriptionStatus(rawStatus);
      await this.writeEntitlement(
        org,
        {
          ...tierEntitlementFields('free'),
          subscriptionStatus: status,
          ...(ended
            ? {
                stripeSubscriptionId: provider === 'stripe' ? null : org.stripeSubscriptionId,
                razorpaySubscriptionId:
                  provider === 'razorpay' ? null : org.razorpaySubscriptionId,
              }
            : {}),
        },
        eventAt,
        `${provider} terminal subscription status`,
      );
      return;
    }

    if (status === null) {
      // Fail closed on both halves: we cannot tell whether this subscription is
      // live and paid, so we assert nothing about it.
      //
      // Escalated, not warn-only. An unknown PLAN id already reports to Sentry;
      // leaving an unknown STATUS at warn was an asymmetry that would let a
      // provider adding a new subscription status go silently unhandled while
      // entitlement quietly froze (§12b).
      const message =
        `Skipping entitlement write for org ${org.id}: unmapped/missing ${provider} ` +
        `subscription status ${rawStatus ? `"${rawStatus}"` : '(absent)'}. ` +
        `Entitlement is unchanged; teach mapSubscriptionStatus about it.`;
      this.logger.warn(message);
      BillingService.captureSentry(new Error(message), {
        reason: 'unmapped_subscription_status',
        provider,
        status: rawStatus ?? null,
        organizationId: org.id,
      });
      return;
    }

    const grantsTier = BillingService.TIER_GRANTING_STATUSES.includes(status);
    const resolved = grantsTier
      ? provider === 'stripe'
        ? stripePriceIdToTier(planId)
        : razorpayPlanIdToTier(planId)
      : null;

    if (grantsTier && planId && !resolved) {
      const message =
        `Unknown ${provider} plan/price id "${planId}" on a subscription event for org ${org.id}: ` +
        `subscriptionTier and quota were NOT written. The org keeps its previous tier — ` +
        `it is never coerced to 'free'. Configure the matching ` +
        `${provider === 'stripe' ? 'STRIPE_<TIER>_<INTERVAL>_PRICE_ID' : 'RAZORPAY_<TIER>_<INTERVAL>_PLAN_ID'} ` +
        `env var, then RE-TRIGGER a subscription event from the provider dashboard — ` +
        `re-delivering the same event is a no-op, the webhook dedup key is derived from ` +
        `the payload and the original delivery is already marked completed.`;
      this.logger.error(message);
      BillingService.captureSentry(new Error(message), {
        provider,
        planId,
        organizationId: org.id,
      });
    }

    const data: Record<string, unknown> = {};

    // The ladder owns the status while an episode is open. Writing 'active'
    // here would silently end dunning on an unrelated subscription edit (A-F8).
    if (BillingService.DUNNING_STATUSES.includes(org.subscriptionStatus)) {
      this.logger.log(
        `Leaving org ${org.id} on dunning rung '${org.subscriptionStatus}': a lifecycle ` +
          `event reporting '${status}' is not proof of payment; recovery is the money path's`,
      );
    } else {
      data.subscriptionStatus = status;
    }

    // Tier follows what the provider bills — upgrades AND downgrades (B3-E2) —
    // but only under a status that asserts a live paid subscription.
    if (resolved) {
      Object.assign(data, tierEntitlementFields(resolved.tier));
      // Ending the trial is only correct because we are granting a PAID tier on
      // an `active` subscription. Never clear it on a 'trial' status — that is
      // the A-F1 lockout.
      data.trialEndsAt = null;
    }

    // B-M3: when the plan id could not be resolved, do NOT advance the mark —
    // the corrected event that arrives once the env var is fixed would otherwise
    // be rejected as older than a mark this failed attempt set. The write is
    // still ORDERED (the predicate stays), it just does not move the mark.
    const advanceMark = !(grantsTier && planId && !resolved);

    await this.writeEntitlement(org, data, eventAt, `${provider} subscription lifecycle`, {
      advanceMark,
    });
  }

  /**
   * Raw provider statuses where the subscription object is GONE, as opposed to
   * merely not entitling anything right now. Only these clear the stored
   * subscription id (HIGH-3) — `paused` collapses entitlement but stays
   * resumable, and a resumable subscription must remain cancellable.
   */
  private static readonly DEAD_SUBSCRIPTION_STATUSES = [
    'cancelled', // Razorpay
    'completed', // Razorpay — total_count reached
    'expired', // Razorpay
    'canceled', // Stripe
    'incomplete_expired', // Stripe — initial payment never succeeded
  ];

  private static isDeadSubscriptionStatus(rawStatus: string | undefined): boolean {
    return !!rawStatus && BillingService.DEAD_SUBSCRIPTION_STATUSES.includes(rawStatus);
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
      Sentry.captureException(err, { tags: { event: 'billing_anomaly', ...tags } });
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

    // Map status FIRST. A missing/unmapped status returns null → leave the org's
    // last-known subscriptionStatus untouched (fail-closed) rather than flip
    // entitlement on a webhook we don't understand. (audit S2-6)
    const rawStatus = this.rawSubscriptionStatus(data);
    const status = this.mapSubscriptionStatus(provider, rawStatus);
    const planId = this.planIdFromSubscriptionEvent(provider, data);

    // The reconcile runs AFTER the ordering and terminality checks (MED-6). It
    // used to run before every guard, so a stale or terminal event's
    // subscription id was adopted into an empty field — leaving the org holding
    // the id of a subscription that is already dead, which then makes every
    // subsequent event for the REAL subscription look foreign.
    const staleForReconcile = this.isOlderThanMark(org, eventAt);
    const terminalForReconcile = !!status && BillingService.TERMINAL_STATUSES.includes(status);
    if (!staleForReconcile && !terminalForReconcile) {
      await this.reconcileRazorpaySubscriptionId(provider, org, data);
    }

    if (this.isForeignSubscription(provider, org, data)) return;

    this.crossCheckSubscriptionNotes(
      provider,
      org.id,
      data,
      provider === 'stripe' ? stripePriceIdToTier(planId) : razorpayPlanIdToTier(planId),
    );

    await this.applyTierFromPlan(provider, org, planId, status, eventAt, rawStatus);
  }

  /**
   * The provider's own status string, before mapping. Stripe puts it on the
   * subscription object itself; Razorpay nests it under the subscription entity.
   */
  private rawSubscriptionStatus(data: WebhookData): string | undefined {
    const raw =
      BillingService.readAt(data, ['status']) ??
      BillingService.readAt(data, ['subscription', 'status']);
    return typeof raw === 'string' && raw ? raw : undefined;
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

    // A cancellation of some OTHER subscription this customer once had must not
    // downgrade the org off the one that is currently billing them (B-H3).
    //
    // When the stored id is NULL this check passes and the cancellation applies.
    // That is deliberate, and bounded: after HIGH-3 the id is nulled only by a
    // path that has already collapsed entitlement to free/canceled (so applying
    // a cancellation again is idempotent), or it has simply never been set — in
    // which case the org has no subscription we could be protecting, and
    // dropping a genuine cancellation would be the worse error. The residual
    // exposure is an org holding a paid tier with a null id (a checkout whose
    // id-write was lost AND which has received no webhook yet); a foreign
    // cancellation would downgrade it, and the next lifecycle event for the real
    // subscription restores the tier from plan_id.
    if (this.isForeignSubscription(provider, org, data)) return;

    // A stale cancellation must not undo a newer reactivation/upgrade.
    if (this.isStaleBillingEvent(org, eventAt, 'subscription cancellation')) return;

    // Downgrade to free tier. `tierEntitlementFields` carries storageQuotaBytes,
    // which this path used to leave at the paid value (A-F3).
    await this.writeEntitlement(
      org,
      {
        ...tierEntitlementFields('free'),
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: provider === 'stripe' ? null : org.stripeSubscriptionId,
        razorpaySubscriptionId: provider === 'razorpay' ? null : org.razorpaySubscriptionId,
      },
      eventAt,
      `${provider} subscription cancellation`,
    );
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
  /**
   * A money event we could not act on. Logged AND reported to Sentry (B-L2).
   *
   * Warn-only was the wrong severity: this is exactly the §12b class where an
   * automated path silently declines to do something the operator believes is
   * happening. A dropped payment means no audit row, no receipt, and either an
   * un-recovered suspension or an un-started dunning episode — none of which
   * surfaces anywhere a human looks.
   */
  private dropMoneyEvent(provider: string, eventKind: string, reason: string): void {
    const message = `${provider} ${eventKind} webhook dropped: ${reason}`;
    this.logger.error(message);
    BillingService.captureSentry(new Error(message), {
      reason: 'money_event_dropped',
      provider,
      eventKind,
    });
  }

  /**
   * The subscription a MONEY event belongs to, when the payload says so.
   *
   * Razorpay payment/invoice entities carry `subscription_id`; Stripe invoices
   * carry `subscription`. Absent on one-off payments, which is why the caller
   * treats "unknown" as "belongs to us" rather than dropping the event.
   */
  private subscriptionIdFromMoneyEvent(provider: string, data: WebhookData): string | undefined {
    const paths: (string | number)[][] =
      provider === 'stripe'
        ? [['subscription'], ['parent', 'subscription_details', 'subscription']]
        : [
            ['payment', 'subscription_id'],
            ['invoice', 'subscription_id'],
            ['subscription', 'id'],
          ];
    for (const path of paths) {
      const raw = BillingService.readAt(data, path);
      if (typeof raw === 'string' && raw) return raw;
    }
    return undefined;
  }

  /**
   * True when a money event is about a subscription the org is not on (LOW-2).
   *
   * A capture on an abandoned or superseded subscription would otherwise drive
   * `recover()` on the LIVE one — paying off a dead shell would clear a real
   * dunning episode. The audit row is still written by the caller; only the
   * entitlement effect is withheld.
   */
  private isForeignMoneySubscription(
    provider: string,
    org: { id: string; stripeSubscriptionId: string | null; razorpaySubscriptionId: string | null },
    data: WebhookData,
  ): boolean {
    const storedId =
      provider === 'stripe' ? org.stripeSubscriptionId : org.razorpaySubscriptionId;
    if (!storedId) return false;
    const eventSubscriptionId = this.subscriptionIdFromMoneyEvent(provider, data);
    if (!eventSubscriptionId || eventSubscriptionId === storedId) return false;
    this.logger.warn(
      `Money event for org ${org.id} belongs to subscription ${eventSubscriptionId}, not the ` +
        `organization's ${storedId}: the transaction is recorded but entitlement is untouched.`,
    );
    return true;
  }

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
      // A dropped money event must be VISIBLE — and warn-only is not visible
      // enough for the money path (§12b). Silence here is how the original bug
      // survived: every payment.captured resolved undefined and returned.
      this.dropMoneyEvent(
        provider,
        'payment.succeeded',
        'carried no resolvable customer id; no transaction recorded and no entitlement recovery attempted',
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
      this.dropMoneyEvent(
        provider,
        'payment.succeeded',
        `resolved customer ${customerId} matches no organization; event dropped`,
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
    // billing_transactions upsert above is append-only audit and is deliberately
    // recorded first, unconditionally. The mark IS advanced (B-M2): recovery is
    // an entitlement change, and leaving the mark behind let a stale `active`
    // or a stale failure reorder against it.
    //
    // This is the ONLY recovery site (A-F8). A lifecycle event reporting
    // `active` is not proof of payment — Stripe emits it for metadata edits,
    // quantity changes and payment-method attaches — so `applyTierFromPlan`
    // deliberately does not call recover(). An actual captured payment does.
    if (
      BillingService.DUNNING_STATUSES.includes(org.subscriptionStatus) &&
      !this.isForeignMoneySubscription(provider, org, data) &&
      !this.isStaleBillingEvent(org, eventAt, 'payment recovery') &&
      (await this.claimEntitlementTransition(org, eventAt, 'payment recovery'))
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
      this.dropMoneyEvent(
        provider,
        'payment.failed',
        'carried no resolvable customer id; dunning was NOT started for this failure',
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
      this.dropMoneyEvent(
        provider,
        'payment.failed',
        `resolved customer ${customerId} matches no organization; event dropped`,
      );
      return;
    }

    // Begin the degradation episode (past_due + episode clock). Idempotent — a
    // repeat payment-failed while already past_due/publish_locked/suspended does
    // NOT reset the clock or un-advance the ladder (B3). The ordering guard stops
    // a stale failure from re-opening dunning after a newer recovery, and the
    // mark IS advanced (B-M2): a dunning transition is an entitlement change, so
    // a later-delivered older `active` must not be able to undo it.
    if (
      !this.isForeignMoneySubscription(provider, org, data) &&
      !this.isStaleBillingEvent(org, eventAt, 'payment failure dunning') &&
      (await this.claimEntitlementTransition(org, eventAt, 'payment failure dunning'))
    ) {
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
  private async handleCheckoutCompleted(
    provider: string,
    data: WebhookData,
    eventAt?: Date,
  ): Promise<void> {
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

    if (typeof organizationId !== 'string' || typeof planId !== 'string') {
      this.logger.warn('Non-string metadata in checkout.session.completed');
      return;
    }

    // B-M6: validate the tier before writing it. `planId` here is OUR tier slug
    // carried in Stripe metadata, not a price id — and metadata is a free-form
    // string map. An unrecognized value used to be written straight into
    // `subscriptionTier`, with `getScreenQuotaForTier` silently falling back to
    // the free-tier 5 for the quota: a corrupt tier and a mismatched quota, with
    // nothing logged. Same policy as the lifecycle path — skip the tier write,
    // escalate, never guess.
    if (!PLAN_TIERS[planId]) {
      const message =
        `Unknown plan "${planId}" in checkout.session.completed metadata for org ` +
        `${organizationId}: subscriptionTier and quota were NOT written.`;
      this.logger.error(message);
      BillingService.captureSentry(new Error(message), {
        reason: 'unknown_checkout_plan',
        organizationId,
        planId,
      });
      return;
    }

    // LOW-1: Stripe fires checkout.session.completed for delayed-notification
    // payment methods BEFORE the money settles, with `payment_status: 'unpaid'`.
    // Granting a paid tier on that is entitlement without payment; the later
    // `checkout.session.async_payment_succeeded` / `invoice.payment_succeeded`
    // is the event that actually means paid.
    const paymentStatus = BillingService.readAt(data, ['payment_status']);
    if (
      typeof paymentStatus === 'string' &&
      paymentStatus !== 'paid' &&
      paymentStatus !== 'no_payment_required'
    ) {
      this.logger.warn(
        `Deferring checkout.session.completed for org ${organizationId}: payment_status is ` +
          `'${paymentStatus}', not paid. Entitlement waits for the payment event.`,
      );
      return;
    }

    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, billingEventAt: true, subscriptionStatus: true },
    });
    if (!org) {
      this.logger.warn(`checkout.session.completed for unknown org ${organizationId}`);
      return;
    }

    // Goes through writeEntitlement like every other entitlement write, so it
    // gets the same compare-and-set ordering guard the lifecycle events have.
    // Without it a checkout completion could be overwritten by an older
    // in-flight subscription event.
    await this.writeEntitlement(
      org,
      {
        ...tierEntitlementFields(planId),
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: 'active',
        paymentProvider: 'stripe',
        trialEndsAt: null, // Paid checkout completed — the trial is over.
      },
      eventAt,
      `stripe checkout completion (plan ${planId})`,
    );

    // A completed, PAID checkout is a money event, so it recovers a dunning
    // episode exactly as handlePaymentSucceeded does. Without this a customer
    // who pays their way out of suspension keeps dark screens: `recover()` is
    // the only emitter of `tenant:resumed`, and handlePaymentSucceeded only
    // calls it while the org is still on a rung — so if
    // checkout.session.completed lands FIRST and sets status active, the
    // subsequent invoice.payment_succeeded sees a non-dunning org, skips
    // recover(), and `entitlementStateSince` stays set with no resume signal
    // ever reaching the devices.
    //
    // This does not contradict A-F8, which bars a LIFECYCLE `active` from
    // recovering. A checkout completion is payment confirmation, not a
    // metadata edit.
    if (BillingService.DUNNING_STATUSES.includes(org.subscriptionStatus)) {
      await this.entitlementService.recover(org.id);
    }
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
        // Entitlement follows BILLING STATE. A paused subscription is not being
        // charged, so it must not keep granting a paid tier, quota, storage and
        // API access — leaving it unmapped made the event a total no-op while
        // the customer stopped paying. It collapses to the terminal write set
        // WITHOUT clearing the subscription id (see DEAD_SUBSCRIPTION_STATUSES),
        // and `resumed`/`active` restores the tier from plan_id, so the loop
        // closes in both directions.
        paused: 'canceled',
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
        // See the Stripe map above: entitlement follows billing state, and a
        // paused Razorpay subscription is not being charged. Resumable, so the
        // subscription id is kept.
        paused: 'canceled',
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
