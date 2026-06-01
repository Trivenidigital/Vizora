// Mock isomorphic-dompurify before importing services
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';
import { StorageService } from '../storage/storage.service';
import { StorageQuotaService } from '../storage/storage-quota.service';
import { SubscriptionActiveGuard } from '../billing/guards/subscription-active.guard';
import { DatabaseService } from '../database/database.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('ContentController', () => {
  let controller: ContentController;
  let mockContentService: jest.Mocked<ContentService>;
  let mockThumbnailService: jest.Mocked<ThumbnailService>;
  let mockFileValidationService: jest.Mocked<FileValidationService>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockStorageQuotaService: jest.Mocked<StorageQuotaService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockContentService = {
      create: jest.fn(),
      findAll: jest.fn(),
      listContentTags: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      remove: jest.fn(),
      // Template methods
      createTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      previewTemplate: jest.fn(),
      getRenderedTemplate: jest.fn(),
      triggerTemplateRefresh: jest.fn(),
      validateTemplateHtml: jest.fn(),
      // File replacement methods
      replaceFile: jest.fn(),
      getVersionHistory: jest.fn(),
      restore: jest.fn(),
      // Expiration methods
      setExpiration: jest.fn(),
      clearExpiration: jest.fn(),
      // Bulk operation methods
      bulkUpdate: jest.fn(),
      bulkArchive: jest.fn(),
      bulkRestore: jest.fn(),
      bulkDelete: jest.fn(),
      bulkAddTags: jest.fn(),
      bulkSetDuration: jest.fn(),
    } as any;

    mockThumbnailService = {
      generateThumbnail: jest.fn().mockResolvedValue('/static/thumbnails/thumb-123.jpg'),
      generateThumbnailFromPath: jest.fn().mockResolvedValue('/static/thumbnails/thumb-123.jpg'),
      generateThumbnailFromUrl: jest.fn().mockResolvedValue('/static/thumbnails/thumb-url-123.jpg'),
    } as any;

    mockFileValidationService = {
      validateUrl: jest.fn(),
      validateFile: jest.fn(),
      validateFileAtPath: jest.fn(),
      sanitizeFilename: jest.fn(),
    } as any;

    mockStorageService = {
      isMinioAvailable: jest.fn().mockReturnValue(false),
      uploadFile: jest.fn(),
      uploadFileFromPath: jest.fn(),
      getPresignedUrl: jest.fn(),
      deleteFile: jest.fn(),
      generateObjectKey: jest.fn(),
      fileExists: jest.fn(),
      getFileMetadata: jest.fn(),
      healthCheck: jest.fn(),
      listObjects: jest.fn(),
      copyFile: jest.fn(),
      getBucket: jest.fn().mockReturnValue('vizora-content'),
    } as any;

    mockStorageQuotaService = {
      getStorageInfo: jest.fn(),
      checkQuota: jest.fn(),
      reserveQuota: jest.fn(),
      incrementUsage: jest.fn(),
      decrementUsage: jest.fn(),
      recalculateUsage: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        { provide: ContentService, useValue: mockContentService },
        { provide: ThumbnailService, useValue: mockThumbnailService },
        { provide: FileValidationService, useValue: mockFileValidationService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: StorageQuotaService, useValue: mockStorageQuotaService },
        { provide: DatabaseService, useValue: {} },
        SubscriptionActiveGuard,
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
      (mockFileValidationService as any).validateFileAtPath.mockResolvedValue({
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

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('fileHash', 'abc123hash');
      expect(mockStorageQuotaService.reserveQuota).toHaveBeenCalledWith(organizationId, mockFile.size);
      expect(mockStorageQuotaService.incrementUsage).not.toHaveBeenCalled();
    });

    it('should release reserved quota when content creation fails', async () => {
      mockContentService.create.mockRejectedValueOnce(new Error('db write failed'));

      await expect(controller.uploadFile(organizationId, mockFile)).rejects.toThrow('db write failed');

      expect(mockStorageQuotaService.reserveQuota).toHaveBeenCalledWith(organizationId, mockFile.size);
      expect(mockStorageQuotaService.decrementUsage).toHaveBeenCalledWith(organizationId, mockFile.size);
    });

    it('keeps quota reserved when uploaded object cleanup fails after content creation failure', async () => {
      mockStorageService.isMinioAvailable.mockReturnValueOnce(true);
      mockStorageService.generateObjectKey.mockReturnValueOnce('org-123/uploads/uploaded.jpg');
      mockContentService.create.mockRejectedValueOnce(new Error('db write failed'));
      mockStorageService.deleteFile.mockRejectedValueOnce(new Error('delete failed'));

      await expect(controller.uploadFile(organizationId, mockFile)).rejects.toThrow('db write failed');

      expect(mockStorageQuotaService.reserveQuota).toHaveBeenCalledWith(organizationId, mockFile.size);
      expect(mockStorageQuotaService.decrementUsage).not.toHaveBeenCalledWith(organizationId, mockFile.size);
    });

    it('should fail closed in production when object storage is unavailable', async () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        mockStorageService.isMinioAvailable.mockReturnValueOnce(false);

        await expect(controller.uploadFile(organizationId, mockFile)).rejects.toThrow(
          'Storage service is currently unavailable',
        );

        expect(mockContentService.create).not.toHaveBeenCalled();
        expect(mockStorageQuotaService.decrementUsage).toHaveBeenCalledWith(organizationId, mockFile.size);
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });

    it('should validate file with magic numbers', async () => {
      await controller.uploadFile(organizationId, mockFile);

      expect(mockFileValidationService.validateFile).toHaveBeenCalledWith(
        mockFile.buffer,
        mockFile.originalname,
        mockFile.mimetype,
      );
    });

    it('should validate and upload disk-backed files without using file.buffer', async () => {
      const diskFile = {
        path: path.join(os.tmpdir(), 'vizora-content-uploads', 'upload-disk.jpg'),
        originalname: 'disk-image.jpg',
        mimetype: 'image/jpeg',
        size: 4096,
      } as Express.Multer.File;
      mockStorageService.isMinioAvailable.mockReturnValueOnce(true);
      mockStorageService.generateObjectKey.mockReturnValueOnce('org-123/uploads/disk-image.jpg');
      const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      await controller.uploadFile(organizationId, diskFile);

      expect((mockFileValidationService as any).validateFileAtPath).toHaveBeenCalledWith(
        diskFile.path,
        diskFile.originalname,
        diskFile.mimetype,
        diskFile.size,
      );
      expect(mockFileValidationService.validateFile).not.toHaveBeenCalled();
      expect((mockStorageService as any).uploadFileFromPath).toHaveBeenCalledWith(
        diskFile.path,
        'org-123/uploads/disk-image.jpg',
        diskFile.mimetype,
        diskFile.size,
      );
      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      await new Promise(resolve => setImmediate(resolve));
      expect(unlinkSpy).toHaveBeenCalledWith(diskFile.path);
      unlinkSpy.mockRestore();
    });

    it('should clean disk-backed upload temp files when validation fails before quota reservation', async () => {
      const diskFile = {
        path: path.join(os.tmpdir(), 'vizora-content-uploads', 'invalid-disk.jpg'),
        originalname: 'invalid-disk.jpg',
        mimetype: 'image/jpeg',
        size: 4096,
      } as Express.Multer.File;
      (mockFileValidationService as any).validateFileAtPath.mockRejectedValueOnce(
        new BadRequestException('Invalid file'),
      );
      const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      await expect(controller.uploadFile(organizationId, diskFile)).rejects.toThrow('Invalid file');

      expect(mockStorageQuotaService.reserveQuota).not.toHaveBeenCalled();
      expect(unlinkSpy).toHaveBeenCalledWith(diskFile.path);
      unlinkSpy.mockRestore();
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

    it('should fire-and-forget thumbnail generation for image content', async () => {
      await controller.uploadFile(organizationId, mockFile);

      // Thumbnail generation is now fire-and-forget (not awaited in upload handler)
      // Verify it was called but the upload response returns immediately without thumbnail
      expect(mockThumbnailService.generateThumbnail).toHaveBeenCalledWith(
        'content-123',
        mockFile.buffer,
        mockFile.mimetype,
      );

      // Allow the fire-and-forget promise to resolve
      await new Promise(resolve => setImmediate(resolve));

      expect(mockContentService.update).toHaveBeenCalledWith(
        organizationId,
        'content-123',
        expect.objectContaining({
          thumbnail: expect.any(String),
        }),
      );
    });

    it('should keep disk-backed image temp files until thumbnail generation settles', async () => {
      const diskFile = {
        path: path.join(os.tmpdir(), 'vizora-content-uploads', 'thumbnail-owned.jpg'),
        originalname: 'thumbnail-owned.jpg',
        mimetype: 'image/jpeg',
        size: 4096,
      } as Express.Multer.File;
      mockStorageService.isMinioAvailable.mockReturnValueOnce(true);
      mockStorageService.generateObjectKey.mockReturnValueOnce('org-123/uploads/thumbnail-owned.jpg');
      let resolveThumbnail: (thumbnail: string) => void = () => {};
      (mockThumbnailService as any).generateThumbnailFromPath.mockReturnValueOnce(
        new Promise<string>((resolve) => {
          resolveThumbnail = resolve;
        }),
      );
      const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      await controller.uploadFile(organizationId, diskFile);

      expect((mockThumbnailService as any).generateThumbnailFromPath).toHaveBeenCalledWith(
        'content-123',
        diskFile.path,
        diskFile.mimetype,
      );
      expect(unlinkSpy).not.toHaveBeenCalled();

      resolveThumbnail('/static/thumbnails/thumb-path.jpg');
      await new Promise(resolve => setImmediate(resolve));

      expect(mockContentService.update).toHaveBeenCalledWith(
        organizationId,
        'content-123',
        expect.objectContaining({ thumbnail: '/static/thumbnails/thumb-path.jpg' }),
      );
      expect(unlinkSpy).toHaveBeenCalledWith(diskFile.path);
      unlinkSpy.mockRestore();
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
        { type: undefined, status: undefined, templateOrientation: undefined },
      );
    });

    it('should pass type and status filters', async () => {
      mockContentService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(organizationId, { ...pagination, type: 'image', status: 'active' } as any);

      expect(mockContentService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        { type: 'image', status: 'active', templateOrientation: undefined },
      );
    });

    it('should pass server-side library filters without mixing them into pagination', async () => {
      mockContentService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(organizationId, {
        ...pagination,
        search: 'menu',
        dateRange: '7days',
        tagNames: ['Marketing', 'Seasonal'],
        tagIds: ['tag-menu', 'tag-seasonal'],
      } as any);

      expect(mockContentService.findAll).toHaveBeenCalledWith(
        organizationId,
        pagination,
        {
          type: undefined,
          status: undefined,
          templateOrientation: undefined,
          search: 'menu',
          dateRange: '7days',
          tagNames: ['Marketing', 'Seasonal'],
          tagIds: ['tag-menu', 'tag-seasonal'],
        },
      );
    });
  });

  describe('listContentTags', () => {
    it('should return tenant-scoped content tags for filters', async () => {
      const expectedTags = [
        { id: 'tag-menu', name: 'Menu', color: 'green', contentCount: 3 },
      ];
      mockContentService.listContentTags.mockResolvedValue(expectedTags as any);

      const result = await controller.listContentTags(organizationId);

      expect(result).toEqual(expectedTags);
      expect(mockContentService.listContentTags).toHaveBeenCalledWith(organizationId);
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

  // ============================================================================
  // FILE REPLACEMENT
  // ============================================================================

  describe('replaceFile', () => {
    const mockFile: Express.Multer.File = {
      buffer: Buffer.from('test-content'),
      originalname: 'new-image.jpg',
      mimetype: 'image/jpeg',
      size: 2048,
    } as any;

    beforeEach(() => {
      mockFileValidationService.validateFile.mockResolvedValue({
        hash: 'newHash123',
        mimeType: 'image/jpeg',
      });
      (mockFileValidationService as any).validateFileAtPath.mockResolvedValue({
        hash: 'newHash123',
        mimeType: 'image/jpeg',
      });
      mockFileValidationService.sanitizeFilename.mockReturnValue('new-image.jpg');
      mockContentService.findOne.mockResolvedValue({
        id: 'content-123',
        name: 'old-image.jpg',
        fileSize: 1024,
      } as any);
      mockContentService.replaceFile.mockResolvedValue({
        id: 'content-123',
        name: 'new-image.jpg',
        url: 'http://localhost:3000/uploads/newHash123-new-image.jpg',
        versionNumber: 2,
      } as any);

      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      jest.spyOn(require('fs'), 'mkdirSync').mockReturnValue(undefined);
      jest.spyOn(require('fs'), 'writeFileSync').mockReturnValue(undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should throw BadRequestException when no file provided', async () => {
      await expect(
        controller.replaceFile(organizationId, 'content-123', null as any, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should replace file successfully', async () => {
      const result = await controller.replaceFile(
        organizationId,
        'content-123',
        mockFile,
        { keepBackup: true },
      );

      expect(result.content).toBeDefined();
      expect(result.fileHash).toBe('newHash123');
    });

    it('should validate file before replacing', async () => {
      await controller.replaceFile(organizationId, 'content-123', mockFile, {});

      expect(mockFileValidationService.validateFile).toHaveBeenCalledWith(
        mockFile.buffer,
        mockFile.originalname,
        mockFile.mimetype,
      );
    });

    it('should validate and upload disk-backed replacement files without using file.buffer', async () => {
      const diskFile = {
        path: path.join(os.tmpdir(), 'vizora-content-uploads', 'replacement-disk.jpg'),
        originalname: 'replacement-disk.jpg',
        mimetype: 'image/jpeg',
        size: 2048,
      } as Express.Multer.File;
      mockStorageService.isMinioAvailable.mockReturnValueOnce(true);
      mockStorageService.generateObjectKey.mockReturnValueOnce('org-123/uploads/replacement-disk.jpg');
      const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      await controller.replaceFile(organizationId, 'content-123', diskFile, {});

      expect((mockFileValidationService as any).validateFileAtPath).toHaveBeenCalledWith(
        diskFile.path,
        diskFile.originalname,
        diskFile.mimetype,
        diskFile.size,
      );
      expect(mockFileValidationService.validateFile).not.toHaveBeenCalled();
      expect((mockStorageService as any).uploadFileFromPath).toHaveBeenCalledWith(
        diskFile.path,
        'org-123/uploads/replacement-disk.jpg',
        diskFile.mimetype,
        diskFile.size,
      );
      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      await new Promise(resolve => setImmediate(resolve));
      expect(unlinkSpy).toHaveBeenCalledWith(diskFile.path);
      unlinkSpy.mockRestore();
    });

    it('should clean disk-backed replacement temp files when validation fails before quota reservation', async () => {
      const diskFile = {
        path: path.join(os.tmpdir(), 'vizora-content-uploads', 'invalid-replacement.jpg'),
        originalname: 'invalid-replacement.jpg',
        mimetype: 'image/jpeg',
        size: 2048,
      } as Express.Multer.File;
      (mockFileValidationService as any).validateFileAtPath.mockRejectedValueOnce(
        new BadRequestException('Invalid file'),
      );
      const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      await expect(controller.replaceFile(organizationId, 'content-123', diskFile, {}))
        .rejects.toThrow('Invalid file');

      expect(mockStorageQuotaService.reserveQuota).not.toHaveBeenCalled();
      expect(unlinkSpy).toHaveBeenCalledWith(diskFile.path);
      unlinkSpy.mockRestore();
    });

    it('should not reserve additional quota when replacement validation fails', async () => {
      mockFileValidationService.validateFile.mockRejectedValueOnce(new BadRequestException('Invalid file'));

      await expect(controller.replaceFile(organizationId, 'content-123', mockFile, {})).rejects.toThrow(
        BadRequestException,
      );

      expect(mockStorageQuotaService.reserveQuota).not.toHaveBeenCalled();
      expect(mockStorageQuotaService.decrementUsage).not.toHaveBeenCalled();
    });

    it('keeps replacement quota reserved when uploaded replacement cleanup fails after service failure', async () => {
      mockStorageService.isMinioAvailable.mockReturnValueOnce(true);
      mockStorageService.generateObjectKey.mockReturnValueOnce('org-123/uploads/replacement.jpg');
      mockContentService.replaceFile.mockRejectedValueOnce(new Error('db write failed'));
      mockStorageService.deleteFile.mockRejectedValueOnce(new Error('delete failed'));

      await expect(controller.replaceFile(organizationId, 'content-123', mockFile, {})).rejects.toThrow(
        'db write failed',
      );

      expect(mockStorageQuotaService.reserveQuota).toHaveBeenCalledWith(organizationId, 1024);
      expect(mockStorageQuotaService.decrementUsage).not.toHaveBeenCalledWith(organizationId, 1024);
    });

    it('should sanitize filename', async () => {
      await controller.replaceFile(organizationId, 'content-123', mockFile, {});

      expect(mockFileValidationService.sanitizeFilename).toHaveBeenCalledWith(mockFile.originalname);
    });

    it('should pass keepBackup option to service', async () => {
      await controller.replaceFile(organizationId, 'content-123', mockFile, { keepBackup: true });

      expect(mockStorageQuotaService.reserveQuota).toHaveBeenCalledWith(organizationId, mockFile.size);
      expect(mockContentService.replaceFile).toHaveBeenCalledWith(
        organizationId,
        'content-123',
        expect.any(String),
        expect.objectContaining({ keepBackup: true }),
      );
    });

    it('should not decrement quota for smaller keepBackup replacement because the old file is retained', async () => {
      mockContentService.findOne.mockResolvedValueOnce({
        id: 'content-123',
        name: 'old-image.jpg',
        fileSize: 4096,
      } as any);

      await controller.replaceFile(organizationId, 'content-123', mockFile, { keepBackup: true });

      expect(mockStorageQuotaService.reserveQuota).toHaveBeenCalledWith(organizationId, mockFile.size);
      expect(mockStorageQuotaService.decrementUsage).not.toHaveBeenCalledWith(
        organizationId,
        expect.any(Number),
      );
    });

    it('should pass custom name to service', async () => {
      await controller.replaceFile(organizationId, 'content-123', mockFile, { name: 'Custom Name' });

      expect(mockContentService.replaceFile).toHaveBeenCalledWith(
        organizationId,
        'content-123',
        expect.any(String),
        expect.objectContaining({ name: 'Custom Name' }),
      );
    });

    it('should fire-and-forget thumbnail generation for image files', async () => {
      await controller.replaceFile(organizationId, 'content-123', mockFile, {});

      // replaceFile no longer passes thumbnail — it's generated in background
      expect(mockContentService.replaceFile).toHaveBeenCalledWith(
        organizationId,
        'content-123',
        expect.any(String),
        expect.not.objectContaining({ thumbnail: expect.any(String) }),
      );

      // Thumbnail is generated fire-and-forget
      expect(mockThumbnailService.generateThumbnail).toHaveBeenCalledWith(
        'content-123',
        mockFile.buffer,
        mockFile.mimetype,
      );

      // Allow the fire-and-forget promise to resolve
      await new Promise(resolve => setImmediate(resolve));

      expect(mockContentService.update).toHaveBeenCalledWith(
        organizationId,
        'content-123',
        expect.objectContaining({ thumbnail: expect.any(String) }),
      );
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history', async () => {
      const versions = [
        { id: 'v3', versionNumber: 3 },
        { id: 'v2', versionNumber: 2 },
        { id: 'v1', versionNumber: 1 },
      ];
      mockContentService.getVersionHistory.mockResolvedValue(versions as any);

      const result = await controller.getVersionHistory(organizationId, 'v3');

      expect(result).toEqual(versions);
      expect(mockContentService.getVersionHistory).toHaveBeenCalledWith(organizationId, 'v3');
    });
  });

  describe('restore', () => {
    it('should restore archived content', async () => {
      const restoredContent = { id: 'content-123', status: 'active' };
      mockContentService.restore.mockResolvedValue(restoredContent as any);

      const result = await controller.restore(organizationId, 'content-123');

      expect(result).toEqual(restoredContent);
      expect(mockContentService.restore).toHaveBeenCalledWith(organizationId, 'content-123');
    });
  });

  // ============================================================================
  // CONTENT EXPIRATION
  // ============================================================================

  describe('setExpiration', () => {
    it('should set expiration date', async () => {
      const expectedResult = { id: 'content-123', expiresAt: '2099-12-31T00:00:00Z' };
      mockContentService.setExpiration.mockResolvedValue(expectedResult as any);

      const result = await controller.setExpiration(
        organizationId,
        'content-123',
        { expiresAt: '2099-12-31T00:00:00Z' },
      );

      expect(result).toEqual(expectedResult);
      expect(mockContentService.setExpiration).toHaveBeenCalledWith(
        organizationId,
        'content-123',
        expect.any(Date),
        undefined,
      );
    });

    it('should set expiration with replacement content', async () => {
      const expectedResult = {
        id: 'content-123',
        expiresAt: '2099-12-31T00:00:00Z',
        replacementContentId: 'replacement-123',
      };
      mockContentService.setExpiration.mockResolvedValue(expectedResult as any);

      const result = await controller.setExpiration(
        organizationId,
        'content-123',
        { expiresAt: '2099-12-31T00:00:00Z', replacementContentId: 'replacement-123' },
      );

      expect(result).toEqual(expectedResult);
      expect(mockContentService.setExpiration).toHaveBeenCalledWith(
        organizationId,
        'content-123',
        expect.any(Date),
        'replacement-123',
      );
    });
  });

  describe('clearExpiration', () => {
    it('should clear expiration', async () => {
      const expectedResult = { id: 'content-123', expiresAt: null, replacementContentId: null };
      mockContentService.clearExpiration.mockResolvedValue(expectedResult as any);

      const result = await controller.clearExpiration(organizationId, 'content-123');

      expect(result).toEqual(expectedResult);
      expect(mockContentService.clearExpiration).toHaveBeenCalledWith(organizationId, 'content-123');
    });
  });

});
