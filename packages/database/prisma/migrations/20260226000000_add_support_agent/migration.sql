-- CreateTable
CREATE TABLE "support_requests" (
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

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_requests_organizationId_idx" ON "support_requests"("organizationId");
CREATE INDEX "support_requests_status_idx" ON "support_requests"("status");
CREATE INDEX "support_requests_priority_idx" ON "support_requests"("priority");
CREATE INDEX "support_requests_userId_idx" ON "support_requests"("userId");
CREATE INDEX "support_requests_organizationId_status_idx" ON "support_requests"("organizationId", "status");
CREATE INDEX "support_requests_organizationId_createdAt_idx" ON "support_requests"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "support_messages_requestId_idx" ON "support_messages"("requestId");
CREATE INDEX "support_messages_organizationId_idx" ON "support_messages"("organizationId");

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
