import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersAdminService, UserFiltersDto, UpdateUserAdminDto } from './users-admin.service';
import { DatabaseService } from '../../database/database.service';

describe('UsersAdminService', () => {
  let service: UsersAdminService;
  let mockDb: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'admin',
    isActive: true,
    isSuperAdmin: false,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: {
      id: 'org-123',
      name: 'Test Org',
      slug: 'test-org',
      subscriptionTier: 'pro',
      subscriptionStatus: 'active',
    },
    _count: {
      auditLogs: 50,
      apiKeys: 2,
    },
  };

  beforeEach(() => {
    mockDb = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new UsersAdminService(mockDb as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      mockDb.user.findMany.mockResolvedValue([mockUser]);
      mockDb.user.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply search filter', async () => {
      mockDb.user.findMany.mockResolvedValue([]);
      mockDb.user.count.mockResolvedValue(0);

      const filters: UserFiltersDto = { search: 'john' };
      await service.findAll(filters);

      expect(mockDb.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { email: { contains: 'john', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should filter by organization', async () => {
      mockDb.user.findMany.mockResolvedValue([]);
      mockDb.user.count.mockResolvedValue(0);

      const filters: UserFiltersDto = { organizationId: 'org-123' };
      await service.findAll(filters);

      expect(mockDb.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-123',
          }),
        }),
      );
    });

    it('should filter by super admin status', async () => {
      mockDb.user.findMany.mockResolvedValue([]);
      mockDb.user.count.mockResolvedValue(0);

      const filters: UserFiltersDto = { isSuperAdmin: true };
      await service.findAll(filters);

      expect(mockDb.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isSuperAdmin: true,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      mockDb.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if not found', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      mockDb.user.findUnique.mockResolvedValue(mockUser);
      mockDb.user.update.mockResolvedValue({ ...mockUser, firstName: 'Jane' });

      const dto: UpdateUserAdminDto = { firstName: 'Jane' };
      const result = await service.update('user-123', dto);

      expect(result.firstName).toBe('Jane');
    });

    it('should check email uniqueness', async () => {
      mockDb.user.findUnique.mockResolvedValue(mockUser);
      mockDb.user.findFirst.mockResolvedValue({ id: 'other-user' });

      const dto: UpdateUserAdminDto = { email: 'existing@example.com' };
      await expect(service.update('user-123', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('disable', () => {
    it('should disable user', async () => {
      mockDb.user.findUnique.mockResolvedValue(mockUser);
      mockDb.user.update.mockResolvedValue({ ...mockUser, isActive: false });

      const result = await service.disable('user-123');

      expect(result.isActive).toBe(false);
    });

    it('should throw if already disabled', async () => {
      mockDb.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.disable('user-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('enable', () => {
    it('should enable user', async () => {
      mockDb.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
      mockDb.user.update.mockResolvedValue({ ...mockUser, isActive: true });

      const result = await service.enable('user-123');

      expect(result.isActive).toBe(true);
    });

    it('should throw if already active', async () => {
      mockDb.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.enable('user-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('should reset password and return temporary password', async () => {
      mockDb.user.findUnique.mockResolvedValue(mockUser);
      mockDb.user.update.mockResolvedValue(mockUser);

      const result = await service.resetPassword('user-123');

      expect(result.temporaryPassword).toBeDefined();
      expect(result.temporaryPassword.length).toBe(16);
    });
  });

  describe('grantSuperAdmin', () => {
    it('should grant super admin privileges', async () => {
      mockDb.user.findUnique.mockResolvedValue(mockUser);
      mockDb.user.update.mockResolvedValue({ ...mockUser, isSuperAdmin: true });

      const result = await service.grantSuperAdmin('user-123');

      expect(result.isSuperAdmin).toBe(true);
    });

    it('should throw if already super admin', async () => {
      mockDb.user.findUnique.mockResolvedValue({ ...mockUser, isSuperAdmin: true });

      await expect(service.grantSuperAdmin('user-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokeSuperAdmin', () => {
    it('should revoke super admin privileges', async () => {
      mockDb.user.findUnique.mockResolvedValue({ ...mockUser, isSuperAdmin: true });
      mockDb.user.count.mockResolvedValue(2);
      mockDb.user.update.mockResolvedValue({ ...mockUser, isSuperAdmin: false });

      const result = await service.revokeSuperAdmin('user-123');

      expect(result.isSuperAdmin).toBe(false);
    });

    it('should throw if not super admin', async () => {
      mockDb.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.revokeSuperAdmin('user-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw if last super admin', async () => {
      mockDb.user.findUnique.mockResolvedValue({ ...mockUser, isSuperAdmin: true });
      mockDb.user.count.mockResolvedValue(1);

      await expect(service.revokeSuperAdmin('user-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSuperAdmins', () => {
    it('should return all super admins', async () => {
      mockDb.user.findMany.mockResolvedValue([{ ...mockUser, isSuperAdmin: true }]);

      const result = await service.getSuperAdmins();

      expect(result).toHaveLength(1);
      expect(mockDb.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isSuperAdmin: true },
        }),
      );
    });
  });
});
