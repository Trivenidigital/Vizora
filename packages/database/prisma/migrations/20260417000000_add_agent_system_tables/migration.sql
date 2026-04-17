-- Agent System (customer-facing automation) — 2026-04-17
-- Adds three new tables + one column on support_messages. All additive.

-- AlterTable: support_messages.authorType
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_messages'
      AND column_name = 'authorType'
  ) THEN
    ALTER TABLE "support_messages" ADD COLUMN "authorType" TEXT NOT NULL DEFAULT 'user';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "support_messages_requestId_authorType_idx"
  ON "support_messages" ("requestId", "authorType");

-- CreateTable: organization_onboarding
CREATE TABLE IF NOT EXISTS "organization_onboarding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "welcomeEmailSentAt" TIMESTAMP(3),
  "firstScreenPairedAt" TIMESTAMP(3),
  "firstContentUploadedAt" TIMESTAMP(3),
  "firstPlaylistCreatedAt" TIMESTAMP(3),
  "firstScheduleCreatedAt" TIMESTAMP(3),
  "day1NudgeSentAt" TIMESTAMP(3),
  "day3NudgeSentAt" TIMESTAMP(3),
  "day7NudgeSentAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_onboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_onboarding_organizationId_key"
  ON "organization_onboarding" ("organizationId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organization_onboarding_organizationId_fkey'
      AND table_name = 'organization_onboarding'
  ) THEN
    ALTER TABLE "organization_onboarding"
      ADD CONSTRAINT "organization_onboarding_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: customer_incidents
CREATE TABLE IF NOT EXISTS "customer_incidents" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agent" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "remediation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "notifiedAt" TIMESTAMP(3),
  CONSTRAINT "customer_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_incidents_organizationId_status_idx"
  ON "customer_incidents" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "customer_incidents_agent_type_idx"
  ON "customer_incidents" ("agent", "type");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customer_incidents_organizationId_fkey'
      AND table_name = 'customer_incidents'
  ) THEN
    ALTER TABLE "customer_incidents"
      ADD CONSTRAINT "customer_incidents_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: content_recommendations
CREATE TABLE IF NOT EXISTS "content_recommendations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "contentId" TEXT,
  "playlistId" TEXT,
  "summary" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissedAt" TIMESTAMP(3),
  CONSTRAINT "content_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "content_recommendations_organizationId_createdAt_idx"
  ON "content_recommendations" ("organizationId", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'content_recommendations_organizationId_fkey'
      AND table_name = 'content_recommendations'
  ) THEN
    ALTER TABLE "content_recommendations"
      ADD CONSTRAINT "content_recommendations_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
