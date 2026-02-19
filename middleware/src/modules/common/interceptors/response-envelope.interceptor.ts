import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export const SKIP_ENVELOPE_KEY = 'skipEnvelope';

/**
 * Decorator to skip response envelope wrapping on specific endpoints.
 * Use on controller methods that already return `{ success, ... }` format.
 */
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);

/**
 * Wraps all JSON responses in a consistent envelope: `{ success: true, data: ... }`.
 * Skips wrapping when:
 *  - The handler or controller is decorated with @SkipEnvelope()
 *  - The response already has a `success` property (avoids double-wrapping)
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // Don't wrap if the response already contains a success property
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }
        return { success: true, data };
      }),
    );
  }
}
