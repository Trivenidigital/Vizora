-- Fix schema integrity issues found during pre-pilot production audit
-- Note: Table names use Prisma @@map values (lowercase with underscores)

-- 1. Add unique constraint on api_keys.hashedKey (prevent duplicate hashes)
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_hashedKey_key" ON "api_keys"("hashedKey");

-- 2. Add compound index on api_keys [prefix, hashedKey] for faster lookups
CREATE INDEX IF NOT EXISTS "ApiKey_prefix_hashedKey_idx" ON "api_keys"("prefix", "hashedKey");

-- 3. Add unique constraint on billing_transactions [provider, providerTransactionId]
CREATE UNIQUE INDEX IF NOT EXISTS "BillingTransaction_provider_providerTransactionId_key" ON "billing_transactions"("provider", "providerTransactionId");

-- 4. Add updatedAt column to notifications model
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "notifications" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

-- 5. Add updatedAt column to billing_transactions model
ALTER TABLE "billing_transactions" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "billing_transactions" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
