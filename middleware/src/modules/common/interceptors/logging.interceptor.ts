import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

export const SKIP_HTTP_LOGGING_KEY = 'skipHttpLogging';
export const SkipHttpLogging = () => SetMetadata(SKIP_HTTP_LOGGING_KEY, true);

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    organizationId?: string;
  };
}

interface LogMetadata {
  requestId: string;
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  userId?: string;
  organizationId?: string;
  statusCode?: number;
  duration?: number;
  error?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly reflector?: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const skipSuccessfulLogging = this.shouldSkipSuccessfulLogging(context, request);

    // Use incoming X-Request-ID if valid (alphanumeric/dashes, max 128 chars), else generate
    const incomingId = request.headers['x-request-id'] as string;
    const requestId =
      incomingId && /^[\w\-]{1,128}$/.test(incomingId)
        ? incomingId
        : this.generateRequestId();
    const startTime = Date.now();

    // Attach request ID for tracing
    request['requestId'] = requestId;
    response.setHeader('X-Request-ID', requestId);

    const metadata: LogMetadata = {
      requestId,
      method: request.method,
      url: LoggingInterceptor.redactUrl(request.url),
      ip: request.ip || request.socket?.remoteAddress || 'unknown',
      userAgent: request.headers['user-agent'] || 'unknown',
      userId: request.user?.id,
      organizationId: request.user?.organizationId,
    };

    // Log incoming request (debug level in production)
    if (process.env.NODE_ENV !== 'production' && !skipSuccessfulLogging) {
      this.logger.debug(`[${requestId}] --> ${metadata.method} ${metadata.url}`, 'Request');
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          metadata.statusCode = response.statusCode;
          metadata.duration = duration;

          if (!skipSuccessfulLogging || response.statusCode >= 400) {
            this.logRequest(metadata);
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          metadata.statusCode = error.status || 500;
          metadata.duration = duration;
          metadata.error = error.message;

          this.logRequest(metadata, true);
        },
      }),
    );
  }

  private logRequest(metadata: LogMetadata, isError = false): void {
    const { requestId, method, url, statusCode, duration, ip, userId, error } = metadata;

    // Structured log format for production
    const logMessage = `[${requestId}] ${method} ${url} ${statusCode} ${duration}ms`;

    // Additional context for debugging
    const context = {
      requestId,
      method,
      url,
      statusCode,
      duration,
      ip,
      userId,
    };

    if (isError) {
      this.logger.error(`${logMessage} - ${error}`, undefined, JSON.stringify(context));
    } else if (statusCode && statusCode >= 400) {
      this.logger.warn(logMessage, JSON.stringify(context));
    } else {
      this.logger.log(logMessage);
    }

    // Log slow requests
    if (duration && duration > 1000) {
      this.logger.warn(`Slow request detected: ${method} ${url} took ${duration}ms`, 'Performance');
    }
  }

  private shouldSkipSuccessfulLogging(
    context: ExecutionContext,
    request: AuthenticatedRequest,
  ): boolean {
    const skipFromMetadata = this.reflector?.getAllAndOverride<boolean>(
      SKIP_HTTP_LOGGING_KEY,
      [context.getHandler(), context.getClass()],
    );

    return Boolean(skipFromMetadata) || LoggingInterceptor.isDeviceContentFileUrl(request.url);
  }

  private generateRequestId(): string {
    return crypto.randomUUID();
  }

  /**
   * Redact sensitive query-string parameters from a logged URL.
   *
   * The previous code logged `request.url` verbatim — anything in the
   * query string (api_key, token, password-reset token, code, etc.)
   * landed in plain text in HTTP logs, which then flow to log scrapers
   * and Sentry breadcrumbs. The reset-password GET path is the most
   * obvious surface but the rule is general: don't trust the caller
   * to keep secrets out of the URL.
   *
   * Strategy: keep the path, scan the query string, replace any
   * value whose KEY matches a known-sensitive pattern with REDACTED.
   * Unknown keys (page, limit, filter, etc.) pass through unchanged
   * so the log keeps debugging utility.
   *
   * Exported as a static so tests can pin the exact behavior without
   * spinning up the full interceptor.
   */
  static redactUrl(url: string): string {
    const qIdx = url.indexOf('?');
    if (qIdx === -1) return url;
    const path = url.slice(0, qIdx);
    const query = url.slice(qIdx + 1);
    const SENSITIVE = /^(token|api[_-]?key|apikey|password|secret|code|jwt|bearer|access[_-]?token|refresh[_-]?token|auth)$/i;
    const redacted = query
      .split('&')
      .map((pair) => {
        const eq = pair.indexOf('=');
        if (eq === -1) return pair;
        const key = pair.slice(0, eq);
        if (SENSITIVE.test(decodeURIComponent(key))) {
          return `${key}=REDACTED`;
        }
        return pair;
      })
      .join('&');
    return `${path}?${redacted}`;
  }

  static isDeviceContentFileUrl(url: string): boolean {
    const path = url.split('?')[0];
    return /^\/(?:api\/v1\/)?device-content\/[^/]+\/file$/.test(path);
  }
}
