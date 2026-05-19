-- Migration: add_webhooks
--
-- O5 (lean cut) — outbound HTTP delivery of org events. Per-org webhook
-- subscriptions; the dispatcher signs payloads with HMAC-SHA256 and POSTs
-- to the customer URL.
--
-- v1 omits a separate WebhookDelivery audit table — lastDeliveryAt /
-- lastError / failureCount on the row cover ops-visibility. Full per-
-- delivery audit is a follow-up.
--
-- Audit ref: docs/plans/2026-05-17-optsigns-vizora-feature-gap.md P1 #10

CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastDeliveryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhooks_organizationId_name_key" ON "webhooks"("organizationId", "name");
CREATE INDEX "webhooks_organizationId_isActive_idx" ON "webhooks"("organizationId", "isActive");

ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
