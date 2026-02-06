import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrganizationsAdminService, OrgFiltersDto, UpdateOrgAdminDto } from './organizations-admin.service';
import { DatabaseService } from '../../database/database.service';

describe('OrganizationsAdminService', () => {
  let service: OrganizationsAdminService;
  let mockDb: any;

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
    subscriptionTier: 'pro',
    subscriptionStatus: 'active',
    screenQuota: 50,
    country: 'US',
    billingEmail: 'billing@test.com',
    trialEndsAt: null,
    settings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: {
      users: 5,
      displays: 10,
      content: 100,
      playlists: 20,
      schedules: 15,
      apiKeys: 3,
      billingTransactions: 12,
    },
  };

  beforeEach(() => {
    mockDb = {
      organization: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        count: jest.fn(),
      },
      display: {
        count: jest.fn(),
      },
      content: {
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      playlist: {
        count: jest.fn(),
      },
      auditLog: {
        findFirst: jest.fn(),
      },
    };

    service = new OrganizationsAdminService(mockDb as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated organizations', async () => {
      mockDb.organization.findMany.mockResolvedValue([mockOrganization]);
      mockDb.organization.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply search filter', async () => {
      mockDb.organization.findMany.mockResolvedValue([]);
      mockDb.organization.count.mockResolvedValue(0);

      const filters: OrgFiltersDto = { search: 'test' };
      await service.findAll(filters);

      expect(mockDb.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'test', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should apply status filter', async () => {
      mockDb.organization.findMany.mockResolvedValue([]);
      mockDb.organization.count.mockResolvedValue(0);

      const filters: OrgFiltersDto = { status: 'active' };
      await service.findAll(filters);

      expect(mockDb.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscriptionStatus: 'active',
          }),
        }),
      );
    });

    it('should apply pagination', async () => {
      mockDb.organization.findMany.mockResolvedValue([]);
      mockDb.organization.count.mockResolvedValue(0);

      const filters: OrgFiltersDto = { skip: 10, take: 5 };
      await service.findAll(filters);

      expect(mockDb.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return organization by id', async () => {
      mockDb.organization.findUnique.mockResolvedValue(mockOrganization);

      const result = await service.findOne('org-123');

      expect(result).toEqual(mockOrganization);
    });

    it('should throw NotFoundException if not found', async () => {
      mockDb.organization.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update organization', async () => {
      mockDb.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDb.organization.update.mockResolvedValue({ ...mockOrganization, name: 'Updated' });

      const dto: UpdateOrgAdminDto = { name: 'Updated' };
      const result = await service.update('org-123', dto);

      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException if not found', async () => {
      mockDb.organization.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('extendTrial', () => {
    it('should extend trial by specified days', async () => {
      const orgWithTrial = { ...mockOrganization, trialEndsAt: new Date() };
      mockDb.organization.findUnique.mockResolvedValue(orgWithTrial);
      mockDb.organization.update.mockResolvedValue({ ...orgWithTrial, subscriptionStatus: 'trial' });

      const result = await service.extendTrial('org-123', 14);

      expect(mockDb.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'trial',
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for non-positive days', async () => {
      await expect(service.extendTrial('org-123', 0)).rejects.toThrow(BadRequestException);
      await expect(service.extendTrial('org-123', -5)).rejects.toThrow(BadRequestException);
    });
  });

  describe('suspend', () => {
    it('should suspend an organization', async () => {
      mockDb.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDb.organization.update.mockResolvedValue({ ...mockOrganization, subscriptionStatus: 'suspended' });

      const result = await service.suspend('org-123', 'Payment failed');

      expect(mockDb.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'suspended',
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('should throw if already suspended', async () => {
      mockDb.organization.findUnique.mockResolvedValue({ ...mockOrganization, subscriptionStatus: 'suspended' });

      await expect(service.suspend('org-123', 'Reason')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unsuspend', () => {
    it('should unsuspend an organization', async () => {
      const suspendedOrg = {
        ...mockOrganization,
        subscriptionStatus: 'suspended',
        settings: { previousStatus: 'active' },
      };
      mockDb.organization.findUnique.mockResolvedValue(suspendedOrg);
      mockDb.organization.update.mockResolvedValue({ ...suspendedOrg, subscriptionStatus: 'active' });

      const result = await service.unsuspend('org-123');

      expect(result).toBeDefined();
    });

    it('should throw if not suspended', async () => {
      mockDb.organization.findUnique.mockResolvedValue(mockOrganization);

      await expect(service.unsuspend('org-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete organization', async () => {
      mockDb.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDb.organization.delete.mockResolvedValue(mockOrganization);

      const result = await service.delete('org-123');

      expect(result.deleted).toBe(true);
      expect(result.organizationId).toBe('org-123');
    });

    it('should throw NotFoundException if not found', async () => {
      mockDb.organization.findUnique.mockResolvedValue(null);

      await expect(service.delete('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return organization statistics', async () => {
      mockDb.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDb.user.count.mockResolvedValue(5);
      mockDb.display.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
      mockDb.content.count.mockResolvedValue(100);
      mockDb.playlist.count.mockResolvedValue(20);
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 1024000 } });
      mockDb.auditLog.findFirst.mockResolvedValue({ createdAt: new Date() });

      const result = await service.getStats('org-123');

      expect(result.userCount).toBe(5);
      expect(result.displayCount).toBe(10);
      expect(result.contentCount).toBe(100);
      expect(result.playlistCount).toBe(20);
      expect(result.onlineDisplays).toBe(8);
      expect(result.totalStorageBytes).toBe(1024000);
    });
  });

  describe('addNote', () => {
    it('should add admin note to organization', async () => {
      mockDb.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDb.organization.update.mockResolvedValue({
        ...mockOrganization,
        settings: { adminNotes: [{ note: 'Test note' }] },
      });

      const result = await service.addNote('org-123', 'Test note', 'admin-user-id');

      expect(result.note.note).toBe('Test note');
      expect(result.note.addedBy).toBe('admin-user-id');
    });
  });
});
