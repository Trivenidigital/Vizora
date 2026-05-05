import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpServer as McpServerCtor } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpRequestContext } from './auth/mcp-context';
import { McpAuditService } from './audit/mcp-audit.service';
import { ShadowLogService } from './audit/shadow-log.service';
import { mapExceptionToMcpError } from './lib/error-mapping';
import { DisplaysService } from '../displays/displays.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { SupportService } from '../support/support.service';
import { LIST_DISPLAYS_TOOL } from './tools/displays.tools';
import {
  AUTO_COMPLETE_ORG_ONBOARDING_TOOL,
  LIST_ONBOARDING_CANDIDATES_TOOL,
  MARK_ONBOARDING_NUDGE_SENT_TOOL,
  SEND_LIFECYCLE_NUDGE_EMAIL_TOOL,
} from './tools/organizations.tools';
import { LOG_SHADOW_ROW_TOOL } from './tools/shadow-log.tools';
import {
  CREATE_SUPPORT_MESSAGE_TOOL,
  LIST_OPEN_SUPPORT_REQUESTS_TOOL,
  UPDATE_SUPPORT_REQUEST_AI_CATEGORY_TOOL,
  UPDATE_SUPPORT_REQUEST_PRIORITY_TOOL,
} from './tools/support.tools';

/**
 * Builds a fresh `McpServer` per incoming HTTP request. The SDK's
 * `Server.connect(transport)` is single-shot — calling it twice on the
 * same instance throws "Already connected to a transport" (we hit this
 * exact failure in prod after PR #42 / #43 / #44 went live, on the
 * second authenticated request). The fix is to pair each `transport`
 * with a fresh `McpServer`; both die together when the request ends.
 *
 * Cost: object construction + a few `registerTool` calls (no I/O).
 * Negligible vs the actual tool work.
 *
 * Tool handlers receive their per-request `McpRequestContext` via
 * closure capture, NOT via SDK auth-info plumbing — see PR #46 for
 * why (the SDK silently drops `authInfo.extra` on its way to handlers).
 */
@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly displays: DisplaysService,
    private readonly support: SupportService,
    private readonly organizations: OrganizationsService,
    private readonly audit: McpAuditService,
    private readonly shadowLog: ShadowLogService,
  ) {}

  onModuleInit(): void {
    // Sanity-check: build a server once at startup so a misconfigured
    // tool-registration crashes the boot rather than the first user
    // request. The instance is then discarded.
    this.buildServer(undefined);
    this.logger.log(
      'MCP server factory ready — 10 tools registered per request (list_displays, list_open_support_requests, update_support_request_priority, update_support_request_ai_category, create_support_message, list_onboarding_candidates, mark_onboarding_nudge_sent, auto_complete_org_onboarding, send_lifecycle_nudge_email, log_shadow_row)',
    );
  }

  /**
   * Build a fresh MCP server with every tool registered, bound to a
   * specific request context.
   *
   * `context` may be `undefined` only for the onModuleInit
   * sanity-build, which never serves a real request.
   */
  buildServer(context: McpRequestContext | undefined): McpServer {
    const server = new McpServerCtor(
      { name: 'vizora-mcp', version: '0.2.0' },
      { capabilities: { tools: { listChanged: false } } },
    );
    this.registerTool(server, LIST_DISPLAYS_TOOL, context, this.displays);
    this.registerTool(server, LIST_OPEN_SUPPORT_REQUESTS_TOOL, context, this.support);
    this.registerTool(
      server,
      UPDATE_SUPPORT_REQUEST_PRIORITY_TOOL,
      context,
      this.support,
    );
    this.registerTool(
      server,
      UPDATE_SUPPORT_REQUEST_AI_CATEGORY_TOOL,
      context,
      this.support,
    );
    this.registerTool(server, CREATE_SUPPORT_MESSAGE_TOOL, context, this.support);
    this.registerTool(
      server,
      LIST_ONBOARDING_CANDIDATES_TOOL,
      context,
      this.organizations,
    );
    this.registerTool(
      server,
      MARK_ONBOARDING_NUDGE_SENT_TOOL,
      context,
      this.organizations,
    );
    this.registerTool(
      server,
      AUTO_COMPLETE_ORG_ONBOARDING_TOOL,
      context,
      this.organizations,
    );
    this.registerTool(
      server,
      SEND_LIFECYCLE_NUDGE_EMAIL_TOOL,
      context,
      this.organizations,
    );
    this.registerTool(server, LOG_SHADOW_ROW_TOOL, context, this.shadowLog);
    return server;
  }

  /**
   * Generic registration wrapper: applies the per-tool input schema,
   * delegates to the tool's handler, records an `mcp_audit_log` row
   * for both success and failure, and translates thrown exceptions
   * into the MCP-spec `isError: true` content shape.
   *
   * Generic over the tool registry entry's handler signature — the
   * handler receives the input, the request context, and a typed
   * service singleton. The third arg is whatever singleton the tool
   * needs (DisplaysService, SupportService, etc).
   */
  private registerTool<TIn, TOut, TService>(
    server: McpServer,
    tool: {
      name: string;
      description: string;
      inputSchema: { shape: Record<string, unknown> };
      handler: (
        input: TIn,
        context: McpRequestContext,
        service: TService,
      ) => Promise<TOut>;
    },
    context: McpRequestContext | undefined,
    service: TService,
  ): void {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
      },
      async (input: unknown) => {
        const startedAt = Date.now();
        if (!context) {
          throw new Error(
            'MCP tool invoked without context (controller wiring bug)',
          );
        }
        try {
          const result = await tool.handler(input as TIn, context, service);
          await this.audit.record({
            tokenId: context.tokenId,
            agentName: context.agentName,
            organizationId: context.organizationId,
            tool: tool.name,
            paramsRaw: input,
            status: 'success',
            latencyMs: Date.now() - startedAt,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result as Record<string, unknown>,
          };
        } catch (err) {
          const mapped = mapExceptionToMcpError(err);
          await this.audit.record({
            tokenId: context.tokenId,
            agentName: context.agentName,
            organizationId: context.organizationId,
            tool: tool.name,
            paramsRaw: input,
            status: 'error',
            errorCode: mapped.code,
            latencyMs: Date.now() - startedAt,
          });
          return {
            isError: true,
            content: [{ type: 'text', text: mapped.message }],
            structuredContent: { error: mapped },
          };
        }
      },
    );
  }
}
