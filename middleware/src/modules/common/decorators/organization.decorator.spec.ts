import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentOrganization, CurrentUser } from './organization.decorator';

// Helper to get decorator factory
function getParamDecoratorFactory(decorator: Function) {
  class Test {
    public test(@decorator() value: any) {}
  }

  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('Organization Decorators', () => {
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        role: 'admin',
      },
      organization: {
        id: 'org-123',
        name: 'Test Organization',
        slug: 'test-org',
      },
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;
  });

  describe('CurrentOrganization', () => {
    let factory: Function;

    beforeEach(() => {
      factory = getParamDecoratorFactory(CurrentOrganization);
    });

    it('should return organization from request', () => {
      const result = factory(undefined, mockExecutionContext);

      expect(result).toEqual(mockRequest.organization);
    });

    it('should return undefined when organization is not present', () => {
      mockRequest.organization = undefined;

      const result = factory(undefined, mockExecutionContext);

      expect(result).toBeUndefined();
    });

    it('should return null when organization is null', () => {
      mockRequest.organization = null;

      const result = factory(undefined, mockExecutionContext);

      expect(result).toBeNull();
    });

    it('should switch to HTTP context', () => {
      factory(undefined, mockExecutionContext);

      expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
    });

    it('should get request from HTTP context', () => {
      factory(undefined, mockExecutionContext);

      expect(mockExecutionContext.switchToHttp().getRequest).toHaveBeenCalled();
    });
  });

  describe('CurrentUser (from organization.decorator)', () => {
    let factory: Function;

    beforeEach(() => {
      factory = getParamDecoratorFactory(CurrentUser);
    });

    it('should return user from request', () => {
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

    it('should switch to HTTP context', () => {
      factory(undefined, mockExecutionContext);

      expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
    });
  });
});
