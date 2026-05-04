-- CreateTable: mcp_tokens
CREATE TABLE "mcp_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "mcp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tokens_tokenHash_key" ON "mcp_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "mcp_tokens_organizationId_idx" ON "mcp_tokens"("organizationId");

-- CreateIndex
CREATE INDEX "mcp_tokens_agentName_idx" ON "mcp_tokens"("agentName");

-- AddForeignKey
ALTER TABLE "mcp_tokens"
    ADD CONSTRAINT "mcp_tokens_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: mcp_audit_log
CREATE TABLE "mcp_audit_log" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT,
    "agentName" TEXT NOT NULL,
    "organizationId" TEXT,
    "tool" TEXT,
    "paramsRedacted" JSONB,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcp_audit_log_tokenId_createdAt_idx" ON "mcp_audit_log"("tokenId", "createdAt");

-- CreateIndex
CREATE INDEX "mcp_audit_log_agentName_createdAt_idx" ON "mcp_audit_log"("agentName", "createdAt");

-- CreateIndex
CREATE INDEX "mcp_audit_log_organizationId_createdAt_idx" ON "mcp_audit_log"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "mcp_audit_log"
    ADD CONSTRAINT "mcp_audit_log_tokenId_fkey"
    FOREIGN KEY ("tokenId") REFERENCES "mcp_tokens"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
