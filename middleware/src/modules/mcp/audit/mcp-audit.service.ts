import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { redactSecrets } from '../lib/redact';

/**
 * Append-only audit log for every MCP tool call. Persists to the
 * `mcp_audit_log` Prisma table. Best-effort — if the audit write
 * fails we log + swallow rather than fail the user-visible request
 * (the call itself already happened or didn't; flagging it via
 * stdout is the right fallback).
 *
 * Inputs are passed through `redactSecrets` (same anchored regex as
 * `AgentStateService`) before persistence — no `password` /
 * `apiKey` / etc. ever lands in the audit row.
 */
@Injectable()
export class McpAuditService {
  private readonly logger = new Logger(McpAuditService.name);

  constructor(private readonly db: DatabaseService) {}

  async record(entry: {
    tokenId: string | null;
    agentName: string;
    organizationId: string | null;
    tool: string | null;
    paramsRaw: unknown;
    status: 'success' | 'error';
    errorCode?: string;
    latencyMs: number;
  }): Promise<void> {
    try {
      await this.db.mcpAuditLog.create({
        data: {
          tokenId: entry.tokenId,
          agentName: entry.agentName,
          organizationId: entry.organizationId,
          tool: entry.tool,
          paramsRedacted: redactSecrets(entry.paramsRaw) as object | null,
          status: entry.status,
          errorCode: entry.errorCode,
          latencyMs: entry.latencyMs,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write MCP audit row (agent=${entry.agentName} tool=${entry.tool}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
