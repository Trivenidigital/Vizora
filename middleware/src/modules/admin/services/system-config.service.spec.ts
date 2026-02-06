import { NotFoundException } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { DatabaseService } from '../../database/database.service';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let mockDb: any;

  const mockConfig = {
    id: 'config-123',
    key: 'app.maintenance_mode',
    value: false,
    dataType: 'boolean',
    category: 'general',
    description: 'Enable maintenance mode',
    isSecret: false,
    updatedAt: new Date(),
    updatedBy: 'admin-123',
  };

  beforeEach(() => {
    mockDb = {
      systemConfig: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new SystemConfigService(mockDb as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all configurations sorted by category and key', async () => {
      const configs = [mockConfig, { ...mockConfig, key: 'app.debug', category: 'general' }];
      mockDb.systemConfig.findMany.mockResolvedValue(configs);

      const result = await service.findAll();

      expect(result).toEqual(configs);
      expect(mockDb.systemConfig.findMany).toHaveBeenCalledWith({
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      });
    });
  });

  describe('findByCategory', () => {
    it('should return configs for a specific category', async () => {
      mockDb.systemConfig.findMany.mockResolvedValue([mockConfig]);

      const result = await service.findByCategory('general');

      expect(result).toHaveLength(1);
      expect(mockDb.systemConfig.findMany).toHaveBeenCalledWith({
        where: { category: 'general' },
        orderBy: { key: 'asc' },
      });
    });
  });

  describe('get', () => {
    it('should return parsed boolean value', async () => {
      mockDb.systemConfig.findUnique.mockResolvedValue({
        ...mockConfig,
        value: true,
        dataType: 'boolean',
      });

      const result = await service.get('app.maintenance_mode');

      expect(result).toBe(true);
    });

    it('should return parsed number value', async () => {
      mockDb.systemConfig.findUnique.mockResolvedValue({
        ...mockConfig,
        key: 'app.max_upload_size',
        value: 104857600,
        dataType: 'number',
      });

      const result = await service.get('app.max_upload_size');

      expect(result).toBe(104857600);
    });

    it('should return null for non-existent key', async () => {
      mockDb.systemConfig.findUnique.mockResolvedValue(null);

      const result = await service.get('non.existent');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should create or update a configuration', async () => {
      mockDb.systemConfig.upsert.mockResolvedValue({
        ...mockConfig,
        value: true,
      });

      const result = await service.set('app.maintenance_mode', true, 'admin-123');

      expect(result.value).toBe(true);
      expect(mockDb.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'app.maintenance_mode' },
        create: expect.objectContaining({
          key: 'app.maintenance_mode',
          value: true,
          dataType: 'boolean',
          updatedBy: 'admin-123',
        }),
        update: expect.objectContaining({
          value: true,
          dataType: 'boolean',
          updatedBy: 'admin-123',
        }),
      });
    });

    it('should infer data type from value', async () => {
      mockDb.systemConfig.upsert.mockResolvedValue(mockConfig);

      await service.set('app.count', 42, 'admin-123');

      expect(mockDb.systemConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ dataType: 'number' }),
        })
      );
    });

    it('should accept explicit data type override', async () => {
      mockDb.systemConfig.upsert.mockResolvedValue(mockConfig);

      await service.set('app.data', '{"foo":"bar"}', 'admin-123', { dataType: 'json' });

      expect(mockDb.systemConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ dataType: 'json' }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete a configuration', async () => {
      mockDb.systemConfig.findUnique.mockResolvedValue(mockConfig);
      mockDb.systemConfig.delete.mockResolvedValue(mockConfig);

      const result = await service.delete('app.maintenance_mode');

      expect(result).toEqual({ deleted: true });
      expect(mockDb.systemConfig.delete).toHaveBeenCalledWith({
        where: { key: 'app.maintenance_mode' },
      });
    });

    it('should throw NotFoundException for non-existent config', async () => {
      mockDb.systemConfig.findUnique.mockResolvedValue(null);

      await expect(service.delete('non.existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple configurations', async () => {
      const configs = [
        { key: 'app.debug', value: true },
        { key: 'app.log_level', value: 'info' },
      ];

      mockDb.$transaction.mockImplementation(async (ops) => Promise.all(ops));
      mockDb.systemConfig.upsert.mockResolvedValue(mockConfig);

      await service.bulkUpdate(configs, 'admin-123');

      expect(mockDb.$transaction).toHaveBeenCalled();
    });
  });

  describe('getPublic', () => {
    it('should return non-secret configs as key-value object', async () => {
      mockDb.systemConfig.findMany.mockResolvedValue([
        { key: 'app.name', value: 'Vizora', dataType: 'string', isSecret: false },
        { key: 'app.version', value: '1.0.0', dataType: 'string', isSecret: false },
      ]);

      const result = await service.getPublic();

      expect(result).toEqual({
        'app.name': 'Vizora',
        'app.version': '1.0.0',
      });
      expect(mockDb.systemConfig.findMany).toHaveBeenCalledWith({
        where: { isSecret: false },
        orderBy: { key: 'asc' },
      });
    });
  });
});
