import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

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

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        { action: undefined, entityType: undefined, userId: undefined, startDate: undefined, endDate: undefined },
      );
    });

    it('should pass action filter', async () => {
      const expectedResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult as any);

      await controller.findAll(organizationId, pagination as any, 'user_invited');

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        expect.objectContaining({ action: 'user_invited' }),
      );
    });

    it('should pass entityType filter', async () => {
      const expectedResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult as any);

      await controller.findAll(organizationId, pagination as any, undefined, 'user');

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        expect.objectContaining({ entityType: 'user' }),
      );
    });

    it('should pass userId filter', async () => {
      const expectedResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult as any);

      await controller.findAll(organizationId, pagination as any, undefined, undefined, 'user-1');

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('should pass date range filters', async () => {
      const expectedResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult as any);

      await controller.findAll(
        organizationId,
        pagination as any,
        undefined,
        undefined,
        undefined,
        '2026-01-01',
        '2026-01-31',
      );

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        expect.objectContaining({ startDate: '2026-01-01', endDate: '2026-01-31' }),
      );
    });

    it('should pass all filters together', async () => {
      const expectedResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult as any);

      await controller.findAll(
        organizationId,
        pagination as any,
        'user_updated',
        'user',
        'user-1',
        '2026-01-01',
        '2026-01-31',
      );

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
  });
});
