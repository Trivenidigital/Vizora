import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

/**
 * MCP wire error shape:
 *
 *   { error: { code: <enum>, message: <human>, data?: <object> } }
 *
 * The code is what agents act on. NOT_FOUND vs INVALID_INPUT is a
 * meaningful distinction — INVALID_INPUT signals "fix your params and
 * retry," NOT_FOUND signals "this resource is gone, refresh your state
 * or stop." Conflating them encourages retry loops on missing data.
 */
export type McpErrorCode =
  | 'TOOL_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface McpErrorPayload {
  code: McpErrorCode;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Map a NestJS-thrown exception (including Throttler) to the MCP error
 * code agents will see on the wire. INTERNAL is the fallback — it never
 * leaks the exception's stack or message verbatim.
 */
export function mapExceptionToMcpError(err: unknown): McpErrorPayload {
  if (err instanceof NotFoundException) {
    return {
      code: 'NOT_FOUND',
      message: err.message || 'Resource not found',
    };
  }
  if (err instanceof BadRequestException) {
    return {
      code: 'INVALID_INPUT',
      message: err.message || 'Invalid input',
    };
  }
  if (err instanceof UnauthorizedException) {
    return {
      code: 'UNAUTHORIZED',
      message: err.message || 'Token missing, invalid, expired, or revoked',
    };
  }
  if (err instanceof ForbiddenException) {
    return {
      code: 'FORBIDDEN',
      message: err.message || 'Token lacks the required scope',
    };
  }
  if (err instanceof ThrottlerException) {
    return {
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded for this token. Retry after the cooldown.',
    };
  }
  if (err instanceof HttpException) {
    // Other HTTP exceptions land in INVALID_INPUT (4xx) or INTERNAL (5xx)
    const status = err.getStatus();
    if (status >= 400 && status < 500) {
      return { code: 'INVALID_INPUT', message: err.message };
    }
  }
  // Anything else → INTERNAL with the message stripped
  return { code: 'INTERNAL', message: 'Internal server error' };
}
