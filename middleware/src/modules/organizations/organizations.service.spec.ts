import { NotFoundException, ConflictException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { RedisService } from '../redis/redis.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let mockDatabaseService: any;
  let mockStorageService: any;
  let mockRedisService: any;

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
    subscriptionTier: 'free',
    screenQuota: 5,
    subscriptionStatus: 'active',
    storageUsedBytes: 0,
    storageQuotaBytes: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockDatabaseService = {
      organization: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      content: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockStorageService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
      isMinioAvailable: jest.fn().mockReturnValue(false),
    };

    mockRedisService = {
      del: jest.fn().mockResolvedValue(true),
    };

    service = new OrganizationsService(
      mockDatabaseService as DatabaseService,
      mockStorageService as StorageService,
      mockRedisService as RedisService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Organization',
      slug: 'new-org',
    };

    it('should create an organization', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.create.mockResolvedValue({
        ...mockOrganization,
        ...createDto,
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.slug).toBe('new-org');
    });

    it('should throw ConflictException if slug already exists', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated organizations', async () => {
      mockDatabaseService.organization.findMany.mockResolvedValue([mockOrganization]);
      mockDatabaseService.organization.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should use default pagination', async () => {
      mockDatabaseService.organization.findMany.mockResolvedValue([]);
      mockDatabaseService.organization.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockDatabaseService.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return organization by id', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);

      const result = await service.findOne('org-123');

      expect(result).toEqual(mockOrganization);
    });

    it('should throw NotFoundException if organization not found', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return organization by slug', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);

      const result = await service.findBySlug('test-org');

      expect(result).toEqual(mockOrganization);
    });

    it('should throw NotFoundException if organization not found', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('invalid-slug')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Organization' };

    it('should update organization', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockResolvedValue({
        ...mockOrganization,
        ...updateDto,
      });

      const result = await service.update('org-123', updateDto);

      expect(result.name).toBe('Updated Organization');
    });

    it('should throw NotFoundException if organization not found', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if new slug already exists', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.findFirst.mockResolvedValue({ id: 'other-org' });

      await expect(service.update('org-123', { slug: 'existing-slug' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete organization and clean up storage and cache', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDatabaseService.content.findMany.mockResolvedValue([
        { id: 'c1', url: 'minio://org-123/file.png' },
        { id: 'c2', url: 'https://example.com/file.png' },
      ]);
      mockDatabaseService.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
      ]);
      mockDatabaseService.organization.delete.mockResolvedValue(mockOrganization);

      await service.remove('org-123', 'admin-user');

      // Should delete MinIO files (only minio:// URLs)
      expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(1);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('org-123/file.png');

      // Should clear Redis cache for all users
      expect(mockRedisService.del).toHaveBeenCalledTimes(2);
      expect(mockRedisService.del).toHaveBeenCalledWith('user_auth:user-1');
      expect(mockRedisService.del).toHaveBeenCalledWith('user_auth:user-2');

      // Should delete the organization
      expect(mockDatabaseService.organization.delete).toHaveBeenCalledWith({
        where: { id: 'org-123' },
      });
    });

    it('should continue deletion even if MinIO delete fails', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDatabaseService.content.findMany.mockResolvedValue([
        { id: 'c1', url: 'minio://org-123/file.png' },
      ]);
      mockDatabaseService.user.findMany.mockResolvedValue([]);
      mockDatabaseService.organization.delete.mockResolvedValue(mockOrganization);
      mockStorageService.deleteFile.mockRejectedValue(new Error('MinIO down'));

      await service.remove('org-123', 'admin-user');

      expect(mockDatabaseService.organization.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if organization not found', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});
