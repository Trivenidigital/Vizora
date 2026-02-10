-- AlterTable: Add missing columns to organizations
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "razorpayCustomerId" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "razorpaySubscriptionId" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "country" TEXT;

-- AlterTable: Add missing columns to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add missing columns to devices
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "lastScreenshot" TEXT;
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "lastScreenshotAt" TIMESTAMP(3);

-- AlterTable: Add missing columns to Content
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "templateOrientation" TEXT;
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "replacementContentId" TEXT;
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "previousVersionId" TEXT;
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "versionNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "folderId" TEXT;

-- CreateTable: content_folders
CREATE TABLE IF NOT EXISTS "content_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notifications
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: api_keys
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable: billing_transactions
CREATE TABLE IF NOT EXISTS "billing_transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: plans
CREATE TABLE IF NOT EXISTS "plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "screenQuota" INTEGER NOT NULL,
    "storageQuotaMb" INTEGER NOT NULL DEFAULT 5000,
    "apiRateLimit" INTEGER NOT NULL DEFAULT 1000,
    "priceUsdMonthly" INTEGER NOT NULL,
    "priceUsdYearly" INTEGER NOT NULL,
    "priceInrMonthly" INTEGER NOT NULL,
    "priceInrYearly" INTEGER NOT NULL,
    "stripePriceIdMonthly" TEXT,
    "stripePriceIdYearly" TEXT,
    "razorpayPlanIdMonthly" TEXT,
    "razorpayPlanIdYearly" TEXT,
    "features" TEXT[],
    "featureFlags" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "highlightText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable: promotions
CREATE TABLE IF NOT EXISTS "promotions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "currency" TEXT,
    "maxRedemptions" INTEGER,
    "maxPerCustomer" INTEGER NOT NULL DEFAULT 1,
    "currentRedemptions" INTEGER NOT NULL DEFAULT 0,
    "minPurchaseAmount" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: plan_promotions
CREATE TABLE IF NOT EXISTS "plan_promotions" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,

    CONSTRAINT "plan_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: promotion_redemptions
CREATE TABLE IF NOT EXISTS "promotion_redemptions" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "discountApplied" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: system_configs
CREATE TABLE IF NOT EXISTS "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'string',
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: admin_audit_logs
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: system_announcements
CREATE TABLE IF NOT EXISTS "system_announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "targetAudience" TEXT NOT NULL DEFAULT 'all',
    "targetPlans" TEXT[],
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDismissible" BOOLEAN NOT NULL DEFAULT true,
    "linkUrl" TEXT,
    "linkText" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ip_blocklist
CREATE TABLE IF NOT EXISTS "ip_blocklist" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "reason" TEXT,
    "blockedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ip_blocklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (organizations)
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_razorpayCustomerId_key" ON "organizations"("razorpayCustomerId");
CREATE INDEX IF NOT EXISTS "organizations_razorpayCustomerId_idx" ON "organizations"("razorpayCustomerId");

-- CreateIndex (users)
CREATE INDEX IF NOT EXISTS "users_isSuperAdmin_idx" ON "users"("isSuperAdmin");

-- CreateIndex (Content)
CREATE INDEX IF NOT EXISTS "Content_expiresAt_idx" ON "Content"("expiresAt");
CREATE INDEX IF NOT EXISTS "Content_folderId_idx" ON "Content"("folderId");

-- CreateIndex (content_folders)
CREATE UNIQUE INDEX IF NOT EXISTS "content_folders_organizationId_name_parentId_key" ON "content_folders"("organizationId", "name", "parentId");
CREATE INDEX IF NOT EXISTS "content_folders_organizationId_idx" ON "content_folders"("organizationId");
CREATE INDEX IF NOT EXISTS "content_folders_parentId_idx" ON "content_folders"("parentId");

-- CreateIndex (notifications)
CREATE INDEX IF NOT EXISTS "notifications_organizationId_read_idx" ON "notifications"("organizationId", "read");
CREATE INDEX IF NOT EXISTS "notifications_organizationId_createdAt_idx" ON "notifications"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex (api_keys)
CREATE INDEX IF NOT EXISTS "api_keys_organizationId_idx" ON "api_keys"("organizationId");
CREATE INDEX IF NOT EXISTS "api_keys_prefix_idx" ON "api_keys"("prefix");

