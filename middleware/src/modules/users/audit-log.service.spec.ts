import { AuditLogService } from './audit-log.service';
import { DatabaseService } from '../database/database.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let db: any;

  const organizationId = 'org-123';

  const mockAuditLog = {
    id: 'log-1',
    action: 'user_invited',
    entityType: 'user',
    entityId: 'user-1',
    changes: { email: 'test@test.com', role: 'viewer' },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date('2026-01-15'),
    userId: 'admin-1',
    organizationId,
    user: {
      id: 'admin-1',
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
    },
  };

  beforeEach(() => {
    db = {
      auditLog: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new AuditLogService(db as unknown as DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated audit logs without filters', async () => {
      db.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      db.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll(organizationId, { page: 1, limit: 10 }, {});

      expect(result.data).toEqual([mockAuditLog]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId },
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should filter by action', async () => {
      db.auditLog.findMany.mockResolvedValue([]);
      db.auditLog.count.mockResolvedValue(0);

      await service.findAll(organizationId, { page: 1, limit: 10 }, { action: 'user_invited' });

      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId, action: 'user_invited' },
        }),
      );
    });

    it('should filter by entityType', async () => {
      db.auditLog.findMany.mockResolvedValue([]);
      db.auditLog.count.mockResolvedValue(0);

      await service.findAll(organizationId, { page: 1, limit: 10 }, { entityType: 'user' });

      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId, entityType: 'user' },
        }),
      );
    });

    it('should filter by userId', async () => {
      db.auditLog.findMany.mockResolvedValue([]);
      db.auditLog.count.mockResolvedValue(0);

      await service.findAll(organizationId, { page: 1, limit: 10 }, { userId: 'user-1' });

      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId, userId: 'user-1' },
        }),
      );
    });

    it('should filter by date range', async () => {
      db.auditLog.findMany.mockResolvedValue([]);
      db.auditLog.count.mockResolvedValue(0);

      await service.findAll(organizationId, { page: 1, limit: 10 }, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId,
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          },
        }),
      );
    });

    it('should filter by startDate only', async () => {
      db.auditLog.findMany.mockResolvedValue([]);
      db.auditLog.count.mockResolvedValue(0);

      await service.findAll(organizationId, { page: 1, limit: 10 }, { startDate: '2026-01-01' });

      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId,
            createdAt: {
              gte: new Date('2026-01-01'),
            },
          },
        }),
      );
    });

    it('should include user relation in results', async () => {
      db.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      db.auditLog.count.mockResolvedValue(1);

      await service.findAll(organizationId, { page: 1, limit: 10 }, {});

      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
      );
    });

    it('should handle pagination offset correctly', async () => {
      db.auditLog.findMany.mockResolvedValue([]);
      db.auditLog.count.mockResolvedValue(25);

      const result = await service.findAll(organizationId, { page: 3, limit: 5 }, {});

      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
      expect(result.meta.totalPages).toBe(5);
    });
  });
});
