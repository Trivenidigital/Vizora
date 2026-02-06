import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QuotaGuard } from './quota.guard';
import { DatabaseService } from '../../database/database.service';
import { QUOTA_KEY } from '../decorators/check-quota.decorator';

describe('QuotaGuard', () => {
  let guard: QuotaGuard;
  let mockReflector: jest.Mocked<Reflector>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    mockDatabaseService = {
      organization: {
        findUnique: jest.fn(),
      },
    } as any;

    mockRequest = {
      user: {
        id: 'user-123',
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

    guard = new QuotaGuard(mockReflector, mockDatabaseService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    describe('when no quota check is required', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue(undefined);
      });

      it('should allow access', async () => {
        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
        expect(mockDatabaseService.organization.findUnique).not.toHaveBeenCalled();
      });

      it('should not query database', async () => {
        await guard.canActivate(mockExecutionContext);

        expect(mockDatabaseService.organization.findUnique).not.toHaveBeenCalled();
      });
    });

    describe('when screen quota check is required', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue('screen');
      });

      it('should allow when under quota', async () => {
        mockDatabaseService.organization.findUnique.mockResolvedValue({
          screenQuota: 25,
          _count: { displays: 12 },
        } as any);

        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
      });

      it('should allow when quota is unlimited (-1)', async () => {
        mockDatabaseService.organization.findUnique.mockResolvedValue({
          screenQuota: -1,
          _count: { displays: 1000 },
        } as any);

        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
      });

      it('should deny when at quota', async () => {
        mockDatabaseService.organization.findUnique.mockResolvedValue({
          screenQuota: 5,
          _count: { displays: 5 },
        } as any);

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
          'Screen quota exceeded. You have 5/5 screens. Please upgrade your plan to add more screens.',
        );
      });

      it('should deny when over quota', async () => {
        mockDatabaseService.organization.findUnique.mockResolvedValue({
          screenQuota: 5,
          _count: { displays: 7 },
        } as any);

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
          'Screen quota exceeded. You have 7/5 screens. Please upgrade your plan to add more screens.',
        );
      });

      it('should allow when exactly one under quota', async () => {
        mockDatabaseService.organization.findUnique.mockResolvedValue({
          screenQuota: 5,
          _count: { displays: 4 },
        } as any);

        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
      });
    });

    describe('when organization not found', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue('screen');
      });

      it('should throw ForbiddenException when no organizationId in request', async () => {
        mockRequest.user = { id: 'user-123' }; // No organizationId

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Organization not found');
      });

      it('should throw ForbiddenException when user is undefined', async () => {
        mockRequest.user = undefined;

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Organization not found');
      });

      it('should throw ForbiddenException when org not found in database', async () => {
        mockDatabaseService.organization.findUnique.mockResolvedValue(null);

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Organization not found');
      });
    });

    describe('database query', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue('screen');
      });

      it('should query organization with correct ID and fields', async () => {
        mockDatabaseService.organization.findUnique.mockResolvedValue({
          screenQuota: 25,
          _count: { displays: 12 },
        } as any);

        await guard.canActivate(mockExecutionContext);

        expect(mockDatabaseService.organization.findUnique).toHaveBeenCalledWith({
          where: { id: 'org-123' },
          select: {
            screenQuota: true,
            _count: {
              select: { displays: true },
            },
          },
        });
      });
    });

    describe('reflector integration', () => {
      it('should call getAllAndOverride with quota key', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(undefined);

        await guard.canActivate(mockExecutionContext);

        expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(QUOTA_KEY, expect.any(Array));
      });

      it('should pass handler and class to reflector', async () => {
        const mockHandler = jest.fn();
        const mockClass = class MockController {};

        mockExecutionContext.getHandler.mockReturnValue(mockHandler);
        mockExecutionContext.getClass.mockReturnValue(mockClass);
        mockReflector.getAllAndOverride.mockReturnValue(undefined);

        await guard.canActivate(mockExecutionContext);

        expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(QUOTA_KEY, [
          mockHandler,
          mockClass,
        ]);
      });
    });

    describe('edge cases', () => {
      beforeEach(() => {
        mockReflector.getAllAndOverride.mockReturnValue('screen');
      });

      it('should handle zero quota', async () => {
        mockDatabaseService.organization.findUnique.mockResolvedValue({
          screenQuota: 0,
          _count: { displays: 0 },
        } as any);

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
      });

      it('should handle zero displays', async () => {
        mockDatabaseService.organization.findUnique.mockResolvedValue({
          screenQuota: 5,
          _count: { displays: 0 },
        } as any);

        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
      });

      it('should handle switchToHttp errors', async () => {
        mockExecutionContext.switchToHttp.mockImplementation(() => {
          throw new Error('HTTP context error');
        });

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('HTTP context error');
      });

      it('should handle database errors', async () => {
        mockDatabaseService.organization.findUnique.mockRejectedValue(new Error('DB connection failed'));

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('DB connection failed');
      });

      it('should handle null user', async () => {
        mockRequest.user = null;

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
      });
    });

    describe('unknown quota type', () => {
      it('should allow access for unknown quota type', async () => {
        mockReflector.getAllAndOverride.mockReturnValue('unknown_quota');
        mockDatabaseService.organization.findUnique.mockResolvedValue({
          screenQuota: 0,
          _count: { displays: 100 },
        } as any);

        // The guard only checks 'screen' quota type explicitly
        // For unknown types, it should return true after fetching org
        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
      });
    });
  });
});
