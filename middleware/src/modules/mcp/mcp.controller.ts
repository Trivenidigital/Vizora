import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SkipEnvelope } from '../common/interceptors/response-envelope.interceptor';
import { SkipInputSanitize } from '../common/interceptors/sanitize.interceptor';
import { McpAuthGuard } from './auth/mcp-auth.guard';
import {
  MCP_CONTEXT_KEY,
  type McpRequestContext,
} from './auth/mcp-context';
import { McpRateLimitGuard } from './auth/mcp-rate-limit.guard';
import { McpExceptionFilter } from './mcp-exception.filter';
import { McpService } from './mcp.service';

/**
 * MCP transport endpoint. Every method is decorated with:
 *
 *   - `@SkipEnvelope()`     — bypass the global response envelope so
 *                              MCP's JSON-RPC payload reaches the wire
 *                              unwrapped (otherwise agents receive
 *                              `{success, data: {jsonrpc, ...}, meta}`
 *                              and every MCP client breaks)
 *   - `@UseGuards(McpAuthGuard, McpRateLimitGuard)` — auth FIRST so
 *                              the rate-limit guard has a populated
 *                              tokenId on the request
 *
 * Each request creates a fresh `StreamableHTTPServerTransport` in
 * stateless mode (no session id) and calls `transport.handleRequest`,
 * passing the body NestJS already parsed — the SDK accepts a
 * pre-parsed body, which avoids the double-parse foot-gun common with
 * Express-based frameworks.
 */
@ApiTags('mcp')
@Controller('api/v1/mcp')
@UseGuards(McpAuthGuard, McpRateLimitGuard)
@UseFilters(McpExceptionFilter)
@SkipInputSanitize()
@ApiBearerAuth()
export class McpController {
  constructor(private readonly mcp: McpService) {}

  /** Tools/list and tools/call live on POST per MCP spec. */
  @Post()
  @SkipEnvelope()
  async post(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handle(req, res);
  }

  /** GET supports SSE streaming for long-running tools. v1 has none, */
  /** but the spec requires the endpoint exist on the same path.       */
  @Get()
  @SkipEnvelope()
  async get(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handle(req, res);
  }

  /** DELETE for closing a session. Stateless mode = nothing to close, */
  /** but we keep the route for spec compliance.                       */
  @Post('close')
  @SkipEnvelope()
  async close(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handle(req, res);
  }

  /**
   * Per-request transport (stateless mode). The auth-info object
   * carries the per-request `mcpContext` into the SDK so tool
   * handlers receive the right org / agent / scopes for THIS call.
   */
  private async handle(req: Request, res: Response): Promise<void> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    await this.mcp.server.connect(transport);

    const context = (req as Request & Record<string, unknown>)[
      MCP_CONTEXT_KEY
    ] as McpRequestContext | undefined;

    // Pass NestJS's pre-parsed body straight through. Per the SDK
    // example: `transport.handleRequest(req, res, req.body)`.
    // The SDK's `MessageExtraInfo.authInfo.extra` is how we ferry
    // the per-request mcpContext to the tool handler — the registered
    // tool reads it via `extra.authInfo.extra.mcpContext`.
    const extra = context
      ? {
          authInfo: {
            // The SDK's AuthInfo type requires a `token`. We don't
            // re-leak the bearer; pass the token id instead — it's
            // already in `mcpContext.tokenId`.
            token: context.tokenId,
            clientId: context.agentName,
            scopes: context.scopes,
            extra: { mcpContext: context },
          },
        }
      : {};

    await transport.handleRequest(req, res, req.body, extra);

    // The transport closes itself when the client disconnects; the
    // McpServer's `connect()` is per-transport so there's nothing to
    // explicitly tear down here.
  }
}
