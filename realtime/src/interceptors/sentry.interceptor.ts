import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Only report non-HTTP errors or 5xx errors to Sentry
        if (!(error instanceof HttpException) || error.getStatus() >= 500) {
          const request = context.switchToHttp().getRequest();
          
          Sentry.withScope((scope) => {
            // Add request context
            scope.setContext('request', {
              method: request.method,
              url: request.url,
              headers: {
                'user-agent': request.headers['user-agent'],
                'x-forwarded-for': request.headers['x-forwarded-for'],
              },
            });

            // Add user context if available
            if (request.user) {
              scope.setUser({
                id: request.user.id || request.user.sub,
                username: request.user.username,
                organizationId: request.user.organizationId,
              });
            }

            // Add device context for WebSocket connections
            if (request.data?.deviceId) {
              scope.setContext('device', {
                deviceId: request.data.deviceId,
                organizationId: request.data.organizationId,
              });
            }

            // Set error level
            scope.setLevel(error instanceof HttpException ? 'warning' : 'error');

            // Capture the exception
            Sentry.captureException(error);
          });
        }

        return throwError(() => error);
      })
    );
  }
}
