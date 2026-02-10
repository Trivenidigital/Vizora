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
import sanitizeHtml from 'sanitize-html';

export const SKIP_OUTPUT_SANITIZE_KEY = 'skipOutputSanitize';
export const SkipOutputSanitize = () => SetMetadata(SKIP_OUTPUT_SANITIZE_KEY, true);

/**
 * Interceptor to sanitize all string inputs in request body
 * and all string outputs in response data.
 * Prevents XSS attacks by stripping dangerous HTML.
 */
@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  constructor(private readonly reflector?: Reflector) {}

  private readonly templateHtmlFields = ['templateHtml', 'htmlContent', 'customCss'];

  private readonly sanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: [], // Strip all HTML tags
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  };

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.body && typeof request.body === 'object') {
      request.body = this.sanitizeObject(request.body);
    }

    if (request.query && typeof request.query === 'object') {
      request.query = this.sanitizeObject(request.query);
    }

    if (request.params && typeof request.params === 'object') {
      request.params = this.sanitizeObject(request.params);
    }

    // Check if output sanitization should be skipped
    const skipOutput = this.reflector?.getAllAndOverride<boolean>(
      SKIP_OUTPUT_SANITIZE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipOutput) {
      return next.handle();
    }

    // Sanitize output
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object') {
          return this.sanitizeObject(data);
        }
        return data;
      }),
    );
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip password fields - don't sanitize them
        if (key.toLowerCase().includes('password')) {
          sanitized[key] = value;
        } else if (this.templateHtmlFields.includes(key)) {
          // Skip sanitization for template HTML fields that need to preserve HTML
          sanitized[key] = value;
        } else {
          sanitized[key] = this.sanitizeObject(value);
        }
      }
      return sanitized;
    }

    return obj;
  }

  private sanitizeString(str: string): string {
    // First strip HTML tags
    let sanitized = sanitizeHtml(str, this.sanitizeOptions);
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
  }
}
