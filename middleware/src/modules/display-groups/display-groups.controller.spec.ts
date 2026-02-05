import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DisplayGroupsController } from './display-groups.controller';
import { DisplayGroupsService } from './display-groups.service';

describe('DisplayGroupsController', () => {
  let controller: DisplayGroupsController;
  let mockDisplayGroupsService: jest.Mocked<DisplayGroupsService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockDisplayGroupsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addDisplays: jest.fn(),
      removeDisplays: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisplayGroupsController],
      providers: [{ provide: DisplayGroupsService, useValue: mockDisplayGroupsService }],
    }).compile();

    controller = module.get<DisplayGroupsController>(DisplayGroupsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'Store Displays',
      description: 'All retail store displays',
    };

    it('should create a display group', async () => {
      const expectedGroup = { id: 'group-123', ...createDto, organizationId };
      mockDisplayGroupsService.create.mockResolvedValue(expectedGroup as any);

      const result = await controller.create(organizationId, createDto as any);

      expect(result).toEqual(expectedGroup);
      expect(mockDisplayGroupsService.create).toHaveBeenCalledWith(organizationId, createDto);
    });

    it('should create a display group without description', async () => {
      const dtoWithoutDesc = { name: 'Lobby Screens' };
      const expectedGroup = { id: 'group-456', ...dtoWithoutDesc, organizationId };
      mockDisplayGroupsService.create.mockResolvedValue(expectedGroup as any);

      const result = await controller.create(organizationId, dtoWithoutDesc as any);

      expect(result).toEqual(expectedGroup);
      expect(mockDisplayGroupsService.create).toHaveBeenCalledWith(organizationId, dtoWithoutDesc);
    });
  });

  describe('findAll', () => {
    const pagination = { page: 1, limit: 10 };

    it('should return all display groups with pagination', async () => {
      const expectedResult = {
        data: [{ id: 'group-1' }, { id: 'group-2' }],
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      };
      mockDisplayGroupsService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
      expect(mockDisplayGroupsService.findAll).toHaveBeenCalledWith(organizationId, pagination);
    });

    it('should handle empty results', async () => {
      const expectedResult = { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } };
      mockDisplayGroupsService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
    });

    it('should pass pagination to service', async () => {
      const pagination = { page: 2, limit: 5 };
      mockDisplayGroupsService.findAll.mockResolvedValue({ data: [], meta: { total: 0, page: 2, limit: 5, totalPages: 0 } } as any);

      await controller.findAll(organizationId, pagination as any);

      expect(mockDisplayGroupsService.findAll).toHaveBeenCalledWith(organizationId, pagination);
    });
  });

  describe('findOne', () => {
    it('should return a display group by id', async () => {
      const expectedGroup = {
        id: 'group-123',
        name: 'Store Displays',
        displays: [{ id: 'member-1', displayId: 'display-1', display: { id: 'display-1' } }],
      };
      mockDisplayGroupsService.findOne.mockResolvedValue(expectedGroup as any);

      const result = await controller.findOne(organizationId, 'group-123');

      expect(result).toEqual(expectedGroup);
      expect(mockDisplayGroupsService.findOne).toHaveBeenCalledWith(organizationId, 'group-123');
    });
  });

  describe('update', () => {
    it('should update a display group', async () => {
      const updateDto = { name: 'Updated Group Name' };
      const expectedGroup = { id: 'group-123', ...updateDto };
      mockDisplayGroupsService.update.mockResolvedValue(expectedGroup as any);

      const result = await controller.update(organizationId, 'group-123', updateDto as any);

      expect(result).toEqual(expectedGroup);
      expect(mockDisplayGroupsService.update).toHaveBeenCalledWith(
        organizationId,
        'group-123',
        updateDto,
      );
    });

    it('should update description only', async () => {
      const updateDto = { description: 'New description' };
      const expectedGroup = { id: 'group-123', name: 'Store Displays', ...updateDto };
      mockDisplayGroupsService.update.mockResolvedValue(expectedGroup as any);

      const result = await controller.update(organizationId, 'group-123', updateDto as any);

      expect(result).toEqual(expectedGroup);
      expect(mockDisplayGroupsService.update).toHaveBeenCalledWith(
        organizationId,
        'group-123',
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should remove a display group', async () => {
      mockDisplayGroupsService.remove.mockResolvedValue(undefined as any);

      await controller.remove(organizationId, 'group-123');

      expect(mockDisplayGroupsService.remove).toHaveBeenCalledWith(organizationId, 'group-123');
    });
  });

  describe('addDisplays', () => {
    it('should add displays to a group', async () => {
      const manageDto = { displayIds: ['display-1', 'display-2'] };
      const expectedGroup = {
        id: 'group-123',
        name: 'Store Displays',
        displays: [
          { id: 'member-1', displayId: 'display-1' },
          { id: 'member-2', displayId: 'display-2' },
        ],
      };
      mockDisplayGroupsService.addDisplays.mockResolvedValue(expectedGroup as any);

      const result = await controller.addDisplays(organizationId, 'group-123', manageDto as any);

      expect(result).toEqual(expectedGroup);
      expect(mockDisplayGroupsService.addDisplays).toHaveBeenCalledWith(
        organizationId,
        'group-123',
        manageDto,
      );
    });

    it('should add a single display to a group', async () => {
      const manageDto = { displayIds: ['display-1'] };
      const expectedGroup = {
        id: 'group-123',
        displays: [{ id: 'member-1', displayId: 'display-1' }],
      };
      mockDisplayGroupsService.addDisplays.mockResolvedValue(expectedGroup as any);

      const result = await controller.addDisplays(organizationId, 'group-123', manageDto as any);

      expect(result).toEqual(expectedGroup);
    });
  });

  describe('removeDisplays', () => {
    it('should remove displays from a group', async () => {
      const manageDto = { displayIds: ['display-1'] };
      const expectedGroup = {
        id: 'group-123',
        name: 'Store Displays',
        displays: [],
      };
      mockDisplayGroupsService.removeDisplays.mockResolvedValue(expectedGroup as any);

      const result = await controller.removeDisplays(organizationId, 'group-123', manageDto as any);

      expect(result).toEqual(expectedGroup);
      expect(mockDisplayGroupsService.removeDisplays).toHaveBeenCalledWith(
        organizationId,
        'group-123',
        manageDto,
      );
    });

    it('should remove multiple displays from a group', async () => {
      const manageDto = { displayIds: ['display-1', 'display-2', 'display-3'] };
      const expectedGroup = { id: 'group-123', displays: [] };
      mockDisplayGroupsService.removeDisplays.mockResolvedValue(expectedGroup as any);

      const result = await controller.removeDisplays(organizationId, 'group-123', manageDto as any);

      expect(result).toEqual(expectedGroup);
      expect(mockDisplayGroupsService.removeDisplays).toHaveBeenCalledWith(
        organizationId,
        'group-123',
        manageDto,
      );
    });
  });

  describe('error propagation', () => {
    it('should propagate NotFoundException from findOne', async () => {
      mockDisplayGroupsService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(organizationId, 'invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException from update', async () => {
      mockDisplayGroupsService.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update(organizationId, 'invalid-id', { name: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
  });
});
