import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockAuditLogService = {
      findAll: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [{ provide: AuditLogService, useValue: mockAuditLogService }],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    const pagination = { page: 1, limit: 10 };

    it('should return paginated audit logs without filters', async () => {
      const expectedResult = {
        data: [{ id: 'log-1', action: 'user_invited' }],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, { ...pagination });

      expect(result).toEqual(expectedResult);
      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(organizationId, pagination, {});
    });

    it('should pass action filter', async () => {
      const expectedResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult as any);

      await controller.findAll(organizationId, { ...pagination, action: 'user_invited' });

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        expect.objectContaining({ action: 'user_invited' }),
      );
    });

    it('should pass entityType filter', async () => {
      const expectedResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult as any);

      await controller.findAll(organizationId, { ...pagination, entityType: 'user' });

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        expect.objectContaining({ entityType: 'user' }),
      );
    });

    it('should pass userId filter', async () => {
      const expectedResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult as any);

      await controller.findAll(organizationId, { ...pagination, userId: 'user-1' });

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('should pass date range filters', async () => {
      const expectedResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult as any);

      await controller.findAll(organizationId, {
        ...pagination,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        expect.objectContaining({ startDate: '2026-01-01', endDate: '2026-01-31' }),
      );
    });

    it('should pass all filters together', async () => {
      const expectedResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult as any);

      await controller.findAll(organizationId, {
        ...pagination,
        action: 'user_updated',
        entityType: 'user',
        userId: 'user-1',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        {
          action: 'user_updated',
          entityType: 'user',
          userId: 'user-1',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
      );
    });

    // REGRESSION PIN. Every audit-log filter used to be declared as a bare
    // `@Query('action')` parameter beside `@Query() pagination: PaginationDto`.
    // Because the global ValidationPipe runs with whitelist + forbidNonWhitelisted,
    // PaginationDto validated the WHOLE query object and any filter key was an
    // unknown property, so `?startDate=2026-10-10` returned
    // 400 ["property startDate should not exist"] -- every filter was dead.
    // The fix is that the filters are DECLARED on AuditLogQueryDto. This test is
    // typed as that DTO, so dropping a field from it breaks compilation here, and
    // it asserts each declared filter is forwarded rather than silently discarded.
    it('forwards every filter declared on AuditLogQueryDto to the service instead of dropping it', async () => {
      mockAuditLogService.findAll.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 50, total: 0, totalPages: 0 },
      } as any);

      const query: AuditLogQueryDto = {
        page: 2,
        limit: 50,
        action: 'content_deleted',
        entityType: 'content',
        userId: 'user-9',
        startDate: '2026-10-01',
        endDate: '2026-10-10',
      };

      await controller.findAll(organizationId, query);

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        organizationId,
        { page: 2, limit: 50 },
        {
          action: 'content_deleted',
          entityType: 'content',
          userId: 'user-9',
          startDate: '2026-10-01',
          endDate: '2026-10-10',
        },
      );

      // Not just "shape matches": prove nothing was dropped on the way through.
      const filters = mockAuditLogService.findAll.mock.calls[0][2] as Record<string, unknown>;
      for (const key of ['action', 'entityType', 'userId', 'startDate', 'endDate'] as const) {
        expect(filters[key]).toBe(query[key]);
      }
    });
  });
});
