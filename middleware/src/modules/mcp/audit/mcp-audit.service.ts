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
    scope?: string;
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
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to write MCP audit row (agent=${entry.agentName} tool=${entry.tool}): ${message}`,
      );
      // §12b: a WRITE tool just mutated state (a lifecycle tool may have
      // sent a real customer email) and now has NO durable audit row.
      // That must not be silent — fire an out-of-band operator alert at
      // the write site. Read-tool audit-write failures stay log-only:
      // no mutation was lost, so there's nothing to reconcile.
      if (entry.scope?.endsWith(':write')) {
        this.alertWriteAuditFailure(entry, message);
      }
    }
  }

  /**
   * Out-of-band operator alert for a WRITE-tool audit-log write failure.
   * Routes through Sentry (already wired in middleware; it fans out to
   * whichever channels ops configured on the project — Slack/PagerDuty/
   * email) so a mutation with no durable audit row can't pass unnoticed.
   *
   * Lazy-require Sentry so unit tests don't need the module mocked
   * (mirrors CircuitBreakerService's write-site alert).
   */
  private alertWriteAuditFailure(
    entry: {
      agentName: string;
      tool: string | null;
      scope?: string;
      organizationId: string | null;
    },
    errorMessage: string,
  ): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/nestjs');
      Sentry.captureMessage(
        `MCP write-tool mutation not audited — audit write failed (tool=${entry.tool} scope=${entry.scope})`,
        {
          level: 'error',
          tags: {
            event: 'mcp_audit_write_failed',
            tool: entry.tool ?? 'unknown',
            scope: entry.scope ?? 'unknown',
          },
          extra: {
            agentName: entry.agentName,
            organizationId: entry.organizationId,
            errorMessage,
          },
        },
      );
    } catch {
      /* Sentry not loaded in this context (e.g. unit tests) — the
         logger.error above is the fallback signal. */
    }
  }
}
