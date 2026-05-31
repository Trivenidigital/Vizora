-- Migration: agent_runs
--
-- Adds the AgentRun model for per-firing observability of Hermes-driven
-- agent invocations, plus a nullable agentRunId FK on mcp_audit_log so
-- the insights-poller sidecar can attribute audit rows to specific firings.
--
-- See: docs/plans/2026-05-08-agent-platform-redesign-design.md §2.1, §2.3
-- ADL-7: Cost columns are FROZEN at write — never recomputed.
--
-- Migration is purely additive:
--   * NEW TABLE: agent_runs
--   * NEW COLUMN: mcp_audit_log.agentRunId (NULLABLE — no backfill needed)
-- No data is rewritten; no existing column types change.

-- AlterTable: mcp_audit_log gets a nullable FK to agent_runs.
ALTER TABLE "mcp_audit_log" ADD COLUMN "agentRunId" TEXT;

-- CreateTable: agent_runs (per-firing record).
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "organizationId" TEXT,
    "pid" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "exitCode" INTEGER,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "costMicrodollars" INTEGER,
    "rateInUsdPerMt" DECIMAL(8,4),
    "rateOutUsdPerMt" DECIMAL(8,4),
    "model" TEXT,
    "outcome" TEXT NOT NULL,
    "errorExcerpt" VARCHAR(1024),
    "preflightBalanceUsd" DECIMAL(12,8),
    "preflightTodaySpendUsd" DECIMAL(12,8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: per-firing audit join key (sidecar refinement query).
CREATE INDEX "mcp_audit_log_agentRunId_idx" ON "mcp_audit_log"("agentRunId");

-- CreateIndex: time-series dashboard queries per skill.
CREATE INDEX "agent_runs_skillName_startedAt_idx" ON "agent_runs"("skillName", "startedAt");

-- CreateIndex: failure-rate alerting.
CREATE INDEX "agent_runs_outcome_startedAt_idx" ON "agent_runs"("outcome", "startedAt");

-- CreateIndex: cost-per-model breakdown queries.
CREATE INDEX "agent_runs_model_startedAt_idx" ON "agent_runs"("model", "startedAt");

-- CreateIndex: 90-day retention DELETE scan in db-maintainer.
CREATE INDEX "agent_runs_createdAt_idx" ON "agent_runs"("createdAt");

-- CreateIndex: per-tenant cost attribution queries.
CREATE INDEX "agent_runs_organizationId_startedAt_idx" ON "agent_runs"("organizationId", "startedAt");

-- AddForeignKey: mcp_audit_log → agent_runs (SetNull on agent_run delete).
ALTER TABLE "mcp_audit_log" ADD CONSTRAINT "mcp_audit_log_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: agent_runs → organizations (SetNull on org delete to preserve historical cost rows).
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
