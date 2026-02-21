import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SuperAdminGuard } from './super-admin.guard';
import { DatabaseService } from '../../database/database.service';

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  const mockExecutionContext = (userId?: string) => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { id: userId } : undefined,
        }),
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    mockDatabaseService = {
      user: {
        findUnique: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperAdminGuard,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    guard = module.get<SuperAdminGuard>(SuperAdminGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should throw ForbiddenException when no user in request', async () => {
      const context = mockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Authentication required');
    });

    it('should throw ForbiddenException when user not found in database', async () => {
      const context = mockExecutionContext('user-123');
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Super admin access required');
    });

    it('should throw ForbiddenException when user is not a super admin', async () => {
      const context = mockExecutionContext('user-123');
      mockDatabaseService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        isSuperAdmin: false,
      } as any);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Super admin access required');
    });

    it('should return true when user is a super admin', async () => {
      const context = mockExecutionContext('user-123');
      mockDatabaseService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        isSuperAdmin: true,
      } as any);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { isSuperAdmin: true },
      });
    });

    it('should query database with correct user ID', async () => {
      const context = mockExecutionContext('specific-user-id');
      mockDatabaseService.user.findUnique.mockResolvedValue({
        id: 'specific-user-id',
        isSuperAdmin: true,
      } as any);

      await guard.canActivate(context);

      expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'specific-user-id' },
        select: { isSuperAdmin: true },
      });
    });

    it('should handle database errors gracefully', async () => {
      const context = mockExecutionContext('user-123');
      mockDatabaseService.user.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(guard.canActivate(context)).rejects.toThrow('Database error');
    });

    it('should handle user object with only isSuperAdmin field selected', async () => {
      const context = mockExecutionContext('user-123');
      // Simulating Prisma select returning only requested fields
      mockDatabaseService.user.findUnique.mockResolvedValue({
        isSuperAdmin: true,
      } as any);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
