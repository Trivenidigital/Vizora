-- B3 entitlement ladder: track when the org entered its current entitlement rung.
-- The ladder job keys grace windows on this column instead of updatedAt, so an
-- unrelated org write no longer silently resets the grace clock.
ALTER TABLE "Organization" ADD COLUMN "entitlementStateSince" TIMESTAMP(3);

-- Backfill existing past_due orgs so the ladder has a defined start; use updatedAt
-- as the best available approximation of when they entered the rung.
UPDATE "Organization" SET "entitlementStateSince" = "updatedAt"
  WHERE "subscriptionStatus" IN ('past_due', 'publish_locked', 'suspended')
    AND "entitlementStateSince" IS NULL;
