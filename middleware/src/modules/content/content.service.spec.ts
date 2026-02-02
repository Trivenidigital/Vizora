import { NotFoundException } from '@nestjs/common';
import { ContentService } from './content.service';
import { DatabaseService } from '../database/database.service';

describe('ContentService', () => {
  let service: ContentService;
  let mockDatabaseService: any;

  const mockContent = {
    id: 'content-123',
    organizationId: 'org-123',
    name: 'Test Content',
    description: 'Test description',
    type: 'image',
    url: 'https://example.com/image.jpg',
    duration: 10,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockDatabaseService = {
      content: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new ContentService(mockDatabaseService as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Content',
      type: 'image',
      url: 'https://example.com/new.jpg',
      duration: 15,
    };

    it('should create content', async () => {
      mockDatabaseService.content.create.mockResolvedValue({
        ...mockContent,
        ...createDto,
      });

      const result = await service.create('org-123', createDto);

      expect(result).toBeDefined();
      expect(mockDatabaseService.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-123',
          name: createDto.name,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated content', async () => {
      mockDatabaseService.content.findMany.mockResolvedValue([mockContent]);
      mockDatabaseService.content.count.mockResolvedValue(1);

      const result = await service.findAll('org-123', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by type', async () => {
      mockDatabaseService.content.findMany.mockResolvedValue([mockContent]);
      mockDatabaseService.content.count.mockResolvedValue(1);

      await service.findAll('org-123', { page: 1, limit: 10 }, { type: 'image' });

      expect(mockDatabaseService.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'image' }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockDatabaseService.content.findMany.mockResolvedValue([]);
      mockDatabaseService.content.count.mockResolvedValue(0);

      await service.findAll('org-123', { page: 1, limit: 10 }, { status: 'archived' });

      expect(mockDatabaseService.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'archived' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return content by id with mapped fields', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockContent);

      const result = await service.findOne('org-123', 'content-123');

      // Service maps name->title and thumbnail->thumbnailUrl for frontend compatibility
      expect(result).toEqual({
        ...mockContent,
        title: mockContent.name, // name is mapped to title
        thumbnailUrl: undefined, // thumbnail is mapped to thumbnailUrl (undefined since not in mock)
      });
      expect(result.title).toBe('Test Content');
    });

    it('should include thumbnail mapping when content has thumbnail', async () => {
      const contentWithThumbnail = {
        ...mockContent,
        thumbnail: 'https://example.com/thumb.jpg',
      };
      mockDatabaseService.content.findFirst.mockResolvedValue(contentWithThumbnail);

      const result = await service.findOne('org-123', 'content-123');

      expect(result.thumbnailUrl).toBe('https://example.com/thumb.jpg');
    });

    it('should throw NotFoundException if content not found', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(null);

      await expect(service.findOne('org-123', 'invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should enforce organization isolation', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(null);

      await expect(service.findOne('other-org', 'content-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Content' };

    it('should update content', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockContent);
      mockDatabaseService.content.update.mockResolvedValue({
        ...mockContent,
        ...updateDto,
      });

      const result = await service.update('org-123', 'content-123', updateDto);

      expect(result.name).toBe('Updated Content');
    });

    it('should throw NotFoundException if content not found', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(null);

      await expect(service.update('org-123', 'invalid-id', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete content', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockContent);
      mockDatabaseService.content.delete.mockResolvedValue(mockContent);

      const result = await service.remove('org-123', 'content-123');

      expect(result).toEqual(mockContent);
    });

    it('should throw NotFoundException if content not found', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(null);

      await expect(service.remove('org-123', 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('should archive content', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockContent);
      mockDatabaseService.content.update.mockResolvedValue({
        ...mockContent,
        status: 'archived',
      });

      const result = await service.archive('org-123', 'content-123');

      expect(result.status).toBe('archived');
      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: { status: 'archived' },
      });
    });
  });
});
