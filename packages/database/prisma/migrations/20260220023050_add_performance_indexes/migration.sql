/*
  Warnings:

  - Made the column `updatedAt` on table `billing_transactions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `notifications` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "billing_transactions" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Playlist_organizationId_updatedAt_idx" ON "Playlist"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Schedule_displayId_startDate_endDate_idx" ON "Schedule"("displayId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Schedule_displayGroupId_startDate_endDate_idx" ON "Schedule"("displayGroupId", "startDate", "endDate");

-- RenameIndex
ALTER INDEX "ApiKey_hashedKey_key" RENAME TO "api_keys_hashedKey_key";

-- RenameIndex
ALTER INDEX "ApiKey_prefix_hashedKey_idx" RENAME TO "api_keys_prefix_hashedKey_idx";

-- RenameIndex
ALTER INDEX "BillingTransaction_provider_providerTransactionId_key" RENAME TO "billing_transactions_provider_providerTransactionId_key";
