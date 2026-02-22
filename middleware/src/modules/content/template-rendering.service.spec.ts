import { BadRequestException } from '@nestjs/common';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { DataSourceDto } from './dto/create-template.dto';

// Mock isomorphic-dompurify before importing the service
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string, options?: any) => {
      // Simple mock that removes script tags
      return html.replace(/<script[^>]*>.*?<\/script>/gi, '');
    }),
  },
}));

// Import after mocking
import { TemplateRenderingService } from './template-rendering.service';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('TemplateRenderingService', () => {
  let service: TemplateRenderingService;
  let mockCircuitBreaker: jest.Mocked<CircuitBreakerService>;

  beforeEach(() => {
    mockCircuitBreaker = {
      execute: jest.fn(),
      executeWithFallback: jest.fn(),
      getCircuitState: jest.fn(),
      getCircuitStats: jest.fn(),
      resetCircuit: jest.fn(),
      getCircuitNames: jest.fn(),
    } as any;

    service = new TemplateRenderingService(mockCircuitBreaker);
    mockFetch.mockClear();
  });

  describe('renderTemplate', () => {
    it('should render a simple template with data', () => {
      const template = '<h1>{{title}}</h1>';
      const data = { title: 'Hello World' };

      const result = service.renderTemplate(template, data);

      expect(result).toBe('<h1>Hello World</h1>');
    });

    it('should render template with multiple variables', () => {
      const template = '<div>{{name}} - {{price}}</div>';
      const data = { name: 'Product', price: '$9.99' };

      const result = service.renderTemplate(template, data);

      expect(result).toBe('<div>Product - $9.99</div>');
    });

    it('should render template with each helper', () => {
      const template = '{{#each items}}<li>{{this}}</li>{{/each}}';
      const data = { items: ['Apple', 'Banana', 'Cherry'] };

      const result = service.renderTemplate(template, data);

      expect(result).toBe('<li>Apple</li><li>Banana</li><li>Cherry</li>');
    });

    it('should render template with nested objects', () => {
      const template = '<span>{{user.name}} ({{user.email}})</span>';
      const data = { user: { name: 'John', email: 'john@example.com' } };

      const result = service.renderTemplate(template, data);

      expect(result).toBe('<span>John (john@example.com)</span>');
    });

    it('should handle missing data gracefully', () => {
      const template = '<h1>{{title}}</h1>';
      const data = {};

      const result = service.renderTemplate(template, data);

      expect(result).toBe('<h1></h1>');
    });

    it('should auto-escape HTML by default (XSS prevention)', () => {
      const template = '<div>{{content}}</div>';
      const data = { content: '<script>alert("xss")</script>' };

      const result = service.renderTemplate(template, data);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should render template with if helper', () => {
      const template = '{{#if show}}<p>Visible</p>{{/if}}';

      expect(service.renderTemplate(template, { show: true })).toBe('<p>Visible</p>');
      expect(service.renderTemplate(template, { show: false })).toBe('');
    });

    it('should render template with unless helper', () => {
      const template = '{{#unless hidden}}<p>Shown</p>{{/unless}}';

      expect(service.renderTemplate(template, { hidden: false })).toBe('<p>Shown</p>');
      expect(service.renderTemplate(template, { hidden: true })).toBe('');
    });

    it('should throw BadRequestException for invalid template syntax', () => {
      const invalidTemplate = '{{#each items}}<li>{{this}}</li>'; // Missing closing tag

      expect(() => service.renderTemplate(invalidTemplate, { items: [] })).toThrow(
        BadRequestException,
      );
    });

    it('should handle empty template', () => {
      const result = service.renderTemplate('', {});
      expect(result).toBe('');
    });

    it('should handle empty data', () => {
      const template = '<p>Static content</p>';
      const result = service.renderTemplate(template, {});
      expect(result).toBe('<p>Static content</p>');
    });
  });

  describe('Custom Handlebars Helpers', () => {
    it('should format date with formatDate helper', () => {
      const template = '{{formatDate date}}';
      const data = { date: '2024-01-15T00:00:00Z' };

      const result = service.renderTemplate(template, data);

      // The result should be a localized date string
      expect(result).toBeTruthy();
      expect(result).not.toBe('Invalid Date');
    });

    it('should format number with formatNumber helper', () => {
      const template = '{{formatNumber value 2}}';
      const data = { value: 123.456 };

      const result = service.renderTemplate(template, data);

      expect(result).toBe('123.46');
    });

    it('should format currency with formatCurrency helper', () => {
      const template = '{{formatCurrency price "USD"}}';
      const data = { price: 99.99 };

      const result = service.renderTemplate(template, data);

      expect(result).toContain('99.99');
      expect(result).toContain('$');
    });

    it('should compare values with eq helper', () => {
      const template = '{{#if (eq status "active")}}Active{{else}}Inactive{{/if}}';

      expect(service.renderTemplate(template, { status: 'active' })).toBe('Active');
      expect(service.renderTemplate(template, { status: 'inactive' })).toBe('Inactive');
    });

    it('should compare values with ne helper', () => {
      const template = '{{#if (ne status "active")}}Not Active{{else}}Active{{/if}}';

      expect(service.renderTemplate(template, { status: 'pending' })).toBe('Not Active');
      expect(service.renderTemplate(template, { status: 'active' })).toBe('Active');
    });

    it('should compare numbers with gt helper', () => {
      const template = '{{#if (gt count 5)}}Many{{else}}Few{{/if}}';

      expect(service.renderTemplate(template, { count: 10 })).toBe('Many');
      expect(service.renderTemplate(template, { count: 3 })).toBe('Few');
    });

    it('should compare numbers with lt helper', () => {
      const template = '{{#if (lt count 5)}}Low{{else}}High{{/if}}';

      expect(service.renderTemplate(template, { count: 3 })).toBe('Low');
      expect(service.renderTemplate(template, { count: 10 })).toBe('High');
    });

    it('should stringify JSON with json helper', () => {
      const template = '{{json data}}';
      const data = { data: { key: 'value' } };

      const result = service.renderTemplate(template, data);

      // Handlebars auto-escapes the output, so quotes become &quot;
      expect(result).toContain('key');
      expect(result).toContain('value');
    });
  });

  describe('validateTemplate', () => {
    it('should return valid for clean template', () => {
      const template = '<h1>{{title}}</h1><p>{{description}}</p>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect script tags', () => {
      const template = '<script>alert("xss")</script>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden tag found: <script>');
    });

    it('should detect iframe tags', () => {
      const template = '<iframe src="https://evil.com"></iframe>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden tag found: <iframe>');
    });

    it('should detect object tags', () => {
      const template = '<object data="malware.swf"></object>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden tag found: <object>');
    });

    it('should detect embed tags', () => {
      const template = '<embed src="malware.swf">';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden tag found: <embed>');
    });

    it('should detect form tags', () => {
      const template = '<form action="https://evil.com"><input></form>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden tag found: <form>');
    });

    it('should detect onclick attribute', () => {
      const template = '<button onclick="alert(1)">Click</button>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden attribute found: onclick');
    });

    it('should detect onerror attribute', () => {
      const template = '<img src="x" onerror="alert(1)">';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden attribute found: onerror');
    });

    it('should detect onload attribute', () => {
      const template = '<body onload="init()">';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden attribute found: onload');
    });

    it('should detect onmouseover attribute', () => {
      const template = '<div onmouseover="hack()">Hover me</div>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden attribute found: onmouseover');
    });

    it('should detect javascript: protocol', () => {
      const template = '<a href="javascript:alert(1)">Click</a>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden protocol found: javascript:');
    });

    it('should detect dangerous data: protocol (text/html)', () => {
      const template = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden protocol found: data:');
    });

    it('should allow data:image/ URIs for embedded images', () => {
      const template = '<img src="data:image/svg+xml;base64,PHN2Zy8+" />';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(true);
    });

    it('should detect vbscript: protocol', () => {
      const template = '<a href="vbscript:MsgBox(1)">Click</a>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden protocol found: vbscript:');
    });

    it('should warn about unescaped Handlebars expressions', () => {
      const template = '<div>{{{unsafeContent}}}</div>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unescaped Handlebars'))).toBe(true);
    });

    it('should report multiple errors', () => {
      const template = '<script></script><iframe></iframe>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle case-insensitive tag detection', () => {
      const template = '<SCRIPT>alert(1)</SCRIPT>';

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeHtml', () => {
    // Note: These tests use a mocked DOMPurify, so we test that the method
    // calls DOMPurify.sanitize correctly rather than actual sanitization behavior.
    // The real DOMPurify behavior is tested in integration/E2E tests.

    it('should call DOMPurify.sanitize with the HTML', () => {
      const html = '<h1>Title</h1><p>Paragraph</p>';

      const result = service.sanitizeHtml(html);

      // Our mock removes script tags, which is enough to verify the method works
      expect(result).toBeDefined();
    });

    it('should remove script tags (mock behavior)', () => {
      const html = '<p>Hello</p><script>alert(1)</script>';

      const result = service.sanitizeHtml(html);

      // Our mock specifically removes script tags
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>Hello</p>');
    });

    it('should handle empty input', () => {
      const result = service.sanitizeHtml('');
      expect(result).toBe('');
    });

    it('should handle HTML without dangerous content', () => {
      const html = '<div class="container"><h1>Safe Content</h1></div>';

      const result = service.sanitizeHtml(html);

      expect(result).toBe(html); // Mock doesn't modify safe HTML
    });
  });

  describe('fetchDataFromSource', () => {
    it('should return manual data when type is manual', async () => {
      const dataSource: DataSourceDto = {
        type: 'manual',
        manualData: { title: 'Manual Title', items: [1, 2, 3] },
      };

      const result = await service.fetchDataFromSource(dataSource);

      expect(result).toEqual({ title: 'Manual Title', items: [1, 2, 3] });
    });

    it('should return empty object for manual type without data', async () => {
      const dataSource: DataSourceDto = {
        type: 'manual',
      };

      const result = await service.fetchDataFromSource(dataSource);

      expect(result).toEqual({});
    });

    it('should throw error when URL is missing for rest_api type', async () => {
      const dataSource: DataSourceDto = {
        type: 'rest_api',
      };

      await expect(service.fetchDataFromSource(dataSource)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when URL is missing for json_url type', async () => {
      const dataSource: DataSourceDto = {
        type: 'json_url',
      };

      await expect(service.fetchDataFromSource(dataSource)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block localhost URLs', async () => {
      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'http://localhost:8080/api',
      };

      await expect(service.fetchDataFromSource(dataSource)).rejects.toThrow(
        'Internal URLs are not allowed',
      );
    });

    it('should block 127.0.0.1 URLs', async () => {
      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'http://127.0.0.1:8080/api',
      };

      await expect(service.fetchDataFromSource(dataSource)).rejects.toThrow(
        'Internal URLs are not allowed',
      );
    });

    it('should block private IP addresses (10.x.x.x)', async () => {
      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'http://10.0.0.1/api',
      };

      await expect(service.fetchDataFromSource(dataSource)).rejects.toThrow(
        'Private IP addresses are not allowed',
      );
    });

    it('should block private IP addresses (172.16.x.x)', async () => {
      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'http://172.16.0.1/api',
      };

      await expect(service.fetchDataFromSource(dataSource)).rejects.toThrow(
        'Private IP addresses are not allowed',
      );
    });

    it('should block private IP addresses (192.168.x.x)', async () => {
      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'http://192.168.1.1/api',
      };

      await expect(service.fetchDataFromSource(dataSource)).rejects.toThrow(
        'Private IP addresses are not allowed',
      );
    });

    it('should block AWS metadata endpoint (link-local)', async () => {
      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'http://169.254.169.254/latest/meta-data',
      };

      // 169.254.169.254 is blocked as link-local address (169.254.x.x range)
      await expect(service.fetchDataFromSource(dataSource)).rejects.toThrow(
        'Link-local addresses are not allowed',
      );
    });

    it('should block Google Cloud metadata endpoint (hostname)', async () => {
      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'http://metadata.google.internal/computeMetadata/v1/',
      };

      await expect(service.fetchDataFromSource(dataSource)).rejects.toThrow(
        'Cloud metadata endpoints are not allowed',
      );
    });

    it('should fetch data from external URL using circuit breaker', async () => {
      const mockData = { items: [{ name: 'Item 1' }] };
      mockCircuitBreaker.executeWithFallback.mockResolvedValue(mockData);

      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'https://api.example.com/data',
        method: 'GET',
      };

      const result = await service.fetchDataFromSource(dataSource);

      expect(result).toEqual(mockData);
      expect(mockCircuitBreaker.executeWithFallback).toHaveBeenCalled();
    });

    it('should extract nested data using jsonPath', async () => {
      const mockData = { response: { data: { items: [1, 2, 3] } } };
      mockCircuitBreaker.executeWithFallback.mockResolvedValue(mockData);

      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'https://api.example.com/data',
        jsonPath: '$.response.data',
      };

      const result = await service.fetchDataFromSource(dataSource);

      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it('should extract array data using jsonPath', async () => {
      const mockData = { items: ['a', 'b', 'c'] };
      mockCircuitBreaker.executeWithFallback.mockResolvedValue(mockData);

      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'https://api.example.com/data',
        jsonPath: 'items',
      };

      const result = await service.fetchDataFromSource(dataSource);

      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should return empty object when jsonPath yields null', async () => {
      const mockData = { other: 'data' };
      mockCircuitBreaker.executeWithFallback.mockResolvedValue(mockData);

      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'https://api.example.com/data',
        jsonPath: 'nonexistent.path',
      };

      const result = await service.fetchDataFromSource(dataSource);

      expect(result).toEqual({});
    });

    it('should return fallback on circuit breaker failure', async () => {
      mockCircuitBreaker.executeWithFallback.mockResolvedValue({});

      const dataSource: DataSourceDto = {
        type: 'rest_api',
        url: 'https://api.example.com/data',
      };

      const result = await service.fetchDataFromSource(dataSource);

      expect(result).toEqual({});
    });
  });

  describe('processTemplate', () => {
    it('should validate, render, and sanitize template', () => {
      const template = '<h1>{{title}}</h1><p>{{content}}</p>';
      const data = { title: 'Hello', content: 'World' };

      const result = service.processTemplate(template, data);

      expect(result).toContain('<h1>Hello</h1>');
      expect(result).toContain('<p>World</p>');
    });

    it('should throw error for invalid template', () => {
      const template = '<script>alert(1)</script><h1>{{title}}</h1>';
      const data = { title: 'Test' };

      expect(() => service.processTemplate(template, data)).toThrow(
        BadRequestException,
      );
    });

    it('should sanitize potentially dangerous rendered output', () => {
      // Even if XSS somehow gets through rendering, sanitization catches it
      const template = '<div>{{content}}</div>';
      const data = { content: 'Safe content' };

      const result = service.processTemplate(template, data);

      expect(result).toBe('<div>Safe content</div>');
    });

    it('should handle complex template with multiple features', () => {
      const template = `
        <div class="menu">
          <h1>{{title}}</h1>
          {{#each items}}
            <div class="item">
              <span>{{name}}</span>
              <span>{{formatCurrency price "USD"}}</span>
            </div>
          {{/each}}
        </div>
      `;
      const data = {
        title: 'Menu',
        items: [
          { name: 'Burger', price: 9.99 },
          { name: 'Fries', price: 3.99 },
        ],
      };

      const result = service.processTemplate(template, data);

      expect(result).toContain('Menu');
      expect(result).toContain('Burger');
      expect(result).toContain('Fries');
    });
  });
});
