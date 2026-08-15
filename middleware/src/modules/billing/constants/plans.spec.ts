import { API_ACCESS_TIERS, API_BLOCKED_STATUSES, hasApiAccess } from './plans';

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
