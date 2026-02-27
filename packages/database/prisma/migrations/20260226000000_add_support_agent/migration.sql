-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" VARCHAR(255),
    "description" TEXT NOT NULL,
    "aiSummary" TEXT,
    "aiSuggestedAction" TEXT,
    "pageUrl" VARCHAR(500),
    "browserInfo" VARCHAR(255),
    "consoleErrors" TEXT,
    "resolutionNotes" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportRequest_organizationId_idx" ON "SupportRequest"("organizationId");
CREATE INDEX "SupportRequest_status_idx" ON "SupportRequest"("status");
CREATE INDEX "SupportRequest_priority_idx" ON "SupportRequest"("priority");
CREATE INDEX "SupportRequest_userId_idx" ON "SupportRequest"("userId");
CREATE INDEX "SupportRequest_organizationId_status_idx" ON "SupportRequest"("organizationId", "status");
CREATE INDEX "SupportRequest_organizationId_createdAt_idx" ON "SupportRequest"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_requestId_idx" ON "SupportMessage"("requestId");
CREATE INDEX "SupportMessage_organizationId_idx" ON "SupportMessage"("organizationId");

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
