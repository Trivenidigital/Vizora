jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BulkOperationsController } from './bulk-operations.controller';
import { ContentService } from '../content.service';

describe('BulkOperationsController', () => {
  let controller: BulkOperationsController;
  let mockContentService: jest.Mocked<ContentService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockContentService = {
      bulkUpdate: jest.fn(),
      bulkArchive: jest.fn(),
      bulkRestore: jest.fn(),
      bulkDelete: jest.fn(),
      bulkAddTags: jest.fn(),
      bulkSetDuration: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BulkOperationsController],
      providers: [
        { provide: ContentService, useValue: mockContentService },
      ],
    }).compile();

    controller = module.get<BulkOperationsController>(BulkOperationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================================================================
  // bulkUpdate
  // ==========================================================================

  describe('bulkUpdate', () => {
    const bulkUpdateDto = {
      ids: ['content-1', 'content-2', 'content-3'],
      updates: { status: 'active' },
    };

    it('should bulk update content successfully', async () => {
      const expectedResult = { updated: 3, ids: bulkUpdateDto.ids };
      mockContentService.bulkUpdate.mockResolvedValue(expectedResult as any);

      const result = await controller.bulkUpdate(organizationId, bulkUpdateDto as any);

      expect(result).toEqual(expectedResult);
      expect(mockContentService.bulkUpdate).toHaveBeenCalledWith(organizationId, bulkUpdateDto);
    });

    it('should pass organization id to service', async () => {
      mockContentService.bulkUpdate.mockResolvedValue({ updated: 1 } as any);

      await controller.bulkUpdate('org-456', bulkUpdateDto as any);

      expect(mockContentService.bulkUpdate).toHaveBeenCalledWith('org-456', bulkUpdateDto);
    });

    it('should propagate service errors', async () => {
      mockContentService.bulkUpdate.mockRejectedValue(new Error('Some items not found'));

      await expect(
        controller.bulkUpdate(organizationId, bulkUpdateDto as any),
      ).rejects.toThrow('Some items not found');
    });
  });

  // ==========================================================================
  // bulkArchive
  // ==========================================================================

  describe('bulkArchive', () => {
    const bulkArchiveDto = {
      ids: ['content-1', 'content-2'],
    };

    it('should bulk archive content successfully', async () => {
      const expectedResult = { archived: 2, ids: bulkArchiveDto.ids };
      mockContentService.bulkArchive.mockResolvedValue(expectedResult as any);

      const result = await controller.bulkArchive(organizationId, bulkArchiveDto as any);

      expect(result).toEqual(expectedResult);
      expect(mockContentService.bulkArchive).toHaveBeenCalledWith(organizationId, bulkArchiveDto);
    });

    it('should propagate service errors', async () => {
      mockContentService.bulkArchive.mockRejectedValue(new Error('Archive failed'));

      await expect(
        controller.bulkArchive(organizationId, bulkArchiveDto as any),
      ).rejects.toThrow('Archive failed');
    });
  });

  // ==========================================================================
  // bulkRestore
  // ==========================================================================

  describe('bulkRestore', () => {
    const bulkRestoreDto = {
      ids: ['content-1', 'content-2'],
    };

    it('should bulk restore content successfully', async () => {
      const expectedResult = { restored: 2, ids: bulkRestoreDto.ids };
      mockContentService.bulkRestore.mockResolvedValue(expectedResult as any);

      const result = await controller.bulkRestore(organizationId, bulkRestoreDto as any);

      expect(result).toEqual(expectedResult);
      expect(mockContentService.bulkRestore).toHaveBeenCalledWith(organizationId, bulkRestoreDto);
    });

    it('should propagate service errors', async () => {
      mockContentService.bulkRestore.mockRejectedValue(new Error('Restore failed'));

      await expect(
        controller.bulkRestore(organizationId, bulkRestoreDto as any),
      ).rejects.toThrow('Restore failed');
    });
  });

  // ==========================================================================
  // bulkDelete
  // ==========================================================================

  describe('bulkDelete', () => {
    const bulkDeleteDto = {
      ids: ['content-1', 'content-2', 'content-3'],
    };

    it('should bulk delete content successfully', async () => {
      const expectedResult = { deleted: 3, ids: bulkDeleteDto.ids };
      mockContentService.bulkDelete.mockResolvedValue(expectedResult as any);

      const result = await controller.bulkDelete(organizationId, bulkDeleteDto as any);

      expect(result).toEqual(expectedResult);
      expect(mockContentService.bulkDelete).toHaveBeenCalledWith(organizationId, bulkDeleteDto);
    });

    it('should pass organization id to service', async () => {
      mockContentService.bulkDelete.mockResolvedValue({ deleted: 1 } as any);

      await controller.bulkDelete('org-789', bulkDeleteDto as any);

      expect(mockContentService.bulkDelete).toHaveBeenCalledWith('org-789', bulkDeleteDto);
    });

    it('should propagate service errors', async () => {
      mockContentService.bulkDelete.mockRejectedValue(
        new Error('Cannot delete content in active playlists'),
      );

      await expect(
        controller.bulkDelete(organizationId, bulkDeleteDto as any),
      ).rejects.toThrow('Cannot delete content in active playlists');
    });
  });

  // ==========================================================================
  // bulkAddTags
  // ==========================================================================

  describe('bulkAddTags', () => {
    const bulkTagDto = {
      ids: ['content-1', 'content-2'],
      tags: ['promotional', 'holiday'],
    };

    it('should bulk add tags successfully', async () => {
      const expectedResult = { updated: 2, tags: bulkTagDto.tags };
      mockContentService.bulkAddTags.mockResolvedValue(expectedResult as any);

      const result = await controller.bulkAddTags(organizationId, bulkTagDto as any);

      expect(result).toEqual(expectedResult);
      expect(mockContentService.bulkAddTags).toHaveBeenCalledWith(organizationId, bulkTagDto);
    });

    it('should propagate service errors', async () => {
      mockContentService.bulkAddTags.mockRejectedValue(new Error('Invalid tag format'));

      await expect(
        controller.bulkAddTags(organizationId, bulkTagDto as any),
      ).rejects.toThrow('Invalid tag format');
    });
  });

  // ==========================================================================
  // bulkSetDuration
  // ==========================================================================

  describe('bulkSetDuration', () => {
    const bulkDurationDto = {
      ids: ['content-1', 'content-2', 'content-3'],
      duration: 30,
    };

    it('should bulk set duration successfully', async () => {
      const expectedResult = { updated: 3, duration: 30 };
      mockContentService.bulkSetDuration.mockResolvedValue(expectedResult as any);

      const result = await controller.bulkSetDuration(organizationId, bulkDurationDto as any);

      expect(result).toEqual(expectedResult);
      expect(mockContentService.bulkSetDuration).toHaveBeenCalledWith(
        organizationId,
        bulkDurationDto,
      );
    });

    it('should pass organization id to service', async () => {
      mockContentService.bulkSetDuration.mockResolvedValue({ updated: 1 } as any);

      await controller.bulkSetDuration('org-456', bulkDurationDto as any);

      expect(mockContentService.bulkSetDuration).toHaveBeenCalledWith('org-456', bulkDurationDto);
    });

    it('should propagate service errors', async () => {
      mockContentService.bulkSetDuration.mockRejectedValue(
        new Error('Duration must be positive'),
      );

      await expect(
        controller.bulkSetDuration(organizationId, bulkDurationDto as any),
      ).rejects.toThrow('Duration must be positive');
    });
  });
});
