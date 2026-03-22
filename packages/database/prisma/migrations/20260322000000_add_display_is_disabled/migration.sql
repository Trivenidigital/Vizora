-- AlterTable: add isDisabled column to devices
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "isDisabled" BOOLEAN NOT NULL DEFAULT false;
