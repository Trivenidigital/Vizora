-- Migration: add_webhook_deliveries
--
-- O5 follow-up — per-delivery audit log for outbound webhook attempts.
--
-- Records every deliver() attempt (success / failure / SSRF-blocked) so
-- customers can debug their endpoint via GET /webhooks/:id/deliveries.
-- Body and HMAC signature deliberately NOT stored (size + secret-
-- recovery surface).
--
-- See packages/database/prisma/schema.prisma `model WebhookDelivery`.

CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- Primary listing query: newest first per webhook.
CREATE INDEX "webhook_deliveries_webhookId_attemptedAt_idx"
    ON "webhook_deliveries"("webhookId", "attemptedAt" DESC);

-- Future cross-webhook org view + reporting.
CREATE INDEX "webhook_deliveries_organizationId_attemptedAt_idx"
    ON "webhook_deliveries"("organizationId", "attemptedAt" DESC);

-- Retention sweep (delete WHERE attemptedAt < cutoff).
CREATE INDEX "webhook_deliveries_attemptedAt_idx"
    ON "webhook_deliveries"("attemptedAt");

ALTER TABLE "webhook_deliveries"
    ADD CONSTRAINT "webhook_deliveries_webhookId_fkey"
    FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_deliveries"
    ADD CONSTRAINT "webhook_deliveries_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
