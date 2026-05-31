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
import { Public } from '../auth/decorators/public.decorator';
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
// NB: NestJS prepends the global prefix (`api/v1`) automatically — the
// controller path is just `mcp`. Including `api/v1/` here would
// double-prefix the route to `/api/v1/api/v1/mcp` and silently 404.
@Controller('mcp')
// `@Public()` opts the controller out of the GLOBAL JwtAuthGuard
// (auth.module.ts registers it as APP_GUARD). MCP uses bearer-token
// auth via `mcp_<token>` — NOT user-session JWTs. Without this, the
// global guard intercepts first, fails to validate the MCP bearer as
// a JWT, and throws a generic UnauthorizedException — McpAuthGuard
// never runs and the wire message reads "Unauthorized" instead of
// the MCP-specific "Invalid or expired MCP token". Auth is still
// enforced — McpAuthGuard runs at the controller level below.
@Public()
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
   * Per-request transport AND per-request McpServer (stateless mode).
   * The SDK's `Server.connect()` is single-shot — reusing one server
   * across requests throws "Already connected to a transport" on the
   * second call (caught in prod by Hermes hitting `tools/list` after
   * PR #42 went live). Building both fresh per request pairs their
   * lifetimes 1:1 and lets GC clean up after `handleRequest` returns.
   *
   * The auth-info object carries the per-request `mcpContext` into
   * the SDK so tool handlers receive the right org / agent / scopes
   * for THIS call.
   */
  private async handle(req: Request, res: Response): Promise<void> {
    const context = (req as Request & Record<string, unknown>)[
      MCP_CONTEXT_KEY
    ] as McpRequestContext | undefined;

    // The McpServer is built WITH the context — tool handler closures
    // capture it at build time. We previously tried to plumb context
    // through the SDK via `transport.handleRequest(..., extra: {
    // authInfo: { extra: { mcpContext } } })`, but the SDK doesn't
    // forward `authInfo.extra` to tool handlers in v1.x — handlers
    // received `undefined` and threw "MCP tool invoked without
    // context". Closure capture is reliable and SDK-version-agnostic.
    const server = this.mcp.buildServer(context);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    await server.connect(transport);

    // Pass NestJS's pre-parsed body straight through. Per the SDK
    // example: `transport.handleRequest(req, res, req.body)`.
    await transport.handleRequest(req, res, req.body);

    // The transport closes itself when the client disconnects; the
    // McpServer is per-request so it dies with this scope.
  }
}
