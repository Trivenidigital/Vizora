-- AlterTable: Add GSTIN (GST Identification Number) field for Indian organizations
ALTER TABLE "organizations" ADD COLUMN "gstin" TEXT;
