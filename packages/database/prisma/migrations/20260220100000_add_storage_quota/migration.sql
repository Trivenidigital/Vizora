-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "storageUsedBytes" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN "storageQuotaBytes" BIGINT NOT NULL DEFAULT 5368709120;
