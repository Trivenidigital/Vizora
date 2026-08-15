import {
  API_ACCESS_TIERS,
  API_BLOCKED_STATUSES,
  hasApiAccess,
  getRazorpayPlanId,
  razorpayPlanIdToTier,
  stripePriceIdToTier,
  getBillingPlanIdConflicts,
} from './plans';

/**
 * B2 — the entitlement predicate behind the API-key gate.
 *
 * These assertions are the machine-readable statement of a PRODUCT promise
 * ('API access' is a Pro feature). A change that makes one of them red is a
 * pricing change, not a test that needs updating.
 */
describe('API access entitlement (B2)', () => {
  describe('API_ACCESS_TIERS', () => {
    it('contains exactly the tiers whose plan promises API access', () => {
      expect([...API_ACCESS_TIERS].sort()).toEqual(['enterprise', 'pro']);
    });

    it('excludes free and basic', () => {
      expect(API_ACCESS_TIERS.has('free')).toBe(false);
      expect(API_ACCESS_TIERS.has('basic')).toBe(false);
    });
  });

  describe('API_BLOCKED_STATUSES', () => {
    it('is the terminal deny set, mirroring SubscriptionActiveGuard', () => {
      expect([...API_BLOCKED_STATUSES].sort()).toEqual(['canceled', 'suspended']);
    });

    it('does NOT block the dunning rungs that keep access (B3 ladder consistency)', () => {
      expect(API_BLOCKED_STATUSES.has('past_due')).toBe(false);
      expect(API_BLOCKED_STATUSES.has('publish_locked')).toBe(false);
    });
  });

  describe('hasApiAccess', () => {
    it.each([
      ['pro', 'active'],
      ['enterprise', 'active'],
      ['pro', 'past_due'],
      ['pro', 'publish_locked'],
      ['enterprise', 'past_due'],
    ])('allows tier=%s status=%s', (tier, status) => {
      expect(hasApiAccess(tier, status)).toBe(true);
    });

    it.each([
      ['free', 'active'],
      ['basic', 'active'],
      ['free', 'trial'],
      ['pro', 'suspended'],
      ['pro', 'canceled'],
      ['enterprise', 'suspended'],
      ['enterprise', 'canceled'],
    ])('denies tier=%s status=%s', (tier, status) => {
      expect(hasApiAccess(tier, status)).toBe(false);
    });

    it('denies a fresh signup — orgs trial on tier free, so trials need no special case', () => {
      expect(hasApiAccess('free', 'trial')).toBe(false);
    });

    it('fails closed on the TIER clause — an unknown tier never gains access', () => {
      expect(hasApiAccess(null, null)).toBe(false);
      expect(hasApiAccess(undefined, undefined)).toBe(false);
      expect(hasApiAccess(null, 'active')).toBe(false);
      expect(hasApiAccess(undefined, 'active')).toBe(false);
      expect(hasApiAccess('made-up-tier', 'active')).toBe(false);
      expect(hasApiAccess('', '')).toBe(false);
      expect(hasApiAccess('Pro', 'active')).toBe(false); // case-sensitive by design
    });

    it('treats an unknown STATUS on an API tier as allowed (deny-list, not allow-list)', () => {
      // Asymmetric on purpose: only the terminal rungs block, so an org on a
      // paid tier is never cut off by a status this predicate has not been
      // taught about. New terminal rungs go in API_BLOCKED_STATUSES.
      expect(hasApiAccess('pro', null)).toBe(true);
      expect(hasApiAccess('pro', undefined)).toBe(true);
      expect(hasApiAccess('pro', 'some_future_status')).toBe(true);
    });

    it('requires BOTH clauses — neither tier nor status alone decides', () => {
      // Status-only would wrongly allow this (status is fine, tier is not).
      expect(hasApiAccess('free', 'active')).toBe(false);
      // Tier-only would wrongly allow this (tier is fine, status is not).
      expect(hasApiAccess('pro', 'suspended')).toBe(false);
    });
  });
});

/**
 * B3-E1 — the provider plan-id ↔ tier mapping.
 *
 * The forward direction decides what the customer is CHARGED; the reverse
 * direction decides what they are ENTITLED to. Both are money bugs when wrong,
 * so both are pinned here rather than only exercised through the service.
 */
