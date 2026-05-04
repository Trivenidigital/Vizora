import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpRequestContext } from './auth/mcp-context';
import { McpAuditService } from './audit/mcp-audit.service';
import { mapExceptionToMcpError } from './lib/error-mapping';
import { DisplaysService } from '../displays/displays.service';
import { SupportService } from '../support/support.service';
import { LIST_DISPLAYS_TOOL } from './tools/displays.tools';
import { LIST_OPEN_SUPPORT_REQUESTS_TOOL } from './tools/support.tools';

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
 * Tool handlers receive an `extra` arg from the SDK that carries
 * `authInfo`. We populate `authInfo.extra.mcpContext` from the
 * controller per-request so each tool sees the right
 * organization/agent/scopes for THIS call.
 */
@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly displays: DisplaysService,
    private readonly support: SupportService,
    private readonly audit: McpAuditService,
  ) {}

  onModuleInit(): void {
    // Sanity-check: build a server once at startup so a misconfigured
    // tool-registration crashes the boot rather than the first user
    // request. The instance is then discarded.
    this.buildServer(undefined);
    this.logger.log(
      'MCP server factory ready — 2 tools will be registered per request (list_displays, list_open_support_requests)',
    );
  }

  /**
   * Build a fresh MCP server with every tool registered, bound to a
   * specific request context. The handler closures capture `context`
   * at build time — no reliance on the SDK preserving auth-info
   * fields through `transport.handleRequest`.
   *
   * Called once per incoming HTTP request by `McpController`.
   * `context` may be `undefined` only for the onModuleInit
   * sanity-build, which never serves a real request.
   */
  buildServer(context: McpRequestContext | undefined): McpServer {
    const server = new McpServer(
      { name: 'vizora-mcp', version: '0.1.0' },
      { capabilities: { tools: { listChanged: false } } },
    );
    this.registerListDisplays(server, context);
    this.registerListOpenSupportRequests(server, context);
    return server;
  }

  /**
   * Wraps tool registration with a uniform try/catch + audit pattern
   * so each tool file stays focused on the tool itself.
   */
  private registerListDisplays(
    server: McpServer,
    context: McpRequestContext | undefined,
  ): void {
    const t = LIST_DISPLAYS_TOOL;
    server.registerTool(
      t.name,
      {
        description: t.description,
        inputSchema: t.inputSchema.shape,
      },
      async (input) => {
        const startedAt = Date.now();
        if (!context) {
          // Should be impossible — controller always sets it. Fail loud.
          throw new Error('MCP tool invoked without context (controller wiring bug)');
        }
        try {
          const result = await t.handler(input, context, this.displays);
          await this.audit.record({
            tokenId: context.tokenId,
            agentName: context.agentName,
            organizationId: context.organizationId,
            tool: t.name,
            paramsRaw: input,
            status: 'success',
            latencyMs: Date.now() - startedAt,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (err) {
          const mapped = mapExceptionToMcpError(err);
          await this.audit.record({
            tokenId: context.tokenId,
            agentName: context.agentName,
            organizationId: context.organizationId,
            tool: t.name,
            paramsRaw: input,
            status: 'error',
            errorCode: mapped.code,
            latencyMs: Date.now() - startedAt,
          });
          // Surface as an MCP tool-error result. The SDK converts
          // thrown exceptions to 'isError: true' content; we follow
          // the convention so agents see the typed error code in
          // structuredContent.
          return {
            isError: true,
            content: [{ type: 'text', text: mapped.message }],
            structuredContent: { error: mapped },
          };
        }
      },
    );
  }

  /**
   * Twin of `registerListDisplays` for the support-triage read tool.
   * The audit + error-wrap boilerplate is duplicated rather than
   * extracted because (a) we have only two tools today, and (b) the
   * audit row carries the tool name as a literal so any helper would
   * need to thread it through anyway. When PR-B adds the remaining
   * tools we'll factor a generic `wrapTool(server, t, exec)` helper.
   */
  private registerListOpenSupportRequests(
    server: McpServer,
    context: McpRequestContext | undefined,
  ): void {
    const t = LIST_OPEN_SUPPORT_REQUESTS_TOOL;
    server.registerTool(
      t.name,
      {
        description: t.description,
        inputSchema: t.inputSchema.shape,
      },
      async (input) => {
        const startedAt = Date.now();
        if (!context) {
          throw new Error('MCP tool invoked without context (controller wiring bug)');
        }
        try {
          const result = await t.handler(input, context, this.support);
          await this.audit.record({
            tokenId: context.tokenId,
            agentName: context.agentName,
            organizationId: context.organizationId,
            tool: t.name,
            paramsRaw: input,
            status: 'success',
            latencyMs: Date.now() - startedAt,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (err) {
          const mapped = mapExceptionToMcpError(err);
          await this.audit.record({
            tokenId: context.tokenId,
            agentName: context.agentName,
            organizationId: context.organizationId,
            tool: t.name,
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
