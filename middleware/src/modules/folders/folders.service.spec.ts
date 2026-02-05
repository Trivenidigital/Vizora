import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FoldersService } from './folders.service';
import { DatabaseService } from '../database/database.service';

describe('FoldersService', () => {
  let service: FoldersService;
  let mockDatabaseService: any;

  const mockFolder = {
    id: 'folder-123',
    name: 'Marketing',
    parentId: null,
    organizationId: 'org-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFolderWithCount = {
    ...mockFolder,
    _count: { content: 5 },
  };

  const mockContent = {
    id: 'content-123',
    name: 'Test Image',
    type: 'image',
    url: 'https://example.com/image.png',
    organizationId: 'org-123',
    folderId: 'folder-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    thumbnail: 'https://example.com/thumb.png',
    tags: [],
  };

  beforeEach(() => {
    mockDatabaseService = {
      contentFolder: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      content: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new FoldersService(mockDatabaseService as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = { name: 'New Folder' };

    it('should create a folder without parent', async () => {
      mockDatabaseService.contentFolder.create.mockResolvedValue({
        ...mockFolder,
        ...createDto,
        _count: { content: 0 },
      });

      const result = await service.create('org-123', createDto);

      expect(result).toBeDefined();
      expect(mockDatabaseService.contentFolder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New Folder',
            parentId: null,
            organizationId: 'org-123',
          }),
        }),
      );
    });

    it('should create a folder with valid parent', async () => {
      const parentFolder = { ...mockFolder, id: 'parent-123' };
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue(parentFolder);
      mockDatabaseService.contentFolder.create.mockResolvedValue({
        ...mockFolder,
        name: 'Child Folder',
        parentId: 'parent-123',
        _count: { content: 0 },
      });

      const result = await service.create('org-123', {
        name: 'Child Folder',
        parentId: 'parent-123',
      });

      expect(result.parentId).toBe('parent-123');
    });

    it('should throw BadRequestException if parent folder does not exist', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue(null);

      await expect(
        service.create('org-123', { name: 'Child', parentId: 'invalid-parent' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if parent belongs to different organization', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue(null);

      await expect(
        service.create('org-123', { name: 'Child', parentId: 'parent-from-other-org' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all folders for organization', async () => {
      mockDatabaseService.contentFolder.findMany.mockResolvedValue([mockFolderWithCount]);

      const result = await service.findAll('org-123');

      expect(result).toHaveLength(1);
      expect(result[0].contentCount).toBe(5);
    });

    it('should return empty array when no folders exist', async () => {
      mockDatabaseService.contentFolder.findMany.mockResolvedValue([]);

      const result = await service.findAll('org-123');

      expect(result).toHaveLength(0);
    });

    it('should order folders by name', async () => {
      mockDatabaseService.contentFolder.findMany.mockResolvedValue([]);

      await service.findAll('org-123');

      expect(mockDatabaseService.contentFolder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('should enforce organization isolation', async () => {
      mockDatabaseService.contentFolder.findMany.mockResolvedValue([]);

      await service.findAll('org-456');

      expect(mockDatabaseService.contentFolder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-456' },
        }),
      );
    });
  });

  describe('findTree', () => {
    it('should return nested folder structure', async () => {
      const parentFolder = { ...mockFolderWithCount, id: 'parent-1', parentId: null };
      const childFolder = { ...mockFolderWithCount, id: 'child-1', parentId: 'parent-1' };
      mockDatabaseService.contentFolder.findMany.mockResolvedValue([parentFolder, childFolder]);

      const result = await service.findTree('org-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('parent-1');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].id).toBe('child-1');
    });

    it('should handle multiple root folders', async () => {
      const root1 = { ...mockFolderWithCount, id: 'root-1', parentId: null };
      const root2 = { ...mockFolderWithCount, id: 'root-2', parentId: null };
      mockDatabaseService.contentFolder.findMany.mockResolvedValue([root1, root2]);

      const result = await service.findTree('org-123');

      expect(result).toHaveLength(2);
    });

    it('should handle deeply nested folders', async () => {
      const level1 = { ...mockFolderWithCount, id: 'level-1', parentId: null };
      const level2 = { ...mockFolderWithCount, id: 'level-2', parentId: 'level-1' };
      const level3 = { ...mockFolderWithCount, id: 'level-3', parentId: 'level-2' };
      mockDatabaseService.contentFolder.findMany.mockResolvedValue([level1, level2, level3]);

      const result = await service.findTree('org-123');

      expect(result).toHaveLength(1);
      expect(result[0].children![0].children![0].id).toBe('level-3');
    });

    it('should return empty array when no folders exist', async () => {
      mockDatabaseService.contentFolder.findMany.mockResolvedValue([]);

      const result = await service.findTree('org-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a folder by id', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [],
        _count: { content: 3 },
      });

      const result = await service.findOne('org-123', 'folder-123');

      expect(result.id).toBe('folder-123');
      expect(result.contentCount).toBe(3);
    });

    it('should throw NotFoundException if folder not found', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue(null);

      await expect(service.findOne('org-123', 'invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should include parent and children relations', async () => {
      const parent = { ...mockFolder, id: 'parent-1' };
      const child = { ...mockFolder, id: 'child-1' };
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent,
        children: [child],
        _count: { content: 2 },
      });

      const result = await service.findOne('org-123', 'folder-123');

      expect(result.parent).toBeDefined();
      expect(result.children).toHaveLength(1);
    });

    it('should enforce organization isolation', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue(null);

      await expect(service.findOne('org-different', 'folder-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update folder name', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [],
        _count: { content: 0 },
      });
      mockDatabaseService.contentFolder.update.mockResolvedValue({
        ...mockFolder,
        name: 'Updated Name',
        parent: null,
        children: [],
        _count: { content: 0 },
      });

      const result = await service.update('org-123', 'folder-123', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should update parent folder', async () => {
      mockDatabaseService.contentFolder.findFirst
        .mockResolvedValueOnce({ ...mockFolder, parent: null, children: [], _count: { content: 0 } }) // findOne
        .mockResolvedValueOnce({ ...mockFolder, id: 'new-parent' }); // parent validation
      mockDatabaseService.contentFolder.update.mockResolvedValue({
        ...mockFolder,
        parentId: 'new-parent',
        parent: null,
        children: [],
        _count: { content: 0 },
      });

      const result = await service.update('org-123', 'folder-123', { parentId: 'new-parent' });

      expect(result.parentId).toBe('new-parent');
    });

    it('should throw BadRequestException when setting folder as its own parent', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [],
        _count: { content: 0 },
      });

      await expect(
        service.update('org-123', 'folder-123', { parentId: 'folder-123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when parent folder not found', async () => {
      mockDatabaseService.contentFolder.findFirst
        .mockResolvedValueOnce({ ...mockFolder, parent: null, children: [], _count: { content: 0 } })
        .mockResolvedValueOnce(null);

      await expect(
        service.update('org-123', 'folder-123', { parentId: 'invalid-parent' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if folder not found', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue(null);

      await expect(
        service.update('org-123', 'invalid-id', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for circular reference', async () => {
      const folder = { ...mockFolder, parent: null, children: [], _count: { content: 0 } };
      const childFolder = { ...mockFolder, id: 'child-123', parentId: 'folder-123' };

      mockDatabaseService.contentFolder.findFirst
        .mockResolvedValueOnce(folder) // findOne for main folder
        .mockResolvedValueOnce(childFolder) // parent validation (child exists)
        .mockResolvedValueOnce({ parentId: 'folder-123' }); // isDescendant check

      await expect(
        service.update('org-123', 'folder-123', { parentId: 'child-123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a folder and move content to parent', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parentId: 'parent-123',
        parent: null,
        children: [],
        _count: { content: 0 },
      });
      mockDatabaseService.content.updateMany.mockResolvedValue({ count: 3 });
      mockDatabaseService.contentFolder.updateMany.mockResolvedValue({ count: 2 });
      mockDatabaseService.contentFolder.delete.mockResolvedValue(mockFolder);

      await service.remove('org-123', 'folder-123');

      expect(mockDatabaseService.content.updateMany).toHaveBeenCalledWith({
        where: { folderId: 'folder-123', organizationId: 'org-123' },
        data: { folderId: 'parent-123' },
      });
    });

    it('should move child folders to parent when deleting', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parentId: 'parent-123',
        parent: null,
        children: [],
        _count: { content: 0 },
      });
      mockDatabaseService.content.updateMany.mockResolvedValue({ count: 0 });
      mockDatabaseService.contentFolder.updateMany.mockResolvedValue({ count: 2 });
      mockDatabaseService.contentFolder.delete.mockResolvedValue(mockFolder);

      await service.remove('org-123', 'folder-123');

      expect(mockDatabaseService.contentFolder.updateMany).toHaveBeenCalledWith({
        where: { parentId: 'folder-123', organizationId: 'org-123' },
        data: { parentId: 'parent-123' },
      });
    });

    it('should throw NotFoundException if folder not found', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue(null);

      await expect(service.remove('org-123', 'invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should enforce organization isolation in remove', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue(null);

      await expect(service.remove('org-different', 'folder-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('moveContent', () => {
    it('should move content to folder', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [],
        _count: { content: 0 },
      });
      mockDatabaseService.content.count.mockResolvedValue(2);
      mockDatabaseService.content.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.moveContent('org-123', 'folder-123', {
        contentIds: ['content-1', 'content-2'],
      });

      expect(result.moved).toBe(2);
    });

    it('should throw NotFoundException if folder not found', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue(null);

      await expect(
        service.moveContent('org-123', 'invalid-folder', { contentIds: ['content-1'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if some content not found', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [],
        _count: { content: 0 },
      });
      mockDatabaseService.content.count.mockResolvedValue(1); // Only 1 found, but 2 requested

      await expect(
        service.moveContent('org-123', 'folder-123', { contentIds: ['content-1', 'content-2'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce organization isolation for content', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [],
        _count: { content: 0 },
      });
      mockDatabaseService.content.count.mockResolvedValue(0);

      await expect(
        service.moveContent('org-123', 'folder-123', { contentIds: ['content-from-other-org'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getContents', () => {
    it('should return paginated content from folder', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [],
        _count: { content: 1 },
      });
      mockDatabaseService.content.findMany.mockResolvedValue([mockContent]);
      mockDatabaseService.content.count.mockResolvedValue(1);

      const result = await service.getContents('org-123', 'folder-123', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should throw NotFoundException if folder not found', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue(null);

      await expect(
        service.getContents('org-123', 'invalid-folder', { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use default pagination values', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [],
        _count: { content: 0 },
      });
      mockDatabaseService.content.findMany.mockResolvedValue([]);
      mockDatabaseService.content.count.mockResolvedValue(0);

      const result = await service.getContents('org-123', 'folder-123', {});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should calculate correct pagination offset', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [],
        _count: { content: 0 },
      });
      mockDatabaseService.content.findMany.mockResolvedValue([]);
      mockDatabaseService.content.count.mockResolvedValue(0);

      await service.getContents('org-123', 'folder-123', { page: 3, limit: 5 });

      expect(mockDatabaseService.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });

    it('should map content with title and thumbnailUrl', async () => {
      mockDatabaseService.contentFolder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [],
        _count: { content: 1 },
      });
      mockDatabaseService.content.findMany.mockResolvedValue([mockContent]);
      mockDatabaseService.content.count.mockResolvedValue(1);

      const result = await service.getContents('org-123', 'folder-123', { page: 1, limit: 10 });

      expect(result.data[0].title).toBe('Test Image');
      expect(result.data[0].thumbnailUrl).toBe('https://example.com/thumb.png');
    });
  });

  describe('removeContentFromFolder', () => {
    it('should remove content from folder', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2);
      mockDatabaseService.content.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.removeContentFromFolder('org-123', ['content-1', 'content-2']);

      expect(result.removed).toBe(2);
      expect(mockDatabaseService.content.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['content-1', 'content-2'] }, organizationId: 'org-123' },
        data: { folderId: null },
      });
    });

    it('should throw BadRequestException if some content not found', async () => {
      mockDatabaseService.content.count.mockResolvedValue(1);

      await expect(
        service.removeContentFromFolder('org-123', ['content-1', 'content-2']),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