describe('provider plan id resolution (B3-E1)', () => {
  const KEYS = [
    'RAZORPAY_PRO_PLAN_ID',
    'RAZORPAY_PRO_MONTHLY_PLAN_ID',
    'RAZORPAY_PRO_YEARLY_PLAN_ID',
    'RAZORPAY_BASIC_PLAN_ID',
    'RAZORPAY_BASIC_MONTHLY_PLAN_ID',
    'RAZORPAY_BASIC_YEARLY_PLAN_ID',
    'RAZORPAY_ENTERPRISE_PLAN_ID',
    'RAZORPAY_ENTERPRISE_MONTHLY_PLAN_ID',
    'RAZORPAY_ENTERPRISE_YEARLY_PLAN_ID',
    'STRIPE_BASIC_MONTHLY_PRICE_ID',
    'STRIPE_BASIC_YEARLY_PRICE_ID',
    'STRIPE_PRO_MONTHLY_PRICE_ID',
    'STRIPE_PRO_YEARLY_PRICE_ID',
    'STRIPE_ENTERPRISE_MONTHLY_PRICE_ID',
    'STRIPE_ENTERPRISE_YEARLY_PRICE_ID',
  ];
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    KEYS.forEach((k) => {
      saved[k] = process.env[k];
      delete process.env[k];
    });
  });

  afterEach(() => {
    KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  describe('getRazorpayPlanId', () => {
    it('prefers the interval-scoped var', () => {
      process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID = 'plan_m';
      process.env.RAZORPAY_PRO_YEARLY_PLAN_ID = 'plan_y';
      expect(getRazorpayPlanId('pro', 'monthly')).toBe('plan_m');
      expect(getRazorpayPlanId('pro', 'yearly')).toBe('plan_y');
    });

    it('falls back to the legacy var as the MONTHLY alias only', () => {
      process.env.RAZORPAY_PRO_PLAN_ID = 'plan_legacy';
      expect(getRazorpayPlanId('pro', 'monthly')).toBe('plan_legacy');
      // Never for yearly: silently re-billing a yearly customer at the monthly
      // cadence is worse than refusing the checkout.
      expect(getRazorpayPlanId('pro', 'yearly')).toBeUndefined();
    });

    it('treats an empty env value as unset', () => {
      process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID = '';
      process.env.RAZORPAY_PRO_PLAN_ID = '';
      expect(getRazorpayPlanId('pro', 'monthly')).toBeUndefined();
    });
  });

  describe('razorpayPlanIdToTier / stripePriceIdToTier', () => {
    it('reverse-maps interval-scoped and legacy ids alike', () => {
      process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID = 'plan_pro_m';
      process.env.RAZORPAY_PRO_YEARLY_PLAN_ID = 'plan_pro_y';
      process.env.RAZORPAY_BASIC_PLAN_ID = 'plan_basic_legacy';

      expect(razorpayPlanIdToTier('plan_pro_m')).toEqual({ tier: 'pro', interval: 'monthly' });
      expect(razorpayPlanIdToTier('plan_pro_y')).toEqual({ tier: 'pro', interval: 'yearly' });
      expect(razorpayPlanIdToTier('plan_basic_legacy')).toEqual({
        tier: 'basic',
        interval: 'monthly',
      });
    });

    it('still resolves a legacy id that an interval-scoped var has superseded', () => {
      // An in-flight subscription can still sit on the legacy plan after the
      // interval-scoped var is introduced; losing its tier would downgrade it.
      process.env.RAZORPAY_PRO_PLAN_ID = 'plan_old';
      process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID = 'plan_new';
      expect(razorpayPlanIdToTier('plan_old')).toEqual({ tier: 'pro', interval: 'monthly' });
      expect(razorpayPlanIdToTier('plan_new')).toEqual({ tier: 'pro', interval: 'monthly' });
    });

    it('returns null — never a tier — for an unknown or absent id', () => {
      expect(razorpayPlanIdToTier('plan_never_configured')).toBeNull();
      expect(razorpayPlanIdToTier(undefined)).toBeNull();
      expect(stripePriceIdToTier('price_never_configured')).toBeNull();
      expect(stripePriceIdToTier('')).toBeNull();
    });

    it('reads env at CALL time, so a config change is picked up immediately', () => {
      expect(razorpayPlanIdToTier('plan_late')).toBeNull();
      process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID = 'plan_late';
      expect(razorpayPlanIdToTier('plan_late')).toEqual({ tier: 'pro', interval: 'monthly' });
    });

    it('maps Stripe price ids the same way (parity)', () => {
      process.env.STRIPE_PRO_YEARLY_PRICE_ID = 'price_pro_y';
      expect(stripePriceIdToTier('price_pro_y')).toEqual({ tier: 'pro', interval: 'yearly' });
    });
  });

  describe('getBillingPlanIdConflicts', () => {
    it('reports nothing when no provider ids are configured at all', () => {
      // Production runs with zero Razorpay plan ids; unset must not look like a
      // collapse of every tier onto the empty string.
      expect(getBillingPlanIdConflicts()).toEqual([]);
    });

    it('reports one plan id shared by two tiers', () => {
      process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID = 'plan_same';
      process.env.RAZORPAY_BASIC_MONTHLY_PLAN_ID = 'plan_same';

      const conflicts = getBillingPlanIdConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({ provider: 'razorpay', planId: 'plan_same' });
    });

    it('reports one plan id shared by two INTERVALS of the same tier', () => {
      process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID = 'plan_same';
      process.env.RAZORPAY_PRO_YEARLY_PLAN_ID = 'plan_same';
      expect(getBillingPlanIdConflicts()).toHaveLength(1);
    });

    it('does NOT report the legacy alias holding the same value as its monthly var', () => {
      process.env.RAZORPAY_PRO_PLAN_ID = 'plan_pro';
      process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID = 'plan_pro';
      expect(getBillingPlanIdConflicts()).toEqual([]);
    });
  });
});
