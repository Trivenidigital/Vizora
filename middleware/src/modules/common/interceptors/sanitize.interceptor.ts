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

  private readonly templateHtmlFields = ['templateHtml', 'htmlContent', 'customCss', 'renderedHtml'];

  private readonly sanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: [], // Strip all HTML tags
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  };

  /**
   * Limited sanitization for template HTML fields.
   * Preserves legitimate HTML/CSS while stripping dangerous elements:
   * - <script> tags
   * - on* event handler attributes
   * - javascript: URIs
   */
  private readonly templateSanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'style', 'img', 'video', 'source', 'iframe', 'div', 'span', 'section',
      'header', 'footer', 'nav', 'main', 'article', 'aside', 'figure',
      'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'svg', 'path',
      'circle', 'rect', 'line', 'polyline', 'polygon', 'text', 'g', 'defs',
      'use', 'symbol', 'clipPath', 'mask', 'pattern', 'linearGradient',
      'radialGradient', 'stop', 'font', 'canvas',
    ]),
    allowedAttributes: {
      '*': ['class', 'id', 'style', 'data-*', 'aria-*', 'role', 'tabindex',
            'title', 'lang', 'dir', 'hidden', 'slot'],
      'img': ['src', 'alt', 'width', 'height', 'loading', 'srcset', 'sizes'],
      'video': ['src', 'poster', 'width', 'height', 'controls', 'autoplay',
                'loop', 'muted', 'preload', 'playsinline'],
      'source': ['src', 'type', 'media', 'srcset', 'sizes'],
      'iframe': ['src', 'width', 'height', 'frameborder', 'allow',
                 'allowfullscreen', 'sandbox', 'loading'],
      'a': ['href', 'target', 'rel'],
      'svg': ['viewBox', 'xmlns', 'width', 'height', 'fill', 'stroke'],
      'path': ['d', 'fill', 'stroke', 'stroke-width', 'transform'],
      'circle': ['cx', 'cy', 'r', 'fill', 'stroke'],
      'rect': ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke'],
    },
    allowedSchemes: ['http', 'https', 'data', 'mailto'],
    // Strip <script> tags entirely
    disallowedTagsMode: 'discard',
  };


  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.body && typeof request.body === 'object') {
      request.body = this.sanitizeObject(request.body);
    }

    if (request.query && typeof request.query === 'object') {
      const sanitizedQuery = this.sanitizeObject(request.query);
      Object.keys(sanitizedQuery).forEach(key => {
        request.query[key] = sanitizedQuery[key];
      });
    }

    if (request.params && typeof request.params === 'object') {
      const sanitizedParams = this.sanitizeObject(request.params);
      Object.keys(sanitizedParams).forEach(key => {
        request.params[key] = sanitizedParams[key];
      });
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
          // Apply limited sanitization for template HTML fields:
          // strips <script>, on* handlers, javascript: URIs while preserving HTML/CSS
          sanitized[key] = typeof value === 'string'
            ? this.sanitizeTemplateHtml(value)
            : value;
        } else {
          sanitized[key] = this.sanitizeObject(value);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize template HTML fields with a permissive allowlist.
   * Strips <script> tags, on* event handlers, and javascript: URIs
   * while preserving legitimate HTML structure and CSS.
   */
  private sanitizeTemplateHtml(html: string): string {
    return sanitizeHtml(html, this.templateSanitizeOptions);
  }


  private sanitizeString(str: string): string {
    // First strip HTML tags
    let sanitized = sanitizeHtml(str, this.sanitizeOptions);
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
  }
}
