import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpRequestContext } from './auth/mcp-context';
import { McpAuditService } from './audit/mcp-audit.service';
import { mapExceptionToMcpError } from './lib/error-mapping';
import { DisplaysService } from '../displays/displays.service';
import { LIST_DISPLAYS_TOOL } from './tools/displays.tools';

/**
 * Holds a single `McpServer` instance and registers every tool
 * exactly once at startup. The transport is created per-request by
 * `McpController` (stateless mode — no server-side session state) and
 * `connect`-ed against this server.
 *
 * Tool handlers receive an `extra` arg from the SDK that carries
 * `authInfo`. We populate `authInfo.extra.mcpContext` from the
 * controller per-request so each tool sees the right
 * organization/agent/scopes for THIS call.
 */
@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);

  /** Singleton MCP server. Tools are registered once at module init. */
  readonly server = new McpServer(
    { name: 'vizora-mcp', version: '0.1.0' },
    { capabilities: { tools: { listChanged: false } } },
  );

  constructor(
    private readonly displays: DisplaysService,
    private readonly audit: McpAuditService,
  ) {}

  onModuleInit(): void {
    this.registerListDisplays();
    this.logger.log('MCP server initialized — 1 tool registered (list_displays)');
  }

  /**
   * Wraps tool registration with a uniform try/catch + audit pattern
   * so each tool file stays focused on the tool itself.
   */
  private registerListDisplays(): void {
    const t = LIST_DISPLAYS_TOOL;
    this.server.registerTool(
      t.name,
      {
        description: t.description,
        inputSchema: t.inputSchema.shape,
      },
      async (input, extra) => {
        const startedAt = Date.now();
        const mcp = (extra.authInfo?.extra ?? {}) as { mcpContext?: McpRequestContext };
        const context = mcp.mcpContext;
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
}
