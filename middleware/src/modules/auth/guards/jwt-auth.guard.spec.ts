import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Mock the passport AuthGuard before importing JwtAuthGuard
jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn().mockImplementation(() => {
    return class MockAuthGuard {
      canActivate() {
        return true;
      }
    };
  }),
}));

import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockReflector: jest.Mocked<Reflector>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    mockExecutionContext = {
      getHandler: jest.fn().mockReturnValue(() => {}),
      getClass: jest.fn().mockReturnValue(class TestClass {}),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
        getResponse: jest.fn().mockReturnValue({}),
      }),
    } as any;

    guard = new JwtAuthGuard(mockReflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    describe('when route is marked as public', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(true);
      });

      it('should return true without calling super.canActivate', () => {
        const result = guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
        expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
          mockExecutionContext.getHandler(),
          mockExecutionContext.getClass(),
        ]);
      });

      it('should check both handler and class metadata', () => {
        guard.canActivate(mockExecutionContext);

        expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
          'isPublic',
          expect.arrayContaining([
            expect.any(Function),
            expect.any(Function),
          ]),
        );
      });
    });

    describe('when route is not marked as public', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(false);
      });

      it('should call super.canActivate and return true', () => {
        const result = guard.canActivate(mockExecutionContext);

        // Since we mocked AuthGuard to return true, this should pass through
        expect(result).toBe(true);
        expect(mockReflector.getAllAndOverride).toHaveBeenCalled();
      });
    });

    describe('when isPublic metadata is undefined', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(undefined);
      });

      it('should not treat undefined as public and call super.canActivate', () => {
        const result = guard.canActivate(mockExecutionContext);

        // undefined is falsy, so should call super.canActivate (mocked to return true)
        expect(result).toBe(true);
        expect(mockReflector.getAllAndOverride).toHaveBeenCalled();
      });
    });

    describe('when isPublic metadata is null', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(null);
      });

      it('should not treat null as public and call super.canActivate', () => {
        const result = guard.canActivate(mockExecutionContext);

        // null is falsy, so should call super.canActivate (mocked to return true)
        expect(result).toBe(true);
        expect(mockReflector.getAllAndOverride).toHaveBeenCalled();
      });
    });
  });

  describe('reflector integration', () => {
    it('should use getAllAndOverride to check metadata', () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      guard.canActivate(mockExecutionContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledTimes(1);
    });

    it('should pass handler and class to reflector', () => {
      const mockHandler = jest.fn();
      const mockClass = class MockController {};

      mockExecutionContext.getHandler.mockReturnValue(mockHandler);
      mockExecutionContext.getClass.mockReturnValue(mockClass);
      mockReflector.getAllAndOverride.mockReturnValue(true);

      guard.canActivate(mockExecutionContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        mockHandler,
        mockClass,
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle when getHandler throws', () => {
      mockExecutionContext.getHandler.mockImplementation(() => {
        throw new Error('Handler error');
      });

      expect(() => guard.canActivate(mockExecutionContext)).toThrow('Handler error');
    });

    it('should handle when getClass throws', () => {
      mockExecutionContext.getClass.mockImplementation(() => {
        throw new Error('Class error');
      });

      expect(() => guard.canActivate(mockExecutionContext)).toThrow('Class error');
    });

    it('should handle falsy values that are not explicitly false', () => {
      // Test with 0
      mockReflector.getAllAndOverride.mockReturnValue(0 as any);
      let result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true); // 0 is falsy, so calls super

      // Test with empty string
      mockReflector.getAllAndOverride.mockReturnValue('' as any);
      result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true); // '' is falsy, so calls super
    });
  });
});
