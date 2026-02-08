import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard, generateCsrfToken } from './csrf.guard';
import { AUTH_CONSTANTS } from '../../auth/constants/auth.constants';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let mockReflector: jest.Mocked<Reflector>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    mockRequest = {
      method: 'POST',
      cookies: {},
      headers: {},
    };

    mockExecutionContext = {
      getHandler: jest.fn().mockReturnValue(() => {}),
      getClass: jest.fn().mockReturnValue(class TestClass {}),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    guard = new CsrfGuard(mockReflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    describe('when route is marked with @SkipCsrf', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(true);
      });

      it('should return true without CSRF validation', () => {
        mockRequest.method = 'POST';
        mockRequest.cookies = {}; // No CSRF cookie
        mockRequest.headers = {}; // No CSRF header

        const result = guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
      });
    });

    describe('safe HTTP methods', () => {
      const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

      safeMethods.forEach((method) => {
        it(`should return true for ${method} requests without CSRF validation`, () => {
          mockRequest.method = method;
          mockRequest.cookies = {}; // No CSRF cookie
          mockRequest.headers = {}; // No CSRF header
          mockReflector.getAllAndOverride.mockReturnValue(false);

          const result = guard.canActivate(mockExecutionContext);

          expect(result).toBe(true);
        });
      });
    });

    describe('state-changing HTTP methods', () => {
      const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

      unsafeMethods.forEach((method) => {
        describe(`${method} requests`, () => {
          beforeEach(() => {
            mockRequest.method = method;
            mockReflector.getAllAndOverride.mockReturnValue(false);
          });

          it('should throw ForbiddenException when no cookie token exists', () => {
            mockRequest.cookies = {};
            mockRequest.headers = {};

            expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
            expect(() => guard.canActivate(mockExecutionContext)).toThrow('CSRF cookie missing');
          });

          it('should return true when cookie token and header token match', () => {
            const token = generateCsrfToken();
            mockRequest.cookies[AUTH_CONSTANTS.CSRF_COOKIE_NAME] = token;
            mockRequest.headers[AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()] = token;

            const result = guard.canActivate(mockExecutionContext);

            expect(result).toBe(true);
          });

          it('should throw ForbiddenException when header token is missing', () => {
            const token = generateCsrfToken();
            mockRequest.cookies[AUTH_CONSTANTS.CSRF_COOKIE_NAME] = token;
            mockRequest.headers = {};

            expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
            expect(() => guard.canActivate(mockExecutionContext)).toThrow('Invalid CSRF token');
          });

          it('should throw ForbiddenException when tokens do not match', () => {
            mockRequest.cookies[AUTH_CONSTANTS.CSRF_COOKIE_NAME] = generateCsrfToken();
            mockRequest.headers[AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()] = generateCsrfToken();

            expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
            expect(() => guard.canActivate(mockExecutionContext)).toThrow('Invalid CSRF token');
          });

          it('should throw ForbiddenException when header token is empty string', () => {
            const token = generateCsrfToken();
            mockRequest.cookies[AUTH_CONSTANTS.CSRF_COOKIE_NAME] = token;
            mockRequest.headers[AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()] = '';

            expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
          });
        });
      });
    });

    describe('cookie token edge cases', () => {
      beforeEach(() => {
        mockRequest.method = 'POST';
        mockReflector.getAllAndOverride.mockReturnValue(false);
      });

      it('should throw ForbiddenException for undefined cookies', () => {
        mockRequest.cookies = undefined;

        expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(mockExecutionContext)).toThrow('CSRF cookie missing');
      });

      it('should throw ForbiddenException for empty cookie token', () => {
        mockRequest.cookies[AUTH_CONSTANTS.CSRF_COOKIE_NAME] = '';

        // Empty string is falsy, so should be treated as missing cookie
        expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(mockExecutionContext)).toThrow('CSRF cookie missing');
      });
    });

    describe('timing attack prevention', () => {
      beforeEach(() => {
        mockRequest.method = 'POST';
        mockReflector.getAllAndOverride.mockReturnValue(false);
      });

      it('should reject tokens of different lengths securely', () => {
        mockRequest.cookies[AUTH_CONSTANTS.CSRF_COOKIE_NAME] = 'short';
        mockRequest.headers[AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()] = 'muchlongertoken';

        expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
      });

      it('should reject tokens that differ only in last character', () => {
        const token = generateCsrfToken();
        const similarToken = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');

        mockRequest.cookies[AUTH_CONSTANTS.CSRF_COOKIE_NAME] = token;
        mockRequest.headers[AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()] = similarToken;

        expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
      });
    });
  });

  describe('reflector integration', () => {
    it('should check skipCsrf metadata on both handler and class', () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      guard.canActivate(mockExecutionContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith('skipCsrf', [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ]);
    });
  });
});

describe('generateCsrfToken', () => {
  it('should generate a 64-character hex string', () => {
    const token = generateCsrfToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set();
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      tokens.add(generateCsrfToken());
    }

    expect(tokens.size).toBe(iterations);
  });

  it('should use cryptographically secure random bytes', () => {
    // Generate many tokens and check for reasonable entropy
    const tokens = [];
    for (let i = 0; i < 100; i++) {
      tokens.push(generateCsrfToken());
    }

    // Check no obvious patterns
    const uniqueChars = new Set(tokens.join('').split(''));
    expect(uniqueChars.size).toBeGreaterThanOrEqual(14); // Hex has 16 possible chars
  });
});
