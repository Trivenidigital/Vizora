import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import DOMPurify from 'isomorphic-dompurify';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { DataSourceDto } from './dto/create-template.dto';

/**
 * Result of template validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Service for rendering and validating Handlebars templates
 */
@Injectable()
export class TemplateRenderingService {
  private readonly logger = new Logger(TemplateRenderingService.name);

  // Forbidden HTML elements for security
  private readonly FORBIDDEN_TAGS = [
    'script',
    'object',
    'embed',
    'frame',
    'iframe',
    'form',
    'meta',
    'link',
    'base',
  ];

  // Forbidden attributes for security
  private readonly FORBIDDEN_ATTRIBUTES = [
    'onclick',
    'ondblclick',
    'onmousedown',
    'onmouseup',
    'onmouseover',
    'onmousemove',
    'onmouseout',
    'onmouseenter',
    'onmouseleave',
    'onkeydown',
    'onkeypress',
    'onkeyup',
    'onload',
    'onerror',
    'onabort',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit',
    'onreset',
    'onselect',
    'oninput',
    'oncontextmenu',
    'ondrag',
    'ondragend',
    'ondragenter',
    'ondragleave',
    'ondragover',
    'ondragstart',
    'ondrop',
  ];

  // Forbidden URL protocols
  private readonly FORBIDDEN_PROTOCOLS = ['javascript:', 'data:', 'vbscript:'];

  // External API request timeout (10 seconds)
  private readonly REQUEST_TIMEOUT = 10000;

  constructor(private readonly circuitBreaker: CircuitBreakerService) {
    // Register custom Handlebars helpers
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Safe date formatting helper
    Handlebars.registerHelper('formatDate', (date: string | Date, format?: string) => {
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString();
      } catch {
        return '';
      }
    });

    // Safe number formatting helper
    Handlebars.registerHelper('formatNumber', (num: number, decimals?: number) => {
      try {
        const dec = typeof decimals === 'number' ? decimals : 2;
        return Number(num).toFixed(dec);
      } catch {
        return '';
      }
    });

