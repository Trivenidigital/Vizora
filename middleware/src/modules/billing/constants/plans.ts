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

/**
 * Get the Stripe price ID for a plan and interval
 * Reads from environment variables at runtime for testability
 */
export const getStripePriceId = (
  planId: string,
  interval: 'monthly' | 'yearly',
): string | undefined => {
  const envKey = `STRIPE_${planId.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`;
  return process.env[envKey];
};

/**
 * Get the Razorpay plan ID for a plan
 * Reads from environment variables at runtime for testability
 */
export const getRazorpayPlanId = (planId: string): string | undefined => {
  const envKey = `RAZORPAY_${planId.toUpperCase()}_PLAN_ID`;
  return process.env[envKey];
};

/**
 * Get the screen quota for a given tier
 * Returns 5 (free tier default) if tier not found
 */
export const getScreenQuotaForTier = (tier: string): number => {
  return PLAN_TIERS[tier]?.screenQuota ?? 5;
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
