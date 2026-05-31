import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { mapExceptionToMcpError, type McpErrorCode } from './lib/error-mapping';

/**
 * Catches every exception thrown on /api/v1/mcp/* (including those
 * raised by `McpAuthGuard` and `McpRateLimitGuard`) and serializes
 * them in the MCP wire-error shape clients expect:
 *
 *   { error: { code: <enum>, message: <human>, data?: <object> } }
 *
 * Without this filter, NestJS's default exception handler emits its
 * own envelope (`{ statusCode, message, error }`) which agents have
 * to special-case. With this filter, transport-level failures and
 * tool-handler failures look the same on the wire.
 *
 * HTTP status codes still match the MCP code (401 / 403 / 404 / 429
 * / 400 / 500) so an MCP client that triages on status alone still
 * works.
 */
@Catch()
export class McpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(McpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const mapped = mapExceptionToMcpError(exception);
    const status = httpStatusFor(mapped.code);

    // Surface the precise reason in our own logs, never to the client.
    this.logger.warn(
      `MCP ${req.method} ${req.originalUrl ?? req.url} → ${status} ${mapped.code}: ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
    );

    if (mapped.code === 'RATE_LIMITED') {
      // The throttler may have already set Retry-After to the actual
      // bucket-reset TTL (in seconds). Honour that if present —
      // overwriting it with a hardcoded 60 makes clients back off for
      // longer than they need to. Only fall back to 60 when no upstream
      // value exists.
      const existing = res.getHeader('Retry-After');
      if (existing === undefined || existing === null || existing === '') {
        res.setHeader('Retry-After', '60');
      }
    }

    res.status(status).json({ error: mapped });
  }
}

function httpStatusFor(code: McpErrorCode): number {
  switch (code) {
    case 'UNAUTHORIZED':   return HttpStatus.UNAUTHORIZED;
    case 'FORBIDDEN':      return HttpStatus.FORBIDDEN;
    case 'NOT_FOUND':      return HttpStatus.NOT_FOUND;
    case 'INVALID_INPUT':  return HttpStatus.BAD_REQUEST;
    case 'RATE_LIMITED':   return HttpStatus.TOO_MANY_REQUESTS;
    case 'TOOL_NOT_FOUND': return HttpStatus.NOT_FOUND;
    case 'INTERNAL':       return HttpStatus.INTERNAL_SERVER_ERROR;
    default:               return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

// Re-export to avoid a second import in the controller
export { ThrottlerException, HttpException };
