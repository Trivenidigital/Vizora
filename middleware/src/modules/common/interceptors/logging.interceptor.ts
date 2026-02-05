import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

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

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const requestId = this.generateRequestId();
    const startTime = Date.now();

    // Attach request ID for tracing
    request['requestId'] = requestId;

    const metadata: LogMetadata = {
      requestId,
      method: request.method,
      url: request.url,
      ip: request.ip || request.socket?.remoteAddress || 'unknown',
      userAgent: request.headers['user-agent'] || 'unknown',
      userId: (request as any).user?.id,
      organizationId: (request as any).user?.organizationId,
    };

    // Log incoming request (debug level in production)
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[${requestId}] --> ${metadata.method} ${metadata.url}`, 'Request');
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          metadata.statusCode = response.statusCode;
          metadata.duration = duration;

          this.logRequest(metadata);
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

  private generateRequestId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
