import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';

// Helper to get decorator factory
function getParamDecoratorFactory(decorator: Function) {
  class Test {
    public test(@decorator() value: any) {}
  }

  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('CurrentUser Decorator', () => {
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;
  let factory: Function;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        role: 'admin',
      },
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    factory = getParamDecoratorFactory(CurrentUser);
  });

  describe('without property specified', () => {
    it('should return entire user object', () => {
      const result = factory(undefined, mockExecutionContext);

      expect(result).toEqual(mockRequest.user);
    });

    it('should return undefined when user is not present', () => {
      mockRequest.user = undefined;

      const result = factory(undefined, mockExecutionContext);

      expect(result).toBeUndefined();
    });

    it('should return null when user is null', () => {
      mockRequest.user = null;

      const result = factory(undefined, mockExecutionContext);

      expect(result).toBeNull();
    });
  });

  describe('with property specified', () => {
    it('should return user id', () => {
      const result = factory('id', mockExecutionContext);

      expect(result).toBe('user-123');
    });

    it('should return user email', () => {
      const result = factory('email', mockExecutionContext);

      expect(result).toBe('test@example.com');
    });

    it('should return user organizationId', () => {
      const result = factory('organizationId', mockExecutionContext);

      expect(result).toBe('org-123');
    });

    it('should return user role', () => {
      const result = factory('role', mockExecutionContext);

      expect(result).toBe('admin');
    });

    it('should return undefined for non-existent property', () => {
      const result = factory('nonExistent', mockExecutionContext);

      expect(result).toBeUndefined();
    });

    it('should return undefined when user is not present', () => {
      mockRequest.user = undefined;

      const result = factory('id', mockExecutionContext);

      expect(result).toBeUndefined();
    });
  });

  describe('HTTP context', () => {
    it('should switch to HTTP context', () => {
      factory('id', mockExecutionContext);

      expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
    });

    it('should get request from HTTP context', () => {
      factory('id', mockExecutionContext);

      expect(mockExecutionContext.switchToHttp().getRequest).toHaveBeenCalled();
    });
  });
});
