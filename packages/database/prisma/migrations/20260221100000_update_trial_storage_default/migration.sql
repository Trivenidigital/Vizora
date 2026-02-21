-- AlterTable: Change default storage quota from 5GB to 1GB for new organizations (trial)
ALTER TABLE "organizations" ALTER COLUMN "storageQuotaBytes" SET DEFAULT 1073741824;
