-- Migration: add_alert_rule_fires
--
-- Follow-up to 20260519050346_add_alert_rules.
--
-- Per-(rule, device) dedup. The original O7 design used a single
-- `lastFiredAt` column on alert_rules. A code review caught that a
-- rule matching N devices would only fire for the FIRST device offline
-- in the dedup window — the other N-1 outages would be silently
-- suppressed. Per-device dedup fixes this.
--
-- - `alert_rule_fires` is mutable state (lastFiredAt), not an audit log.
--   One row per historical (rule, device) pair, NOT one per fire.
-- - `lastFiredAt` column is dropped from `alert_rules` (replaced by this
--   table's column).
-- - Both FKs cascade-delete: removing a rule or a display purges its
--   fire-state rows.
--
-- Atomic claim in code: `AlertRulesService.tryClaimDedupWindow(ruleId,
-- deviceId, now)` does updateMany with `lastFiredAt < threshold`
-- predicate, falls back to create on count===0 + catches P2002 to
-- collapse races.

-- CreateTable
CREATE TABLE "alert_rule_fires" (
    "id" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastFiredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rule_fires_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (one fire-state row per (rule, device) pair)
CREATE UNIQUE INDEX "alert_rule_fires_alertRuleId_deviceId_key" ON "alert_rule_fires"("alertRuleId", "deviceId");

-- CreateIndex (supports the future db-maintainer prune sweep on stale rows)
CREATE INDEX "alert_rule_fires_lastFiredAt_idx" ON "alert_rule_fires"("lastFiredAt");

-- AddForeignKey
ALTER TABLE "alert_rule_fires" ADD CONSTRAINT "alert_rule_fires_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rule_fires" ADD CONSTRAINT "alert_rule_fires_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the now-unused per-rule dedup column.
-- Safe to drop without a backfill — the rule-level dedup field is being
-- replaced wholesale by per-(rule, device) state in alert_rule_fires.
ALTER TABLE "alert_rules" DROP COLUMN "lastFiredAt";
