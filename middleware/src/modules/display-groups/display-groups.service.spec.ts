import { NotFoundException } from '@nestjs/common';
import { DisplayGroupsService } from './display-groups.service';
import { DatabaseService } from '../database/database.service';

describe('DisplayGroupsService', () => {
  let service: DisplayGroupsService;
  let mockDatabaseService: any;

  const mockDisplayGroup = {
    id: 'group-123',
    organizationId: 'org-123',
    name: 'Store Displays',
    description: 'All retail store displays',
    createdAt: new Date(),
    updatedAt: new Date(),
    displays: [],
  };

  const mockDisplayGroupMember = {
    id: 'member-123',
    displayGroupId: 'group-123',
    displayId: 'display-123',
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockDatabaseService = {
      displayGroup: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      displayGroupMember: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    service = new DisplayGroupsService(mockDatabaseService as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Group',
      description: 'New group description',
    };

    it('should create a display group', async () => {
      mockDatabaseService.displayGroup.create.mockResolvedValue({
        ...mockDisplayGroup,
        ...createDto,
      });

      const result = await service.create('org-123', createDto);

      expect(result).toBeDefined();
      expect(mockDatabaseService.displayGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-123',
            name: createDto.name,
            description: createDto.description,
          }),
          include: expect.objectContaining({
            displays: expect.objectContaining({
              include: { display: true },
            }),
          }),
        }),
      );
    });

    it('should create a display group without description', async () => {
      const dtoWithoutDesc = { name: 'Lobby Screens' };
      mockDatabaseService.displayGroup.create.mockResolvedValue({
        ...mockDisplayGroup,
        ...dtoWithoutDesc,
        description: undefined,
      });

      const result = await service.create('org-123', dtoWithoutDesc);

      expect(result).toBeDefined();
      expect(result.name).toBe('Lobby Screens');
    });
  });

  describe('findAll', () => {
    it('should return paginated display groups', async () => {
      mockDatabaseService.displayGroup.findMany.mockResolvedValue([mockDisplayGroup]);
      mockDatabaseService.displayGroup.count.mockResolvedValue(1);

      const result = await service.findAll('org-123', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should enforce organization isolation', async () => {
      mockDatabaseService.displayGroup.findMany.mockResolvedValue([]);
      mockDatabaseService.displayGroup.count.mockResolvedValue(0);

      await service.findAll('org-123', { page: 1, limit: 10 });

      expect(mockDatabaseService.displayGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-123' },
        }),
      );
    });

    it('should handle empty results', async () => {
      mockDatabaseService.displayGroup.findMany.mockResolvedValue([]);
      mockDatabaseService.displayGroup.count.mockResolvedValue(0);

      const result = await service.findAll('org-123', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should calculate correct pagination offset', async () => {
      mockDatabaseService.displayGroup.findMany.mockResolvedValue([]);
      mockDatabaseService.displayGroup.count.mockResolvedValue(0);

      await service.findAll('org-123', { page: 3, limit: 5 });

      expect(mockDatabaseService.displayGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });

    it('should include display member counts', async () => {
      mockDatabaseService.displayGroup.findMany.mockResolvedValue([
        { ...mockDisplayGroup, _count: { displays: 3 } },
      ]);
      mockDatabaseService.displayGroup.count.mockResolvedValue(1);

      const result = await service.findAll('org-123', { page: 1, limit: 10 });

      expect(result.data[0]._count.displays).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return a display group by id', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(mockDisplayGroup);

      const result = await service.findOne('org-123', 'group-123');

      expect(result).toEqual(mockDisplayGroup);
    });

    it('should throw NotFoundException if display group not found', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(null);

      await expect(service.findOne('org-123', 'invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should include display members with display details', async () => {
      const groupWithMembers = {
        ...mockDisplayGroup,
        displays: [
          {
            id: 'member-1',
            displayId: 'display-1',
            display: { id: 'display-1', name: 'Lobby Screen' },
          },
        ],
      };
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(groupWithMembers);

      const result = await service.findOne('org-123', 'group-123');

      expect(result.displays).toHaveLength(1);
      expect(result.displays[0].display.name).toBe('Lobby Screen');
    });

    it('should enforce organization isolation in findOne', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(null);

      await expect(service.findOne('org-different', 'group-123')).rejects.toThrow(NotFoundException);

      expect(mockDatabaseService.displayGroup.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'group-123',
            organizationId: 'org-different',
          }),
        }),
      );
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Group' };

    it('should update a display group', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(mockDisplayGroup);
      mockDatabaseService.displayGroup.update.mockResolvedValue({
        ...mockDisplayGroup,
        ...updateDto,
      });

      const result = await service.update('org-123', 'group-123', updateDto);

      expect(result.name).toBe('Updated Group');
    });

    it('should throw NotFoundException if display group not found', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(null);

      await expect(service.update('org-123', 'invalid-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update description only', async () => {
      const descDto = { description: 'Updated description' };
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(mockDisplayGroup);
      mockDatabaseService.displayGroup.update.mockResolvedValue({
        ...mockDisplayGroup,
        ...descDto,
      });

      const result = await service.update('org-123', 'group-123', descDto);

      expect(result.description).toBe('Updated description');
    });

    it('should enforce organization isolation in update', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.update('org-different', 'group-123', { name: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockDatabaseService.displayGroup.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a display group', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(mockDisplayGroup);
      mockDatabaseService.displayGroup.delete.mockResolvedValue(mockDisplayGroup);

      const result = await service.remove('org-123', 'group-123');

      expect(result).toEqual(mockDisplayGroup);
    });

    it('should throw NotFoundException if display group not found', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(null);

      await expect(service.remove('org-123', 'invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should enforce organization isolation in remove', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(null);

      await expect(service.remove('org-different', 'group-123')).rejects.toThrow(NotFoundException);

      expect(mockDatabaseService.displayGroup.delete).not.toHaveBeenCalled();
    });
  });

  describe('addDisplays', () => {
    const manageDto = { displayIds: ['display-1', 'display-2'] };

    it('should add displays to a group', async () => {
      const groupWithDisplays = {
        ...mockDisplayGroup,
        displays: [
          { id: 'member-1', displayId: 'display-1', display: { id: 'display-1' } },
          { id: 'member-2', displayId: 'display-2', display: { id: 'display-2' } },
        ],
      };

      mockDatabaseService.displayGroup.findFirst
        .mockResolvedValueOnce(mockDisplayGroup) // First call in addDisplays -> findOne
        .mockResolvedValueOnce(groupWithDisplays); // Second call in addDisplays -> return findOne
      mockDatabaseService.displayGroupMember.createMany.mockResolvedValue({ count: 2 });

      const result = await service.addDisplays('org-123', 'group-123', manageDto);

      expect(result.displays).toHaveLength(2);
      expect(mockDatabaseService.displayGroupMember.createMany).toHaveBeenCalledWith({
        data: [
          { displayGroupId: 'group-123', displayId: 'display-1' },
          { displayGroupId: 'group-123', displayId: 'display-2' },
        ],
        skipDuplicates: true,
      });
    });

    it('should throw NotFoundException if group not found', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.addDisplays('org-123', 'invalid-id', manageDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip duplicate display assignments', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(mockDisplayGroup);
      mockDatabaseService.displayGroupMember.createMany.mockResolvedValue({ count: 1 });

      await service.addDisplays('org-123', 'group-123', { displayIds: ['display-1'] });

      expect(mockDatabaseService.displayGroupMember.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
        }),
      );
    });

    it('should handle adding a single display', async () => {
      const singleDto = { displayIds: ['display-1'] };
      const groupWithDisplay = {
        ...{
          id: 'group-123',
          organizationId: 'org-123',
          name: 'Store Displays',
          description: 'All retail store displays',
          createdAt: new Date(),
          updatedAt: new Date(),
          displays: [],
        },
        displays: [
          { id: 'member-1', displayId: 'display-1', display: { id: 'display-1' } },
        ],
      };

      mockDatabaseService.displayGroup.findFirst
        .mockResolvedValueOnce({
          id: 'group-123',
          organizationId: 'org-123',
          name: 'Store Displays',
          description: 'All retail store displays',
          createdAt: new Date(),
          updatedAt: new Date(),
          displays: [],
        })
        .mockResolvedValueOnce(groupWithDisplay);
      mockDatabaseService.displayGroupMember.createMany.mockResolvedValue({ count: 1 });

      const result = await service.addDisplays('org-123', 'group-123', singleDto);

      expect(result.displays).toHaveLength(1);
      expect(mockDatabaseService.displayGroupMember.createMany).toHaveBeenCalledWith({
        data: [{ displayGroupId: 'group-123', displayId: 'display-1' }],
        skipDuplicates: true,
      });
    });
  });

  describe('removeDisplays', () => {
    const manageDto = { displayIds: ['display-1'] };

    it('should remove displays from a group', async () => {
      const groupAfterRemoval = { ...mockDisplayGroup, displays: [] };

      mockDatabaseService.displayGroup.findFirst
        .mockResolvedValueOnce(mockDisplayGroup) // First call in removeDisplays -> findOne
        .mockResolvedValueOnce(groupAfterRemoval); // Second call in removeDisplays -> return findOne
      mockDatabaseService.displayGroupMember.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeDisplays('org-123', 'group-123', manageDto);

      expect(result.displays).toHaveLength(0);
      expect(mockDatabaseService.displayGroupMember.deleteMany).toHaveBeenCalledWith({
        where: {
          displayGroupId: 'group-123',
          displayId: { in: ['display-1'] },
        },
      });
    });

    it('should throw NotFoundException if group not found', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.removeDisplays('org-123', 'invalid-id', manageDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should remove multiple displays at once', async () => {
      const multiDto = { displayIds: ['display-1', 'display-2', 'display-3'] };
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(mockDisplayGroup);
      mockDatabaseService.displayGroupMember.deleteMany.mockResolvedValue({ count: 3 });

      await service.removeDisplays('org-123', 'group-123', multiDto);

      expect(mockDatabaseService.displayGroupMember.deleteMany).toHaveBeenCalledWith({
        where: {
          displayGroupId: 'group-123',
          displayId: { in: ['display-1', 'display-2', 'display-3'] },
        },
      });
    });

    it('should enforce organization isolation in removeDisplays', async () => {
      mockDatabaseService.displayGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.removeDisplays('org-different', 'group-123', { displayIds: ['display-1'] }),
      ).rejects.toThrow(NotFoundException);

      expect(mockDatabaseService.displayGroupMember.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('findAll edge cases', () => {
    it('should use default pagination when page/limit not specified', async () => {
      mockDatabaseService.displayGroup.findMany.mockResolvedValue([]);
      mockDatabaseService.displayGroup.count.mockResolvedValue(0);

      await service.findAll('org-123', {});

      expect(mockDatabaseService.displayGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      mockDatabaseService.displayGroup.findMany.mockResolvedValue([]);
      mockDatabaseService.displayGroup.count.mockResolvedValue(25);

      const result = await service.findAll('org-123', { page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });
  });
});
