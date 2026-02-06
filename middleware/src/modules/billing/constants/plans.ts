/**
 * Plan tier configuration for Vizora billing
 * All prices are in cents (USD) or paise (INR)
 */

export interface PlanTier {
  id: string;
  name: string;
  screenQuota: number; // -1 for unlimited
  prices: {
    usd: { monthly: number; yearly: number; stripePriceId?: string };
    inr: { monthly: number; yearly: number; razorpayPlanId?: string };
  };
  features: string[];
}

/**
 * Base plan configurations without provider-specific IDs
 * Provider IDs are resolved at runtime via getPriceId()
 */
export const PLAN_TIERS: Record<string, PlanTier> = {
  free: {
    id: 'free',
    name: 'Free',
    screenQuota: 5,
    prices: {
      usd: { monthly: 0, yearly: 0 },
      inr: { monthly: 0, yearly: 0 },
    },
    features: ['Basic scheduling', 'Content upload', 'Up to 5 screens'],
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    screenQuota: 25,
    prices: {
      usd: {
        monthly: 2900,
        yearly: 29000,
      },
      inr: {
        monthly: 199900,
        yearly: 1999000,
      },
    },
    features: [
      'Everything in Free',
      'Analytics dashboard',
      'Email support',
      'Up to 25 screens',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    screenQuota: 100,
    prices: {
      usd: {
        monthly: 9900,
        yearly: 99000,
      },
      inr: {
        monthly: 699900,
        yearly: 6999000,
      },
    },
    features: [
      'Everything in Basic',
      'API access',
      'Priority support',
      'Up to 100 screens',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    screenQuota: -1, // unlimited
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
