import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('UsersService', () => {
  let service: UsersService;
  let db: any;

  const organizationId = 'org-123';
  const adminUserId = 'user-admin-1';

  const mockUser = {
    id: 'user-1',
    email: 'alice@test.com',
    firstName: 'Alice',
    lastName: 'Smith',
    role: 'viewer',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    db = {
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    service = new UsersService(db as unknown as DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      db.user.findMany.mockResolvedValue([mockUser]);
      db.user.count.mockResolvedValue(1);

      const result = await service.findAll(organizationId, { page: 1, limit: 10 });

      expect(result.data).toEqual([mockUser]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId },
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should handle pagination offset correctly', async () => {
      db.user.findMany.mockResolvedValue([]);
      db.user.count.mockResolvedValue(0);

      await service.findAll(organizationId, { page: 3, limit: 5 });

      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });

    it('should use default pagination values', async () => {
      db.user.findMany.mockResolvedValue([]);
      db.user.count.mockResolvedValue(0);

      await service.findAll(organizationId, {});

      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      db.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findOne(organizationId, 'user-1');

      expect(result).toEqual(mockUser);
      expect(db.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1', organizationId },
        }),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne(organizationId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('invite', () => {
    const inviteDto = {
      email: 'new@test.com',
      firstName: 'New',
      lastName: 'User',
      role: 'viewer',
    };

    it('should create a user with hashed password', async () => {
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ id: 'user-new', ...inviteDto });
      db.auditLog.create.mockResolvedValue({});

      const result = await service.invite(organizationId, inviteDto as any, adminUserId);

      expect(result.user).toBeDefined();
      expect(result.tempPassword).toBeDefined();
      expect(result.tempPassword.length).toBe(16);
      expect(db.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@test.com',
            passwordHash: 'hashed-password',
            organizationId,
          }),
        }),
      );
    });

    it('should throw ConflictException for duplicate email', async () => {
      db.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.invite(organizationId, inviteDto as any, adminUserId)).rejects.toThrow(ConflictException);
    });

    it('should log audit event after invite', async () => {
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ id: 'user-new', email: 'new@test.com', role: 'viewer' });
      db.auditLog.create.mockResolvedValue({});

      await service.invite(organizationId, inviteDto as any, adminUserId);

      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId,
            userId: adminUserId,
            action: 'user_invited',
            entityType: 'user',
            entityId: 'user-new',
          }),
        }),
      );
    });
  });

  describe('update', () => {
    const updateDto = { firstName: 'Updated' };

    it('should update a user', async () => {
      db.user.findFirst.mockResolvedValue(mockUser);
      db.user.update.mockResolvedValue({ ...mockUser, firstName: 'Updated' });
      db.auditLog.create.mockResolvedValue({});

      const result = await service.update(organizationId, 'user-1', updateDto as any, adminUserId);

      expect(result.firstName).toBe('Updated');
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: updateDto,
        }),
      );
    });

    it('should prevent self-demotion', async () => {
      db.user.findFirst.mockResolvedValue({ ...mockUser, id: adminUserId, role: 'admin' });

      await expect(
        service.update(organizationId, adminUserId, { role: 'viewer' } as any, adminUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent self-deactivation', async () => {
      db.user.findFirst.mockResolvedValue({ ...mockUser, id: adminUserId });

      await expect(
        service.update(organizationId, adminUserId, { isActive: false } as any, adminUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should log audit event after update', async () => {
      db.user.findFirst.mockResolvedValue(mockUser);
      db.user.update.mockResolvedValue({ ...mockUser, firstName: 'Updated' });
      db.auditLog.create.mockResolvedValue({});

      await service.update(organizationId, 'user-1', updateDto as any, adminUserId);

      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId,
            userId: adminUserId,
            action: 'user_updated',
            entityType: 'user',
            entityId: 'user-1',
          }),
        }),
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate a user', async () => {
      db.user.findFirst.mockResolvedValue(mockUser);
      db.user.update.mockResolvedValue({ ...mockUser, isActive: false });
      db.auditLog.create.mockResolvedValue({});

      const result = await service.deactivate(organizationId, 'user-1', adminUserId);

      expect(result.isActive).toBe(false);
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { isActive: false },
        }),
      );
    });

    it('should prevent self-deactivation', async () => {
      await expect(
        service.deactivate(organizationId, adminUserId, adminUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should log audit event after deactivation', async () => {
      db.user.findFirst.mockResolvedValue(mockUser);
      db.user.update.mockResolvedValue({ ...mockUser, isActive: false });
      db.auditLog.create.mockResolvedValue({});

      await service.deactivate(organizationId, 'user-1', adminUserId);

      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId,
            userId: adminUserId,
            action: 'user_deactivated',
            entityType: 'user',
            entityId: 'user-1',
            changes: { isActive: false },
          }),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent user', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivate(organizationId, 'nonexistent', adminUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
