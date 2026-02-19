import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Normalize the route path to avoid high-cardinality labels
    const path = this.normalizePath(request.route?.path || request.url);
    const method = request.method;

    return next.handle().pipe(
      tap({
        next: () => {
          const status = String(response.statusCode);
          const duration = (Date.now() - startTime) / 1000;

          this.metricsService.httpRequestsTotal.inc({ method, path, status });
          this.metricsService.httpRequestDuration.observe({ method, path, status }, duration);

          if (response.statusCode >= 400) {
            this.metricsService.httpErrorsTotal.inc({ method, path, status });
          }
        },
        error: (error) => {
          const status = String(error.status || 500);
          const duration = (Date.now() - startTime) / 1000;

          this.metricsService.httpRequestsTotal.inc({ method, path, status });
          this.metricsService.httpRequestDuration.observe({ method, path, status }, duration);
          this.metricsService.httpErrorsTotal.inc({ method, path, status });
        },
      }),
    );
  }

  private normalizePath(path: string): string {
    // Replace UUIDs and numeric IDs with placeholders to reduce cardinality
    return path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+/g, '/:id');
  }
}
