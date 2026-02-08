-- Fix schema integrity issues found during pre-pilot production audit

-- 1. Add unique constraint on ApiKey.hashedKey (prevent duplicate hashes)
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_hashedKey_key" ON "ApiKey"("hashedKey");

-- 2. Add compound index on ApiKey [prefix, hashedKey] for faster lookups
CREATE INDEX IF NOT EXISTS "ApiKey_prefix_hashedKey_idx" ON "ApiKey"("prefix", "hashedKey");

-- 3. Add unique constraint on BillingTransaction [provider, providerTransactionId]
CREATE UNIQUE INDEX IF NOT EXISTS "BillingTransaction_provider_providerTransactionId_key" ON "BillingTransaction"("provider", "providerTransactionId");

-- 4. Add updatedAt column to Notification model
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
-- Set existing rows to createdAt, then make it auto-update
UPDATE "Notification" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

-- 5. Add updatedAt column to BillingTransaction model
ALTER TABLE "BillingTransaction" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "BillingTransaction" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
