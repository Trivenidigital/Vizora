import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Only report 5xx errors and non-HTTP exceptions to Sentry
        // 4xx errors are client errors and should not be tracked
        if (!(error instanceof HttpException) || error.getStatus() >= 500) {
          const request = context.switchToHttp().getRequest();

          Sentry.withScope((scope) => {
            // Add request context
            scope.setContext('request', {
              method: request.method,
              url: request.url,
              ip: request.ip,
            });

            // Add user context if available (from JWT auth)
            if (request.user) {
              scope.setUser({
                id: request.user.id || request.user.sub,
                organizationId: request.user.organizationId,
              });
            }

            // Set error level
            scope.setLevel(error instanceof HttpException ? 'warning' : 'error');

            // Capture the exception
            Sentry.captureException(error);
          });
        }

        return throwError(() => error);
      }),
    );
  }
}
