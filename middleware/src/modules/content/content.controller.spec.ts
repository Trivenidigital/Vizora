import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';

describe('ContentController', () => {
  let controller: ContentController;
  let mockContentService: jest.Mocked<ContentService>;
  let mockThumbnailService: jest.Mocked<ThumbnailService>;
  let mockFileValidationService: jest.Mocked<FileValidationService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockContentService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      remove: jest.fn(),
    } as any;

    mockThumbnailService = {
      generateThumbnailFromUrl: jest.fn(),
    } as any;

    mockFileValidationService = {
      validateUrl: jest.fn(),
      validateFile: jest.fn(),
      sanitizeFilename: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        { provide: ContentService, useValue: mockContentService },
        { provide: ThumbnailService, useValue: mockThumbnailService },
        { provide: FileValidationService, useValue: mockFileValidationService },
      ],
    }).compile();

    controller = module.get<ContentController>(ContentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createContentDto = {
      name: 'Test Content',
      type: 'image',
      url: 'https://example.com/image.jpg',
    };

    it('should create content successfully', async () => {
      const expectedContent = { id: 'content-123', ...createContentDto };
      mockContentService.create.mockResolvedValue(expectedContent as any);

      const result = await controller.create(organizationId, createContentDto as any);

      expect(result).toEqual(expectedContent);
      expect(mockContentService.create).toHaveBeenCalledWith(organizationId, createContentDto);
    });

    it('should validate URL when provided', async () => {
      mockContentService.create.mockResolvedValue({ id: 'content-123' } as any);

      await controller.create(organizationId, createContentDto as any);

      expect(mockFileValidationService.validateUrl).toHaveBeenCalledWith(createContentDto.url);
    });

    it('should not validate URL when not provided', async () => {
      const dtoWithoutUrl = { name: 'Test', type: 'image' };
      mockContentService.create.mockResolvedValue({ id: 'content-123' } as any);

      await controller.create(organizationId, dtoWithoutUrl as any);

      expect(mockFileValidationService.validateUrl).not.toHaveBeenCalled();
    });

    it('should throw when URL validation fails', async () => {
      mockFileValidationService.validateUrl.mockImplementation(() => {
        throw new BadRequestException('Invalid URL');
      });

      await expect(controller.create(organizationId, createContentDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('uploadFile', () => {
    const mockFile: Express.Multer.File = {
      buffer: Buffer.from('test-content'),
      originalname: 'test-image.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
    } as any;

    beforeEach(() => {
      mockFileValidationService.validateFile.mockResolvedValue({
        hash: 'abc123hash',
        mimeType: 'image/jpeg',
      });
      mockFileValidationService.sanitizeFilename.mockReturnValue('test-image.jpg');
      mockContentService.create.mockResolvedValue({
        id: 'content-123',
        name: 'test-image.jpg',
      } as any);

      // Mock fs operations
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      jest.spyOn(require('fs'), 'mkdirSync').mockReturnValue(undefined);
      jest.spyOn(require('fs'), 'writeFileSync').mockReturnValue(undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(controller.uploadFile(organizationId, null as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.uploadFile(organizationId, null as any)).rejects.toThrow(
        'No file provided',
      );
    });

    it('should upload file successfully', async () => {
      const result = await controller.uploadFile(organizationId, mockFile);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('fileHash', 'abc123hash');
    });

    it('should validate file with magic numbers', async () => {
      await controller.uploadFile(organizationId, mockFile);

      expect(mockFileValidationService.validateFile).toHaveBeenCalledWith(
        mockFile.buffer,
        mockFile.originalname,
        mockFile.mimetype,
      );
    });

    it('should sanitize filename', async () => {
      await controller.uploadFile(organizationId, mockFile);

      expect(mockFileValidationService.sanitizeFilename).toHaveBeenCalledWith(mockFile.originalname);
    });

    it('should use provided name if given', async () => {
      await controller.uploadFile(organizationId, mockFile, 'Custom Name');

      expect(mockContentService.create).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({ name: 'Custom Name' }),
      );
    });

    it('should determine content type from mimetype - video', async () => {
      const videoFile = { ...mockFile, mimetype: 'video/mp4' };
      mockFileValidationService.validateFile.mockResolvedValue({
        hash: 'abc123',
        mimeType: 'video/mp4',
      });

      await controller.uploadFile(organizationId, videoFile as any);

      expect(mockContentService.create).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({ type: 'video' }),
      );
    });

    it('should determine content type from mimetype - pdf', async () => {
      const pdfFile = { ...mockFile, mimetype: 'application/pdf' };
      mockFileValidationService.validateFile.mockResolvedValue({
        hash: 'abc123',
        mimeType: 'application/pdf',
      });

      await controller.uploadFile(organizationId, pdfFile as any);

      expect(mockContentService.create).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({ type: 'pdf' }),
      );
    });

    it('should use provided type if given', async () => {
      await controller.uploadFile(organizationId, mockFile, undefined, 'custom');

      expect(mockContentService.create).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({ type: 'custom' }),
      );
    });

    it('should set thumbnail for image content', async () => {
      await controller.uploadFile(organizationId, mockFile);

      expect(mockContentService.create).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          thumbnail: expect.stringContaining('uploads/'),
        }),
      );
    });
  });

  describe('findAll', () => {
    const pagination = { page: 1, limit: 10 };

    it('should return all content with pagination', async () => {
      const expectedResult = { data: [], total: 0 };
      mockContentService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
      expect(mockContentService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        { type: undefined, status: undefined },
      );
    });

    it('should pass type and status filters', async () => {
      mockContentService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(organizationId, pagination as any, 'image', 'active');

      expect(mockContentService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        { type: 'image', status: 'active' },
      );
    });
  });

  describe('findOne', () => {
    it('should return content by id', async () => {
      const expectedContent = { id: 'content-123', name: 'Test' };
      mockContentService.findOne.mockResolvedValue(expectedContent as any);

      const result = await controller.findOne(organizationId, 'content-123');

      expect(result).toEqual(expectedContent);
      expect(mockContentService.findOne).toHaveBeenCalledWith(organizationId, 'content-123');
    });
  });

  describe('update', () => {
    it('should update content', async () => {
      const updateDto = { name: 'Updated Name' };
      const expectedContent = { id: 'content-123', name: 'Updated Name' };
      mockContentService.update.mockResolvedValue(expectedContent as any);

      const result = await controller.update(organizationId, 'content-123', updateDto as any);

      expect(result).toEqual(expectedContent);
      expect(mockContentService.update).toHaveBeenCalledWith(
        organizationId,
        'content-123',
        updateDto,
      );
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail for image content', async () => {
      const content = { id: 'content-123', type: 'image', url: 'https://example.com/image.jpg' };
      mockContentService.findOne.mockResolvedValue(content as any);
      mockThumbnailService.generateThumbnailFromUrl.mockResolvedValue('https://example.com/thumb.jpg');
      mockContentService.update.mockResolvedValue({} as any);

      const result = await controller.generateThumbnail(organizationId, 'content-123');

      expect(result).toEqual({ thumbnail: 'https://example.com/thumb.jpg' });
      expect(mockThumbnailService.generateThumbnailFromUrl).toHaveBeenCalledWith(
        content.id,
        content.url,
      );
    });

    it('should return message for non-image content', async () => {
      const content = { id: 'content-123', type: 'video', url: 'https://example.com/video.mp4' };
      mockContentService.findOne.mockResolvedValue(content as any);

      const result = await controller.generateThumbnail(organizationId, 'content-123');

      expect(result).toEqual({
        message: 'Thumbnail generation only supported for images',
        thumbnail: null,
      });
      expect(mockThumbnailService.generateThumbnailFromUrl).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should archive content', async () => {
      const expectedResult = { id: 'content-123', status: 'archived' };
      mockContentService.archive.mockResolvedValue(expectedResult as any);

      const result = await controller.archive(organizationId, 'content-123');

      expect(result).toEqual(expectedResult);
      expect(mockContentService.archive).toHaveBeenCalledWith(organizationId, 'content-123');
    });
  });

  describe('remove', () => {
    it('should remove content', async () => {
      mockContentService.remove.mockResolvedValue(undefined);

      await controller.remove(organizationId, 'content-123');

      expect(mockContentService.remove).toHaveBeenCalledWith(organizationId, 'content-123');
    });
  });
});
