-- Migration: add_alert_rules
--
-- O7 — Configurable downtime alert rules.
--
-- Creates two tables:
--   * alert_rules — per-org rules with scope (all/tag/group/display),
--     minOfflineSec debounce, lastFiredAt dedup window
--   * alert_rule_recipients — N recipients per rule, one of three channels
--     (in_app/email/slack_webhook)
--
-- The hard-coded `@OnEvent('device.offline')` handler in
-- middleware/src/modules/notifications/notifications.service.ts is replaced
-- by a rule-driven evaluator. A separate post-migrate seed script at
-- packages/database/scripts/seed-default-alert-rules.ts inserts one default
-- rule per existing org (preserving historical broadcast-to-all-admins
-- behavior). Run via:
--   npx tsx packages/database/scripts/seed-default-alert-rules.ts
--
-- See tasks/plans/o7-configurable-alert-rules-{plan,design}.md for the full
-- rationale + per-step review record.

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scope" TEXT NOT NULL,
    "scopeTagId" TEXT,
    "scopeGroupId" TEXT,
    "scopeDisplayId" TEXT,
    "minOfflineSec" INTEGER NOT NULL DEFAULT 120,
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rule_recipients" (
    "id" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rule_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alert_rules_organizationId_name_key" ON "alert_rules"("organizationId", "name");

-- CreateIndex
CREATE INDEX "alert_rules_organizationId_isActive_idx" ON "alert_rules"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "alert_rules_scopeTagId_idx" ON "alert_rules"("scopeTagId");

-- CreateIndex
CREATE INDEX "alert_rules_scopeGroupId_idx" ON "alert_rules"("scopeGroupId");

-- CreateIndex
CREATE INDEX "alert_rules_scopeDisplayId_idx" ON "alert_rules"("scopeDisplayId");

-- CreateIndex
CREATE INDEX "alert_rule_recipients_alertRuleId_idx" ON "alert_rule_recipients"("alertRuleId");

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_scopeTagId_fkey" FOREIGN KEY ("scopeTagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_scopeGroupId_fkey" FOREIGN KEY ("scopeGroupId") REFERENCES "DisplayGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_scopeDisplayId_fkey" FOREIGN KEY ("scopeDisplayId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rule_recipients" ADD CONSTRAINT "alert_rule_recipients_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
