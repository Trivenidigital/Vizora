import { CsrfMiddleware } from './csrf.middleware';
import { Request, Response, NextFunction } from 'express';
import { AUTH_CONSTANTS } from '../../auth/constants/auth.constants';

describe('CsrfMiddleware', () => {
  let middleware: CsrfMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    middleware = new CsrfMiddleware();

    mockRequest = {
      method: 'GET',
      path: '/api/test',
      cookies: {},
      headers: {},
    };

    mockResponse = {
      cookie: jest.fn(),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('CSRF token generation', () => {
    it('should generate a new CSRF token if not present', () => {
      mockRequest.cookies = {};

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        AUTH_CONSTANTS.CSRF_COOKIE_NAME,
        expect.stringMatching(/^[a-f0-9]{64}$/),
        expect.any(Object),
      );
    });

    it('should use existing CSRF token if present', () => {
      const existingToken = 'existing-token-1234567890abcdef';
      mockRequest.cookies = { [AUTH_CONSTANTS.CSRF_COOKIE_NAME]: existingToken };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        AUTH_CONSTANTS.CSRF_COOKIE_NAME,
        existingToken,
        expect.any(Object),
      );
    });

    it('should expose CSRF token in response header', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-CSRF-Token',
        expect.any(String),
      );
    });
  });

  describe('cookie settings', () => {
    describe('in development environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should set cookie with development settings', () => {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.cookie).toHaveBeenCalledWith(
          AUTH_CONSTANTS.CSRF_COOKIE_NAME,
          expect.any(String),
          expect.objectContaining({
            httpOnly: false,
            secure: false,
            sameSite: 'lax',
            path: '/',
          }),
        );
      });
    });

    describe('in production environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      afterEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should set cookie with production settings', () => {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.cookie).toHaveBeenCalledWith(
          AUTH_CONSTANTS.CSRF_COOKIE_NAME,
          expect.any(String),
          expect.objectContaining({
            httpOnly: false,
            secure: true,
            sameSite: 'strict',
            path: '/',
          }),
        );
      });
    });

    it('should set cookie maxAge to token expiry', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        AUTH_CONSTANTS.CSRF_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({
          maxAge: AUTH_CONSTANTS.TOKEN_EXPIRY_MS,
        }),
      );
    });
  });

  describe('safe HTTP methods', () => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

    safeMethods.forEach((method) => {
      it(`should call next() for ${method} requests without validation`, () => {
        mockRequest.method = method;
        mockRequest.cookies = {};

        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('public paths', () => {
    const publicPaths = ['/api/auth/login', '/api/auth/register'];

    publicPaths.forEach((path) => {
      it(`should skip CSRF validation for ${path}`, () => {
        mockRequest.method = 'POST';
        mockRequest.path = path;
        mockRequest.cookies = { [AUTH_CONSTANTS.CSRF_COOKIE_NAME]: 'some-token' };
        // No header token - should still pass for public paths

        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });
    });

    it('should skip CSRF for paths that start with public paths', () => {
      mockRequest.method = 'POST';
      mockRequest.path = '/api/auth/login/something';
      mockRequest.cookies = { [AUTH_CONSTANTS.CSRF_COOKIE_NAME]: 'some-token' };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('CSRF token validation', () => {
    beforeEach(() => {
      mockRequest.method = 'POST';
      mockRequest.path = '/api/protected';
    });

    it('should reject requests when no cookie token exists', () => {
      mockRequest.cookies = {};

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 403,
        message: 'CSRF cookie missing',
        error: 'Forbidden',
      });
    });

    it('should allow requests when tokens match', () => {
      const token = 'valid-csrf-token-1234567890abcdef';
      mockRequest.cookies = { [AUTH_CONSTANTS.CSRF_COOKIE_NAME]: token };
      mockRequest.headers = { [AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()]: token };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject requests when header token is missing', () => {
      mockRequest.cookies = { [AUTH_CONSTANTS.CSRF_COOKIE_NAME]: 'some-token' };
      mockRequest.headers = {};

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 403,
        message: 'Invalid CSRF token',
        error: 'Forbidden',
      });
    });

    it('should reject requests when tokens do not match', () => {
      mockRequest.cookies = { [AUTH_CONSTANTS.CSRF_COOKIE_NAME]: 'token-a' };
      mockRequest.headers = { [AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()]: 'token-b' };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should reject requests when tokens have different lengths', () => {
      mockRequest.cookies = { [AUTH_CONSTANTS.CSRF_COOKIE_NAME]: 'short' };
      mockRequest.headers = { [AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()]: 'much-longer-token' };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('state-changing methods validation', () => {
    const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    unsafeMethods.forEach((method) => {
      it(`should validate CSRF for ${method} requests`, () => {
        mockRequest.method = method;
        mockRequest.path = '/api/protected';
        mockRequest.cookies = { [AUTH_CONSTANTS.CSRF_COOKIE_NAME]: 'token-a' };
        mockRequest.headers = { [AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()]: 'token-b' };

        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
      });
    });
  });

  describe('secure comparison', () => {
    beforeEach(() => {
      mockRequest.method = 'POST';
      mockRequest.path = '/api/protected';
    });

    it('should handle non-string header token gracefully', () => {
      mockRequest.cookies = { [AUTH_CONSTANTS.CSRF_COOKIE_NAME]: 'valid-token' };
      mockRequest.headers = { [AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()]: undefined } as any;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should handle array header token gracefully', () => {
      mockRequest.cookies = { [AUTH_CONSTANTS.CSRF_COOKIE_NAME]: 'valid-token' };
      mockRequest.headers = { [AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()]: ['array', 'value'] } as any;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('undefined cookies', () => {
    it('should handle undefined cookies object', () => {
      mockRequest.cookies = undefined;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Should generate new token and continue
      expect(mockResponse.cookie).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
