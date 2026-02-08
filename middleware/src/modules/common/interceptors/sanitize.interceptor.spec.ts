import { SanitizeInterceptor } from './sanitize.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('SanitizeInterceptor', () => {
  let interceptor: SanitizeInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: { body: unknown; query: unknown; params: unknown };

  beforeEach(() => {
    interceptor = new SanitizeInterceptor();

    mockRequest = { body: {}, query: {}, params: {} };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({})),
    };
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('XSS Prevention', () => {
    it('should strip script tags from strings', () => {
      mockRequest.body = {
        name: '<script>alert("xss")</script>John',
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({
        name: 'John',
      });
    });

    it('should strip inline event handlers', () => {
      mockRequest.body = {
        description: '<img src="x" onerror="alert(1)">Image',
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({
        description: 'Image',
      });
    });

    it('should strip javascript: URLs', () => {
      mockRequest.body = {
        link: '<a href="javascript:alert(1)">Click me</a>',
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({
        link: 'Click me',
      });
    });

    it('should strip all HTML tags', () => {
      mockRequest.body = {
        content: '<div><p>Hello <b>World</b></p></div>',
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({
        content: 'Hello World',
      });
    });

    it('should handle encoded XSS attempts', () => {
      mockRequest.body = {
        name: '&lt;script&gt;alert("xss")&lt;/script&gt;',
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      // HTML entities should remain as text
      expect(mockRequest.body.name).not.toContain('<script>');
    });
  });

  describe('Nested Object Handling', () => {
    it('should sanitize nested objects', () => {
      mockRequest.body = {
        user: {
          name: '<script>evil()</script>John',
          profile: {
            bio: '<img src=x onerror=alert(1)>Bio text',
          },
        },
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({
        user: {
          name: 'John',
          profile: {
            bio: 'Bio text',
          },
        },
      });
    });

    it('should sanitize arrays of strings', () => {
      mockRequest.body = {
        tags: ['<script>alert(1)</script>tag1', 'tag2', '<b>tag3</b>'],
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({
        tags: ['tag1', 'tag2', 'tag3'],
      });
    });

    it('should sanitize arrays of objects', () => {
      mockRequest.body = {
        items: [
          { name: '<script>evil()</script>Item 1' },
          { name: 'Item 2' },
        ],
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({
        items: [{ name: 'Item 1' }, { name: 'Item 2' }],
      });
    });
  });

  describe('Password Field Protection', () => {
    it('should not sanitize password fields', () => {
      const specialPassword = '<>Test123!@#$%^&*()';
      mockRequest.body = {
        email: 'test@example.com',
        password: specialPassword,
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body.password).toBe(specialPassword);
    });

    it('should not sanitize passwordHash fields', () => {
      const hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.zX.zX.zX.zX.zX';
      mockRequest.body = {
        passwordHash: hash,
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body.passwordHash).toBe(hash);
    });

    it('should not sanitize newPassword fields', () => {
      const newPass = '<>NewPass123!';
      mockRequest.body = {
        newPassword: newPass,
        confirmPassword: newPass,
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body.newPassword).toBe(newPass);
      expect(mockRequest.body.confirmPassword).toBe(newPass);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null body', () => {
      mockRequest.body = null;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toBeNull();
    });

    it('should handle undefined body', () => {
      mockRequest.body = undefined;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toBeUndefined();
    });

    it('should handle empty object', () => {
      mockRequest.body = {};

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({});
    });

    it('should handle numbers without modification', () => {
      mockRequest.body = {
        age: 25,
        count: 0,
        negative: -5,
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({
        age: 25,
        count: 0,
        negative: -5,
      });
    });

    it('should handle booleans without modification', () => {
      mockRequest.body = {
        active: true,
        verified: false,
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({
        active: true,
        verified: false,
      });
    });

    it('should trim whitespace from strings', () => {
      mockRequest.body = {
        name: '  John Doe  ',
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({
        name: 'John Doe',
      });
    });

    it('should handle null values in objects', () => {
      mockRequest.body = {
        name: 'John',
        middleName: null,
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({
        name: 'John',
        middleName: null,
      });
    });
  });

  describe('Query Params Sanitization', () => {
    it('should sanitize XSS in query parameters', () => {
      mockRequest.query = {
        search: '<script>alert("xss")</script>searchterm',
        page: '1',
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.query).toEqual({
        search: 'searchterm',
        page: '1',
      });
    });

    it('should strip HTML tags from query strings', () => {
      mockRequest.query = {
        filter: '<img src=x onerror=alert(1)>active',
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.query).toEqual({
        filter: 'active',
      });
    });

    it('should handle empty query object', () => {
      mockRequest.query = {};

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.query).toEqual({});
    });

    it('should handle null query', () => {
      mockRequest.query = null;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.query).toBeNull();
    });

    it('should handle undefined query', () => {
      mockRequest.query = undefined;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.query).toBeUndefined();
    });
  });

  describe('URL Params Sanitization', () => {
    it('should sanitize XSS in URL parameters', () => {
      mockRequest.params = {
        id: '<script>alert("xss")</script>abc123',
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.params).toEqual({
        id: 'abc123',
      });
    });

    it('should strip HTML tags from URL params', () => {
      mockRequest.params = {
        slug: '<b>my-page</b>',
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.params).toEqual({
        slug: 'my-page',
      });
    });

    it('should handle empty params object', () => {
      mockRequest.params = {};

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.params).toEqual({});
    });

    it('should handle null params', () => {
      mockRequest.params = null;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.params).toBeNull();
    });
  });

  describe('Combined Sanitization', () => {
    it('should sanitize body, query, and params in a single request', () => {
      mockRequest.body = { name: '<script>evil()</script>John' };
      mockRequest.query = { search: '<img src=x onerror=alert(1)>term' };
      mockRequest.params = { id: '<b>abc123</b>' };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body).toEqual({ name: 'John' });
      expect(mockRequest.query).toEqual({ search: 'term' });
      expect(mockRequest.params).toEqual({ id: 'abc123' });
    });
  });

  describe('Call Handler', () => {
    it('should call next handler after sanitization', () => {
      mockRequest.body = { name: 'John' };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should return observable from handler', (done) => {
      mockRequest.body = { name: 'John' };
      const expectedResponse = { success: true };
      mockCallHandler.handle = jest.fn().mockReturnValue(of(expectedResponse));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe((response) => {
        expect(response).toEqual(expectedResponse);
        done();
      });
    });
  });
});