-- CreateIndex (billing_transactions)
CREATE INDEX IF NOT EXISTS "billing_transactions_organizationId_idx" ON "billing_transactions"("organizationId");
CREATE INDEX IF NOT EXISTS "billing_transactions_providerTransactionId_idx" ON "billing_transactions"("providerTransactionId");

-- CreateIndex (plans)
CREATE UNIQUE INDEX IF NOT EXISTS "plans_slug_key" ON "plans"("slug");
CREATE INDEX IF NOT EXISTS "plans_isActive_isPublic_idx" ON "plans"("isActive", "isPublic");
CREATE INDEX IF NOT EXISTS "plans_slug_idx" ON "plans"("slug");

-- CreateIndex (promotions)
CREATE UNIQUE INDEX IF NOT EXISTS "promotions_code_key" ON "promotions"("code");
CREATE INDEX IF NOT EXISTS "promotions_code_idx" ON "promotions"("code");
CREATE INDEX IF NOT EXISTS "promotions_isActive_startsAt_expiresAt_idx" ON "promotions"("isActive", "startsAt", "expiresAt");

-- CreateIndex (plan_promotions)
CREATE UNIQUE INDEX IF NOT EXISTS "plan_promotions_planId_promotionId_key" ON "plan_promotions"("planId", "promotionId");

-- CreateIndex (promotion_redemptions)
CREATE INDEX IF NOT EXISTS "promotion_redemptions_promotionId_idx" ON "promotion_redemptions"("promotionId");
CREATE INDEX IF NOT EXISTS "promotion_redemptions_organizationId_idx" ON "promotion_redemptions"("organizationId");

-- CreateIndex (system_configs)
CREATE UNIQUE INDEX IF NOT EXISTS "system_configs_key_key" ON "system_configs"("key");
CREATE INDEX IF NOT EXISTS "system_configs_category_idx" ON "system_configs"("category");

-- CreateIndex (admin_audit_logs)
CREATE INDEX IF NOT EXISTS "admin_audit_logs_adminUserId_idx" ON "admin_audit_logs"("adminUserId");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- CreateIndex (system_announcements)
CREATE INDEX IF NOT EXISTS "system_announcements_isActive_startsAt_expiresAt_idx" ON "system_announcements"("isActive", "startsAt", "expiresAt");

-- CreateIndex (ip_blocklist)
CREATE UNIQUE INDEX IF NOT EXISTS "ip_blocklist_ipAddress_key" ON "ip_blocklist"("ipAddress");
CREATE INDEX IF NOT EXISTS "ip_blocklist_isActive_idx" ON "ip_blocklist"("isActive");

-- AddForeignKeys (idempotent — skip if constraint already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_folders_parentId_fkey') THEN
    ALTER TABLE "content_folders" ADD CONSTRAINT "content_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "content_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_folders_organizationId_fkey') THEN
    ALTER TABLE "content_folders" ADD CONSTRAINT "content_folders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Content_folderId_fkey') THEN
    ALTER TABLE "Content" ADD CONSTRAINT "Content_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "content_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Content_replacementContentId_fkey') THEN
    ALTER TABLE "Content" ADD CONSTRAINT "Content_replacementContentId_fkey" FOREIGN KEY ("replacementContentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Content_previousVersionId_fkey') THEN
    ALTER TABLE "Content" ADD CONSTRAINT "Content_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_organizationId_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_userId_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_organizationId_fkey') THEN
    ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_createdById_fkey') THEN
    ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_transactions_organizationId_fkey') THEN
    ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_promotions_planId_fkey') THEN
    ALTER TABLE "plan_promotions" ADD CONSTRAINT "plan_promotions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_promotions_promotionId_fkey') THEN
    ALTER TABLE "plan_promotions" ADD CONSTRAINT "plan_promotions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_redemptions_promotionId_fkey') THEN
    ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
