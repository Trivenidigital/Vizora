import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import sanitizeHtml from 'sanitize-html';

/**
 * Interceptor to sanitize all string inputs in request body
 * Prevents XSS attacks by stripping dangerous HTML
 */
@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
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

    return next.handle();
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
