import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let mockReflector: jest.Mocked<Reflector>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    mockRequest = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        organizationId: 'org-123',
      },
    };

    mockExecutionContext = {
      getHandler: jest.fn().mockReturnValue(() => {}),
      getClass: jest.fn().mockReturnValue(class TestClass {}),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    guard = new RolesGuard(mockReflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    describe('when no roles are required', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(undefined);
      });

      it('should return true', () => {
        const result = guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
      });

      it('should not check user', () => {
        guard.canActivate(mockExecutionContext);

        // Should return early before checking user
        expect(mockReflector.getAllAndOverride).toHaveBeenCalled();
      });
    });

    describe('when roles are required and user has required role', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(['admin']);
        mockRequest.user.role = 'admin';
      });

      it('should return true for matching role', () => {
        const result = guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
      });

      it('should return true when user has one of multiple required roles', () => {
        mockReflector.getAllAndOverride.mockReturnValue(['admin', 'manager', 'viewer']);
        mockRequest.user.role = 'manager';

        const result = guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
      });
    });

    describe('when user does not have required role', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(['admin']);
        mockRequest.user.role = 'viewer';
      });

      it('should throw ForbiddenException', () => {
        expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
      });

      it('should include required roles in error message', () => {
        mockReflector.getAllAndOverride.mockReturnValue(['admin', 'manager']);

        expect(() => guard.canActivate(mockExecutionContext)).toThrow(
          'Insufficient permissions. Required roles: admin, manager',
        );
      });
    });

    describe('when user is not authenticated', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(['admin']);
        mockRequest.user = undefined;
      });

      it('should throw ForbiddenException', () => {
        expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
      });

      it('should indicate user not authenticated', () => {
        expect(() => guard.canActivate(mockExecutionContext)).toThrow(
          'User not authenticated',
        );
      });

      it('should handle null user', () => {
        mockRequest.user = null;

        expect(() => guard.canActivate(mockExecutionContext)).toThrow(
          'User not authenticated',
        );
      });
    });

    describe('when roles array is empty', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue([]);
      });

      it('should throw ForbiddenException since no role can match empty array', () => {
        // Empty array means no roles can satisfy the requirement
        // user.role === any role in [] will always be false
        expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
      });
    });

    describe('when roles is null', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(null);
      });

      it('should return true (null is falsy)', () => {
        const result = guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
      });
    });
  });

  describe('role matching', () => {
    beforeEach(() => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
    });

    it('should match exact role string', () => {
      mockRequest.user.role = 'admin';

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should be case sensitive', () => {
      mockRequest.user.role = 'Admin';

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should not match partial role', () => {
      mockRequest.user.role = 'administrator';

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should handle user with no role property', () => {
      mockRequest.user = { id: 'user-123', email: 'test@example.com' };

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });
  });

  describe('reflector integration', () => {
    it('should call getAllAndOverride with roles key', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      guard.canActivate(mockExecutionContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith('roles', expect.any(Array));
    });

    it('should pass handler and class to reflector', () => {
      const mockHandler = jest.fn();
      const mockClass = class MockController {};

      mockExecutionContext.getHandler.mockReturnValue(mockHandler);
      mockExecutionContext.getClass.mockReturnValue(mockClass);
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      guard.canActivate(mockExecutionContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith('roles', [
        mockHandler,
        mockClass,
      ]);
    });
  });

  describe('different user roles', () => {
    const testCases = [
      { role: 'admin', requiredRoles: ['admin'], shouldPass: true },
      { role: 'admin', requiredRoles: ['manager'], shouldPass: false },
      { role: 'manager', requiredRoles: ['admin', 'manager'], shouldPass: true },
      { role: 'viewer', requiredRoles: ['admin', 'manager'], shouldPass: false },
      { role: 'viewer', requiredRoles: ['viewer'], shouldPass: true },
      { role: 'viewer', requiredRoles: ['admin', 'manager', 'viewer'], shouldPass: true },
    ];

    testCases.forEach(({ role, requiredRoles, shouldPass }) => {
      it(`should ${shouldPass ? 'allow' : 'deny'} user with role "${role}" when required roles are [${requiredRoles.join(', ')}]`, () => {
        mockReflector.getAllAndOverride.mockReturnValue(requiredRoles);
        mockRequest.user.role = role;

        if (shouldPass) {
          expect(guard.canActivate(mockExecutionContext)).toBe(true);
        } else {
          expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should handle when switchToHttp throws', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      mockExecutionContext.switchToHttp.mockImplementation(() => {
        throw new Error('HTTP context error');
      });

      expect(() => guard.canActivate(mockExecutionContext)).toThrow('HTTP context error');
    });

    it('should handle when getRequest throws', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      (mockExecutionContext.switchToHttp() as any).getRequest.mockImplementation(() => {
        throw new Error('Request error');
      });

      expect(() => guard.canActivate(mockExecutionContext)).toThrow('Request error');
    });

    it('should handle user.role being undefined', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      mockRequest.user.role = undefined;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should handle user.role being empty string', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      mockRequest.user.role = '';

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });
  });
});
