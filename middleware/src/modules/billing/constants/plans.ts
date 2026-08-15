/**
 * Plan tier configuration for Vizora billing
 * All prices are in cents (USD) or paise (INR)
 */

export interface PlanTier {
  id: string;
  name: string;
  screenQuota: number; // -1 for unlimited
  storageQuotaMb: number; // Storage quota in megabytes
  prices: {
    usd: { monthly: number; yearly: number; stripePriceId?: string };
    inr: { monthly: number; yearly: number; razorpayPlanId?: string };
  };
  features: string[];
}

/**
 * Base plan configurations without provider-specific IDs
 * Provider IDs are resolved at runtime via getPriceId()
 *
 * TODO: When changing prices here, create corresponding price objects in
 * Stripe/Razorpay dashboards and plan migration for existing subscribers.
 */
export const PLAN_TIERS: Record<string, PlanTier> = {
  free: {
    id: 'free',
    name: 'Free',
    screenQuota: 5,
    storageQuotaMb: 1024, // 1 GB
    prices: {
      usd: { monthly: 0, yearly: 0 },
      inr: { monthly: 0, yearly: 0 },
    },
    features: [
      'Up to 5 screens',
      '30-day free trial',
      'Basic scheduling',
      'Content upload',
      '1 GB storage',
    ],
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    screenQuota: 50,
    storageQuotaMb: 25600, // 25 GB
    prices: {
      usd: {
        monthly: 600, // $6/screen, stored as cents
        yearly: 6000, // $60/screen/year (save ~17%)
      },
      inr: {
        monthly: 39900, // ₹399/screen
        yearly: 379900, // ₹3,799/screen/year (saves ₹989)
      },
    },
    features: [
      'Up to 50 screens',
      '$6 per screen/month',
      'Analytics dashboard',
      'Email support',
      '25 GB storage',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    screenQuota: 100,
    storageQuotaMb: 102400, // 100 GB
    prices: {
      usd: {
        monthly: 800, // $8/screen, stored as cents
        yearly: 8000, // $80/screen/year (save ~17%)
      },
      inr: {
        monthly: 59900, // ₹599/screen
        yearly: 579900, // ₹5,799/screen/year (saves ₹1,389)
      },
    },
    features: [
      'Up to 100 screens',
      '$8 per screen/month',
      'API access',
      'Priority support',
      '100 GB storage',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    screenQuota: -1, // unlimited
    storageQuotaMb: 512000, // 500 GB
    prices: {
      usd: { monthly: -1, yearly: -1 }, // custom pricing
      inr: { monthly: -1, yearly: -1 },
    },
    features: [
      'Everything in Pro',
      'Unlimited screens',
      'SLA',
      'Dedicated support',
      'Custom integrations',
    ],
  },
};

export type BillingInterval = 'monthly' | 'yearly';

/** The two intervals every paid tier is sold at. */
export const BILLING_INTERVALS: readonly BillingInterval[] = ['monthly', 'yearly'] as const;

/** What a provider price/plan id identifies: which tier, billed how often. */
export interface ResolvedPlan {
  tier: string;
  interval: BillingInterval;
}

/**
 * Two DIFFERENT (tier, interval) targets configured against the SAME provider
 * plan id. Last-writer-wins would silently entitle the wrong tier, so an
 * ambiguous id is instead REMOVED from the reverse index entirely: it resolves
 * to null, which routes to the existing "skip the tier write and escalate"
 * path. Boot logs an error and reports to Sentry — it does NOT throw. A billing
 * config typo must not take down displays, content and auth in both PM2 cluster
 * instances (the #101 boot-validator lesson).
 */
export interface PlanIdConflict {
  provider: 'stripe' | 'razorpay';
  planId: string;
  existing: ResolvedPlan;
  duplicate: ResolvedPlan;
}

/**
 * Get the Stripe price ID for a plan and interval
 * Reads from environment variables at runtime for testability
 */
export const getStripePriceId = (
  planId: string,
  interval: BillingInterval,
): string | undefined => {
  const envKey = `STRIPE_${planId.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`;
  return process.env[envKey] || undefined;
};

/**
 * Get the Razorpay plan ID for a plan AND INTERVAL (B3-E1).
 *
 * Razorpay plan ids are NOT interval-agnostic — a Razorpay Plan carries its own
 * `period`/`interval`, so monthly and yearly are two distinct plan objects. The
 * single-dimension `RAZORPAY_<TIER>_PLAN_ID` scheme could therefore only ever
 * bill one cadence, which is why picking "yearly" in checkout charged the
 * customer monthly.
 *
 * Canonical: `RAZORPAY_<TIER>_<INTERVAL>_PLAN_ID` (mirrors the Stripe scheme).
 * Legacy `RAZORPAY_<TIER>_PLAN_ID` — the name CLAUDE.md documents and the only
 * one any existing deployment could have set — is kept as the MONTHLY alias so
 * an existing configuration keeps working unchanged. There is deliberately no
 * legacy fallback for yearly: a missing yearly plan id must fail loudly at
 * checkout rather than quietly re-bill at the monthly cadence.
 */
export const getRazorpayPlanId = (
  planId: string,
  interval: BillingInterval,
): string | undefined => {
  const scoped = process.env[`RAZORPAY_${planId.toUpperCase()}_${interval.toUpperCase()}_PLAN_ID`];
  if (scoped) return scoped;
  if (interval === 'monthly') {
    return process.env[`RAZORPAY_${planId.toUpperCase()}_PLAN_ID`] || undefined;
  }
  return undefined;
};

/**
 * Build the provider-plan-id → {tier, interval} reverse index.
 *
 * Built at CALL TIME, never cached: these are `process.env` reads, and a cached
 * index would silently serve a stale mapping after a config change (and would
 * make every test that sets env vars order-dependent).
 *
 * Empty/unset values are skipped rather than indexed — prod runs with zero
 * Razorpay plan ids configured, and indexing '' would collapse every tier onto
 * one key. Only genuinely duplicated NON-EMPTY ids are reported as conflicts.
 */
function buildPlanIdIndex(
  provider: 'stripe' | 'razorpay',
): { index: Map<string, ResolvedPlan>; conflicts: PlanIdConflict[] } {
  const index = new Map<string, ResolvedPlan>();
  const conflicts: PlanIdConflict[] = [];
  const ambiguous = new Set<string>();

  const add = (planId: string | undefined, resolved: ResolvedPlan): void => {
    if (!planId) return;
    if (ambiguous.has(planId)) return;
    const existing = index.get(planId);
    if (!existing) {
      index.set(planId, resolved);
      return;
    }
    // Same id resolving to the SAME target twice (e.g. the legacy Razorpay
    // alias holding the same value as the interval-scoped var) is not a
    // conflict — it is one plan reachable under two env names.
    if (existing.tier === resolved.tier && existing.interval === resolved.interval) return;
    conflicts.push({ provider, planId, existing, duplicate: resolved });
    // Fail CLOSED rather than last-wins or first-wins: an ambiguous id resolves
    // to nothing, so the webhook skips the tier write and escalates instead of
    // silently entitling one of the two candidate tiers.
    ambiguous.add(planId);
    index.delete(planId);
  };

  for (const tier of Object.keys(PLAN_TIERS)) {
    for (const interval of BILLING_INTERVALS) {
      add(
        provider === 'stripe' ? getStripePriceId(tier, interval) : getRazorpayPlanId(tier, interval),
        { tier, interval },
      );
    }
    if (provider === 'razorpay') {
      // Index the legacy alias explicitly: when the interval-scoped monthly var
      // is ALSO set with a different value, getRazorpayPlanId no longer returns
      // the legacy id, and an in-flight subscription still on that plan would
      // otherwise reverse-map to "unknown" and lose its tier.
      add(process.env[`RAZORPAY_${tier.toUpperCase()}_PLAN_ID`] || undefined, {
        tier,
        interval: 'monthly',
      });
    }
  }

  return { index, conflicts };
}

/**
 * Reverse-map a Razorpay plan id from a webhook to the tier it sells (B3-E1).
 * Returns null for a plan id this deployment does not know — callers MUST treat
 * that as "skip the tier write and escalate", never as "free".
 */
export const razorpayPlanIdToTier = (planId: string | undefined): ResolvedPlan | null => {
  if (!planId) return null;
  return buildPlanIdIndex('razorpay').index.get(planId) ?? null;
};

/**
 * Reverse-map a Stripe price id from a webhook to the tier it sells (B3-E1,
 * Stripe parity). Same contract as razorpayPlanIdToTier.
 */
export const stripePriceIdToTier = (priceId: string | undefined): ResolvedPlan | null => {
  if (!priceId) return null;
  return buildPlanIdIndex('stripe').index.get(priceId) ?? null;
};

/**
 * Every duplicate-plan-id conflict across both providers. The billing module
 * reports a non-empty result at startup (logger.error + Sentry) and keeps
 * booting; the ids themselves are already unresolvable, so the runtime effect
 * is the safe skip-and-escalate path rather than a wrong entitlement.
 */
export const getBillingPlanIdConflicts = (): PlanIdConflict[] => [
  ...buildPlanIdIndex('stripe').conflicts,
  ...buildPlanIdIndex('razorpay').conflicts,
];

/**
 * Get the screen quota for a given tier
 * Returns 5 (free tier default) if tier not found
 */
export const getScreenQuotaForTier = (tier: string): number => {
  return PLAN_TIERS[tier]?.screenQuota ?? 5;
};

/**
 * The complete set of entitlement columns a tier implies.
 *
 * ONE definition, shared by EVERY write that moves an organization between
 * tiers — the billing webhooks, the API cancel/plan-change paths, and the
 * entitlement ladder's final rung. It lives here rather than on BillingService
 * because `EntitlementService` must use it too and cannot import the service
 * (circular).
 *
 * `storageQuotaBytes` is the reason this exists (A-F3). Several paths used to
 * write `subscriptionTier` + `screenQuota` and stop, leaving a downgraded org on
 * the storage quota of the plan it no longer pays for — and StorageQuotaService
 * enforces the stored value verbatim. Free's own 1024MB is truthy, so it flows
 * through the same expression rather than needing a special case.
 *
 * Returns a plain object so callers can spread it into a Prisma `data` payload
 * alongside their own fields.
 */
export const tierEntitlementFields = (tier: string): Record<string, unknown> => {
  const config = PLAN_TIERS[tier];
  return {
    subscriptionTier: tier,
    screenQuota: getScreenQuotaForTier(tier),
    ...(config?.storageQuotaMb
      ? { storageQuotaBytes: BigInt(config.storageQuotaMb * 1024 * 1024) }
      : {}),
  };
};

/**
 * Get plan tier by ID
 */
export const getPlanTier = (tierId: string): PlanTier | undefined => {
  return PLAN_TIERS[tierId];
};

/**
 * Get all available plan tiers as an array
 */
export const getAllPlanTiers = (): PlanTier[] => {
  return Object.values(PLAN_TIERS);
};

/**
 * Check if a tier supports paid features
 */
export const isPaidTier = (tier: string): boolean => {
  const plan = PLAN_TIERS[tier];
  return plan ? plan.prices.usd.monthly > 0 : false;
};

/**
 * Tiers whose subscription includes programmatic API access (B2).
 *
 * This is a NEW machine-readable product decision, not a restatement of
 * something that already existed. Nothing in the codebase encoded API access
 * before: `Plan.features` / `Plan.featureFlags` are dead storage with no
 * consumer, and the `PLAN_TIERS[x].features` arrays above are DISPLAY STRINGS
 * — no code may ever match on them, because editing marketing copy would then
 * silently change authorization.
 *
 * Chosen from the LIVE product promise, asserted in two independent places:
 * the public pricing page lists 'API access' under Pro
 * (`web/src/components/landing/PricingSection.tsx:164`), and the in-app plan
 * chooser renders the same string from `PLAN_TIERS.pro.features` above.
 * Enterprise is 'Everything in Pro', so it inherits.
 *
 * `scripts/seed-production.ts` disagrees (it marks API access enterprise-only),
 * but that script is broken against the current schema, is excluded from
 * typecheck, has never been run, and nothing reads its output — so it is not
 * evidence of the shipped promise.
 *
 * CHANGING THIS SET IS A PRODUCT DECISION, not a refactor: removing a tier
 * silently breaks every live integration that tier's customers have built.
 */
export const API_ACCESS_TIERS = new Set<string>(['pro', 'enterprise']);

/**
 * Subscription statuses that deny API-key use even on an API-capable tier (B2).
 *
 * Mirrors the deny set of `SubscriptionActiveGuard` — the terminal rungs of the
 * B3 entitlement ladder. `past_due` and `publish_locked` are deliberately
 * ALLOWED for ladder consistency: `past_due` is a 7-day dunning grace where one
 * failed card must not lock anything, and `publish_locked` blocks only pushing
 * NEW content to screens (EntitlementPublishGuard), not general access.
 *
 * Spelling notes: 'canceled' (single 'l') is this codebase's spelling, and there
 * is NO 'expired' status — trial expiry flips `subscriptionStatus` to 'canceled'
 * in `billing-lifecycle.service.ts`.
 */
export const API_BLOCKED_STATUSES = new Set<string>(['suspended', 'canceled']);

/**
 * Whether an organization's CURRENT entitlement permits API access (B2).
 *
 * Deliberately a pure function of the two stored fields so the decision is
 * testable and has exactly one definition. Callers gate at authentication time;
 * keys are never revoked on downgrade, so a re-upgrade restores access without
 * destroying the customer's credentials.
 *
 * Trials are denied naturally rather than by a special case: orgs trial on tier
 * 'free' (`auth.service.ts` registration sets `subscriptionTier: 'free'`) and
 * the tier only rises on payment. There is no trial-of-Pro in this codebase.
 *
 * The two clauses are deliberately asymmetric:
 *   tier   — ALLOW-list. An absent or unrecognized tier denies (fail closed);
 *            a tier cannot acquire API access by being unknown.
 *   status — DENY-list, mirroring SubscriptionActiveGuard. Only the terminal
 *            rungs block, so an org already on an API-capable tier is not cut
 *            off by a status this function has not been taught about. Adding a
 *            new terminal rung means adding it to API_BLOCKED_STATUSES.
 * The tier gate is what a non-paying org cannot get past, and it fails closed.
 */
export function hasApiAccess(
  tier: string | null | undefined,
  status: string | null | undefined,
): boolean {
  return API_ACCESS_TIERS.has(tier ?? '') && !API_BLOCKED_STATUSES.has(status ?? '');
}
