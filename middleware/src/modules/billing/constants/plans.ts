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
