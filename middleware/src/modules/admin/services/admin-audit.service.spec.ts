import { AdminAuditService, LogActionParams } from './admin-audit.service';
import { DatabaseService } from '../../database/database.service';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let mockDb: any;

  const mockAuditLog = {
    id: 'audit-123',
    adminUserId: 'admin-123',
    action: 'plan.create',
    targetType: 'plan',
    targetId: 'plan-456',
    details: { name: 'Pro Plan' },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockDb = {
      adminAuditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new AdminAuditService(mockDb as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      mockDb.adminAuditLog.create.mockResolvedValue(mockAuditLog);

      const params: LogActionParams = {
        adminUserId: 'admin-123',
        action: 'plan.create',
        targetType: 'plan',
        targetId: 'plan-456',
        details: { name: 'Pro Plan' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const result = await service.log(params);

      expect(result).toEqual(mockAuditLog);
      expect(mockDb.adminAuditLog.create).toHaveBeenCalledWith({
        data: {
          adminUserId: 'admin-123',
          action: 'plan.create',
          targetType: 'plan',
          targetId: 'plan-456',
          details: { name: 'Pro Plan' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      });
    });

    it('should create log without optional fields', async () => {
      mockDb.adminAuditLog.create.mockResolvedValue({
        ...mockAuditLog,
        targetType: null,
        targetId: null,
        details: null,
      });

      const result = await service.log({
        adminUserId: 'admin-123',
        action: 'system.login',
      });

      expect(result).toBeDefined();
      expect(mockDb.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminUserId: 'admin-123',
          action: 'system.login',
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const logs = [mockAuditLog];
      mockDb.adminAuditLog.findMany.mockResolvedValue(logs);
      mockDb.adminAuditLog.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 50 });

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by adminUserId', async () => {
      mockDb.adminAuditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockDb.adminAuditLog.count.mockResolvedValue(1);

      await service.findAll({ adminUserId: 'admin-123' });

      expect(mockDb.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ adminUserId: 'admin-123' }),
        })
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      mockDb.adminAuditLog.findMany.mockResolvedValue([]);
      mockDb.adminAuditLog.count.mockResolvedValue(0);

      await service.findAll({ startDate, endDate });

      expect(mockDb.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
        })
      );
    });

    it('should filter by action type', async () => {
      mockDb.adminAuditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockDb.adminAuditLog.count.mockResolvedValue(1);

      await service.findAll({ action: 'plan.create' });

      expect(mockDb.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'plan.create' }),
        })
      );
    });
  });

  describe('findByAdmin', () => {
    it('should return logs for a specific admin', async () => {
      mockDb.adminAuditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockDb.adminAuditLog.count.mockResolvedValue(1);

      const result = await service.findByAdmin('admin-123');

      expect(result.data).toHaveLength(1);
      expect(mockDb.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: { adminUserId: 'admin-123' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      });
    });

    it('should support pagination options', async () => {
      mockDb.adminAuditLog.findMany.mockResolvedValue([]);
      mockDb.adminAuditLog.count.mockResolvedValue(100);

      const result = await service.findByAdmin('admin-123', { page: 2, limit: 25 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
      expect(mockDb.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        })
      );
    });
  });

  describe('findByTarget', () => {
    it('should return logs for a specific target entity', async () => {
      mockDb.adminAuditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockDb.adminAuditLog.count.mockResolvedValue(1);

      const result = await service.findByTarget('plan', 'plan-456');

      expect(result.data).toHaveLength(1);
      expect(mockDb.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: { targetType: 'plan', targetId: 'plan-456' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      });
    });
  });
});
