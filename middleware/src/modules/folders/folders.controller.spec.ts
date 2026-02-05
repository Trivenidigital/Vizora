import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';

describe('FoldersController', () => {
  let controller: FoldersController;
  let mockFoldersService: jest.Mocked<FoldersService>;

  const organizationId = 'org-123';

  const mockFolder = {
    id: 'folder-123',
    name: 'Marketing',
    parentId: null,
    organizationId: 'org-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    contentCount: 5,
  };

  beforeEach(async () => {
    mockFoldersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findTree: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      moveContent: jest.fn(),
      getContents: jest.fn(),
      removeContentFromFolder: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FoldersController],
      providers: [{ provide: FoldersService, useValue: mockFoldersService }],
    }).compile();

    controller = module.get<FoldersController>(FoldersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDto = { name: 'New Folder' };

    it('should create a folder', async () => {
      const expectedFolder = { ...mockFolder, ...createDto };
      mockFoldersService.create.mockResolvedValue(expectedFolder as any);

      const result = await controller.create(organizationId, createDto as any);

      expect(result).toEqual(expectedFolder);
      expect(mockFoldersService.create).toHaveBeenCalledWith(organizationId, createDto);
    });

    it('should create a folder with parent', async () => {
      const dtoWithParent = { name: 'Child Folder', parentId: 'parent-123' };
      const expectedFolder = { ...mockFolder, ...dtoWithParent };
      mockFoldersService.create.mockResolvedValue(expectedFolder as any);

      const result = await controller.create(organizationId, dtoWithParent as any);

      expect(result.parentId).toBe('parent-123');
      expect(mockFoldersService.create).toHaveBeenCalledWith(organizationId, dtoWithParent);
    });
  });

  describe('findAll', () => {
    it('should return flat list of folders', async () => {
      mockFoldersService.findAll.mockResolvedValue([mockFolder] as any);

      const result = await controller.findAll(organizationId);

      expect(result).toHaveLength(1);
      expect(mockFoldersService.findAll).toHaveBeenCalledWith(organizationId);
    });

    it('should return tree structure when format=tree', async () => {
      const treeResult = [{ ...mockFolder, children: [] }];
      mockFoldersService.findTree.mockResolvedValue(treeResult as any);

      const result = await controller.findAll(organizationId, 'tree');

      expect(result).toEqual(treeResult);
      expect(mockFoldersService.findTree).toHaveBeenCalledWith(organizationId);
    });

    it('should handle empty results', async () => {
      mockFoldersService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(organizationId);

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a folder by id', async () => {
      mockFoldersService.findOne.mockResolvedValue(mockFolder as any);

      const result = await controller.findOne(organizationId, 'folder-123');

      expect(result).toEqual(mockFolder);
      expect(mockFoldersService.findOne).toHaveBeenCalledWith(organizationId, 'folder-123');
    });

    it('should propagate NotFoundException', async () => {
      mockFoldersService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(organizationId, 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Name' };

    it('should update a folder', async () => {
      const expectedFolder = { ...mockFolder, ...updateDto };
      mockFoldersService.update.mockResolvedValue(expectedFolder as any);

      const result = await controller.update(organizationId, 'folder-123', updateDto as any);

      expect(result.name).toBe('Updated Name');
      expect(mockFoldersService.update).toHaveBeenCalledWith(organizationId, 'folder-123', updateDto);
    });

    it('should update parent folder', async () => {
      const updateParentDto = { parentId: 'new-parent-123' };
      const expectedFolder = { ...mockFolder, parentId: 'new-parent-123' };
      mockFoldersService.update.mockResolvedValue(expectedFolder as any);

      const result = await controller.update(organizationId, 'folder-123', updateParentDto as any);

      expect(result.parentId).toBe('new-parent-123');
    });

    it('should propagate BadRequestException for circular reference', async () => {
      mockFoldersService.update.mockRejectedValue(
        new BadRequestException('Cannot move folder into its own descendant'),
      );

      await expect(
        controller.update(organizationId, 'folder-123', { parentId: 'child-123' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a folder', async () => {
      mockFoldersService.remove.mockResolvedValue(mockFolder as any);

      await controller.remove(organizationId, 'folder-123');

      expect(mockFoldersService.remove).toHaveBeenCalledWith(organizationId, 'folder-123');
    });

    it('should propagate NotFoundException', async () => {
      mockFoldersService.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(organizationId, 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('moveContent', () => {
    const moveContentDto = { contentIds: ['content-1', 'content-2'] };

    it('should move content to folder', async () => {
      mockFoldersService.moveContent.mockResolvedValue({ moved: 2 });

      const result = await controller.moveContent(organizationId, 'folder-123', moveContentDto as any);

      expect(result.moved).toBe(2);
      expect(mockFoldersService.moveContent).toHaveBeenCalledWith(
        organizationId,
        'folder-123',
        moveContentDto,
      );
    });

    it('should propagate NotFoundException if folder not found', async () => {
      mockFoldersService.moveContent.mockRejectedValue(new NotFoundException());

      await expect(
        controller.moveContent(organizationId, 'invalid-folder', moveContentDto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException if content not found', async () => {
      mockFoldersService.moveContent.mockRejectedValue(
        new BadRequestException('Some content items not found'),
      );

      await expect(
        controller.moveContent(organizationId, 'folder-123', { contentIds: ['invalid-content'] } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getContents', () => {
    const pagination = { page: 1, limit: 10 };

    it('should return paginated content from folder', async () => {
      const expectedResult = {
        data: [{ id: 'content-1', name: 'Test' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockFoldersService.getContents.mockResolvedValue(expectedResult as any);

      const result = await controller.getContents(organizationId, 'folder-123', pagination as any);

      expect(result).toEqual(expectedResult);
      expect(mockFoldersService.getContents).toHaveBeenCalledWith(
        organizationId,
        'folder-123',
        pagination,
      );
    });

    it('should propagate NotFoundException if folder not found', async () => {
      mockFoldersService.getContents.mockRejectedValue(new NotFoundException());

      await expect(
        controller.getContents(organizationId, 'invalid-folder', pagination as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty content results', async () => {
      const emptyResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      mockFoldersService.getContents.mockResolvedValue(emptyResult as any);

      const result = await controller.getContents(organizationId, 'folder-123', pagination as any);

      expect(result.data).toHaveLength(0);
    });
  });

  describe('error propagation', () => {
    it('should propagate service errors from create', async () => {
      mockFoldersService.create.mockRejectedValue(new BadRequestException('Invalid parent'));

      await expect(
        controller.create(organizationId, { name: 'Test', parentId: 'invalid' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate service errors from findOne', async () => {
      mockFoldersService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(organizationId, 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});