    // Safe currency formatting helper
    Handlebars.registerHelper('formatCurrency', (num: number, currency?: string) => {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency || 'USD',
        }).format(num);
      } catch {
        return '';
      }
    });

    // Conditional equals helper
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

    // Conditional not equals helper
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);

    // Greater than helper
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);

    // Less than helper
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);

    // JSON stringify helper for debugging
    Handlebars.registerHelper('json', (context: any) => {
      try {
        return JSON.stringify(context, null, 2);
      } catch {
        return '';
      }
    });

    // Weather condition code to emoji helper
    Handlebars.registerHelper('weatherIcon', (code: number) => {
      if (code === undefined || code === null) return '';
      const c = Number(code);
      // Thunderstorm (2xx)
      if (c >= 200 && c < 300) return '\u26C8\uFE0F';
      // Drizzle (3xx)
      if (c >= 300 && c < 400) return '\uD83C\uDF26\uFE0F';
      // Rain (5xx)
      if (c >= 500 && c < 600) {
        if (c === 511) return '\u2744\uFE0F'; // freezing rain
        return '\uD83C\uDF27\uFE0F';
      }
      // Snow (6xx)
      if (c >= 600 && c < 700) return '\u2744\uFE0F';
      // Atmosphere / fog / mist (7xx)
      if (c >= 700 && c < 800) return '\uD83C\uDF2B\uFE0F';
      // Clear (800)
      if (c === 800) return '\u2600\uFE0F';
      // Few clouds (801)
      if (c === 801) return '\u26C5';
      // Scattered / broken / overcast clouds (802-804)
      if (c >= 802 && c <= 804) return '\u2601\uFE0F';
      return '\uD83C\uDF24\uFE0F';
    });

    // Relative time helper (e.g., "2 hours ago")
    Handlebars.registerHelper('relativeTime', (date: string | Date) => {
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const now = Date.now();
        const diffMs = now - d.getTime();
        const diffSec = Math.floor(diffMs / 1000);

        if (diffSec < 0) return 'just now';
        if (diffSec < 60) return 'just now';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        const diffMonths = Math.floor(diffDays / 30);
        if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
        const diffYears = Math.floor(diffMonths / 12);
        return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
      } catch {
        return '';
      }
    });
  }

  /**
   * Compile and render a Handlebars template with data
   *
   * @param templateHtml - The Handlebars template string
   * @param data - The data to render the template with
   * @returns Rendered HTML string
   */
  renderTemplate(templateHtml: string, data: Record<string, any>): string {
    try {
      // Compile the template
      const template = Handlebars.compile(templateHtml, {
        strict: false,
        noEscape: false, // Enable auto-escaping for XSS prevention
      });

      // Render with data
      const rendered = template(data || {});

      // Sanitize the rendered output to prevent XSS
      return this.sanitizeHtml(rendered);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Template rendering failed: ${message}`);
      throw new BadRequestException(`Template rendering failed: ${message}`);
    }
  }

  /**
   * Fetch data from an external data source
   *
   * @param dataSource - The data source configuration
   * @returns Fetched data object
   */
  async fetchDataFromSource(dataSource: DataSourceDto): Promise<Record<string, any>> {
    // Return manual data if type is manual
    if (dataSource.type === 'manual') {
      return dataSource.manualData || {};
    }

    // Validate URL is provided for API types
    if (!dataSource.url) {
      throw new BadRequestException('URL is required for rest_api and json_url data sources');
    }

    // Validate URL protocol (HTTPS only in production)
    const url = new URL(dataSource.url);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      throw new BadRequestException('Only HTTPS URLs are allowed in production');
    }

    // Block private/internal IPs
    this.validateExternalUrl(dataSource.url);

    const circuitName = `template-data-${url.hostname}`;

    try {
      const data = await this.circuitBreaker.executeWithFallback(
        circuitName,
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

          try {
            const response = await fetch(dataSource.url!, {
              method: dataSource.method || 'GET',
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Vizora-Template-Service/1.0',
                ...dataSource.headers,
              },
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const json = await response.json();
            return json;
          } finally {
            clearTimeout(timeoutId);
          }
        },
        (error) => {
          this.logger.warn(`Data source fetch failed, using empty data: ${error?.message}`);
          return {};
        },
        {
          failureThreshold: 3,
          resetTimeout: 30000,
          successThreshold: 2,
          failureWindow: 60000,
        },
      );

      // Extract nested data if jsonPath is specified
      if (dataSource.jsonPath && data) {
        return this.extractJsonPath(data, dataSource.jsonPath);
      }

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch data from source: ${message}`);
      throw new BadRequestException(`Failed to fetch data from source: ${message}`);
    }
  }

  /**
   * Extract data from a JSON object using a simple path notation
   * Supports: $.data, $.items[0], $.nested.path
   */
  private extractJsonPath(data: any, path: string): any {
    // Remove leading $. if present
    const cleanPath = path.replace(/^\$\.?/, '');
    if (!cleanPath) return data;

    const parts = cleanPath.split(/\.|\[|\]/).filter(Boolean);
    let current = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return {};
      }
      current = current[part];
    }

    return current ?? {};
  }

  /**
   * Validate URL is not pointing to internal/private resources
   */
  private validateExternalUrl(urlString: string): void {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block localhost variations
    const blockedHostnames = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '[::1]',
    ];

    if (blockedHostnames.includes(hostname)) {
      throw new BadRequestException('Internal URLs are not allowed');
    }

    // Block private IP ranges (simple check)
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      // 10.x.x.x
      if (a === 10) {
        throw new BadRequestException('Private IP addresses are not allowed');
      }
      // 172.16.x.x - 172.31.x.x
      if (a === 172 && b >= 16 && b <= 31) {
        throw new BadRequestException('Private IP addresses are not allowed');
      }
      // 192.168.x.x
      if (a === 192 && b === 168) {
        throw new BadRequestException('Private IP addresses are not allowed');
      }
      // 169.254.x.x (link-local)
      if (a === 169 && b === 254) {
        throw new BadRequestException('Link-local addresses are not allowed');
      }
    }

    // Block cloud metadata endpoints
    const metadataHostnames = [
      '169.254.169.254', // AWS/GCP/Azure metadata
      'metadata.google.internal',
      'metadata.gcp.internal',
    ];

    if (metadataHostnames.includes(hostname)) {
      throw new BadRequestException('Cloud metadata endpoints are not allowed');
    }
  }

  /**
   * Validate template HTML for security issues
   *
   * @param templateHtml - The template HTML to validate
   * @returns Validation result with any errors found
   */
  validateTemplate(templateHtml: string): ValidationResult {
    const errors: string[] = [];
    const lowerHtml = templateHtml.toLowerCase();

    // Check for forbidden tags
    for (const tag of this.FORBIDDEN_TAGS) {
      const regex = new RegExp(`<\\s*${tag}[\\s>]`, 'i');
      if (regex.test(templateHtml)) {
        errors.push(`Forbidden tag found: <${tag}>`);
      }
    }

    // Check for forbidden attributes
    for (const attr of this.FORBIDDEN_ATTRIBUTES) {
      const regex = new RegExp(`\\s${attr}\\s*=`, 'i');
      if (regex.test(templateHtml)) {
        errors.push(`Forbidden attribute found: ${attr}`);
      }
    }

    // Check for forbidden protocols in href/src attributes
    for (const protocol of this.FORBIDDEN_PROTOCOLS) {
      if (lowerHtml.includes(protocol)) {
        errors.push(`Forbidden protocol found: ${protocol}`);
      }
    }

    // Check for Handlebars triple-brace (unescaped) usage
    const unescapedPattern = /\{\{\{[^}]+\}\}\}/g;
    const unescapedMatches = templateHtml.match(unescapedPattern);
    if (unescapedMatches && unescapedMatches.length > 0) {
      errors.push(
        `Warning: Unescaped Handlebars expressions found (${unescapedMatches.length}). Use {{}} instead of {{{}}} for auto-escaping.`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize rendered HTML output using DOMPurify
   *
   * @param html - The HTML to sanitize
   * @returns Sanitized HTML string
   */
  sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'ul', 'ol', 'li',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
        'div', 'span',
        'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup',
        'a', 'img',
        'blockquote', 'pre', 'code',
        'dl', 'dt', 'dd',
        'figure', 'figcaption',
        'article', 'section', 'header', 'footer', 'nav', 'aside', 'main',
        'style',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'width', 'height',
        'class', 'id', 'style',
        'colspan', 'rowspan',
        'target', 'rel',
      ],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: this.FORBIDDEN_TAGS,
      FORBID_ATTR: this.FORBIDDEN_ATTRIBUTES,
    });
  }

  /**
   * Full template processing: validate, render, and sanitize
   *
   * @param templateHtml - The Handlebars template
   * @param data - The data to render with
   * @returns Sanitized rendered HTML
   */
  processTemplate(templateHtml: string, data: Record<string, any>): string {
    // Validate template first
    const validation = this.validateTemplate(templateHtml);
    if (!validation.valid) {
      throw new BadRequestException(
        `Template validation failed: ${validation.errors.join('; ')}`,
      );
    }

    // Render the template
    const rendered = this.renderTemplate(templateHtml, data);

    // Sanitize the output
    return this.sanitizeHtml(rendered);
  }
}
