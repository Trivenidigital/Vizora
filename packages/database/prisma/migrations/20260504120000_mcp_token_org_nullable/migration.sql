-- Make `organizationId` nullable on `mcp_tokens` to support platform-scope
-- agents (customer-lifecycle, agent-orchestrator) that work across orgs.
--
-- Per-org tools (list_displays, list_open_support_requests, etc) must
-- reject null-org tokens. Platform-only tools accept null and operate
-- across all orgs. See middleware/src/modules/mcp/auth/mcp-context.ts
-- and the per-tool handlers for the runtime checks.
--
-- Existing tokens are unaffected — only future issuances may set null.

-- DropForeignKey
ALTER TABLE "mcp_tokens" DROP CONSTRAINT "mcp_tokens_organizationId_fkey";

-- AlterColumn: organizationId TEXT NOT NULL -> TEXT NULL
ALTER TABLE "mcp_tokens" ALTER COLUMN "organizationId" DROP NOT NULL;

-- ReAddForeignKey (same shape, but the column is now nullable so the FK
-- itself becomes effectively conditional — null orgId means no FK row)
ALTER TABLE "mcp_tokens"
    ADD CONSTRAINT "mcp_tokens_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
