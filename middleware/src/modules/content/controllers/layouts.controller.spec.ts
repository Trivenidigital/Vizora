jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { LayoutsController } from './layouts.controller';
import { ContentService } from '../content.service';

describe('LayoutsController', () => {
  let controller: LayoutsController;
  let mockContentService: jest.Mocked<ContentService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockContentService = {
      findAllLayouts: jest.fn(),
      getLayoutPresets: jest.fn(),
      createLayout: jest.fn(),
      updateLayout: jest.fn(),
      getResolvedLayout: jest.fn(),
      remove: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LayoutsController],
      providers: [
        { provide: ContentService, useValue: mockContentService },
      ],
    }).compile();

    controller = module.get<LayoutsController>(LayoutsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================================================================
  // findAll
  // ==========================================================================

  describe('findAll', () => {
    it('should return paginated layouts', async () => {
      const expectedResult = {
        data: [{ id: 'layout-1', name: 'Split View', type: 'layout' }],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockContentService.findAllLayouts.mockResolvedValue(expectedResult as any);

      const pagination = { page: 1, limit: 10 } as any;
      const result = await controller.findAll(organizationId, pagination);

      expect(result).toEqual(expectedResult);
      expect(mockContentService.findAllLayouts).toHaveBeenCalledWith(organizationId, pagination);
    });

    it('should return empty results when no layouts exist', async () => {
      const expectedResult = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      mockContentService.findAllLayouts.mockResolvedValue(expectedResult as any);

      const pagination = { page: 1, limit: 10 } as any;
      const result = await controller.findAll(organizationId, pagination);

      expect(result).toEqual(expectedResult);
    });
  });

  // ==========================================================================
  // getLayoutPresets
  // ==========================================================================

  describe('getLayoutPresets', () => {
    it('should return available layout presets', () => {
      const presets = [
        { id: 'single', name: 'Single Zone', zones: 1 },
        { id: 'split-h', name: 'Horizontal Split', zones: 2 },
        { id: 'grid-4', name: '4-Zone Grid', zones: 4 },
      ];
      mockContentService.getLayoutPresets.mockReturnValue(presets as any);

      const result = controller.getLayoutPresets();

      expect(result).toEqual(presets);
      expect(mockContentService.getLayoutPresets).toHaveBeenCalled();
    });

    it('should return empty array when no presets exist', () => {
      mockContentService.getLayoutPresets.mockReturnValue([] as any);

      const result = controller.getLayoutPresets();

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // createLayout
  // ==========================================================================

  describe('createLayout', () => {
    const createLayoutDto = {
      name: 'Lobby Display',
      preset: 'split-h',
      zones: [
        { id: 'zone-1', width: 50, height: 100, x: 0, y: 0 },
        { id: 'zone-2', width: 50, height: 100, x: 50, y: 0 },
      ],
    };

    it('should create a layout successfully', async () => {
      const expectedLayout = { id: 'layout-123', ...createLayoutDto };
      mockContentService.createLayout.mockResolvedValue(expectedLayout as any);

      const result = await controller.createLayout(organizationId, createLayoutDto as any);

      expect(result).toEqual(expectedLayout);
      expect(mockContentService.createLayout).toHaveBeenCalledWith(organizationId, createLayoutDto);
    });

    it('should pass organization id to service', async () => {
      mockContentService.createLayout.mockResolvedValue({ id: 'layout-123' } as any);

      await controller.createLayout('org-456', createLayoutDto as any);

      expect(mockContentService.createLayout).toHaveBeenCalledWith('org-456', createLayoutDto);
    });

    it('should propagate service errors', async () => {
      mockContentService.createLayout.mockRejectedValue(new Error('Invalid layout configuration'));

      await expect(
        controller.createLayout(organizationId, createLayoutDto as any),
      ).rejects.toThrow('Invalid layout configuration');
    });
  });

  // ==========================================================================
  // updateLayout
  // ==========================================================================

  describe('updateLayout', () => {
    const updateDto = { name: 'Updated Lobby Layout' };

    it('should update a layout successfully', async () => {
      const expectedLayout = { id: 'layout-123', ...updateDto };
      mockContentService.updateLayout.mockResolvedValue(expectedLayout as any);

      const result = await controller.updateLayout(organizationId, 'layout-123', updateDto as any);

      expect(result).toEqual(expectedLayout);
      expect(mockContentService.updateLayout).toHaveBeenCalledWith(
        organizationId,
        'layout-123',
        updateDto,
      );
    });

    it('should handle partial updates with zone changes', async () => {
      const zoneUpdate = {
        zones: [{ id: 'zone-1', width: 70, height: 100, x: 0, y: 0 }],
      };
      mockContentService.updateLayout.mockResolvedValue({ id: 'layout-123', ...zoneUpdate } as any);

      await controller.updateLayout(organizationId, 'layout-123', zoneUpdate as any);

      expect(mockContentService.updateLayout).toHaveBeenCalledWith(
        organizationId,
        'layout-123',
        zoneUpdate,
      );
    });

    it('should propagate not found errors', async () => {
      mockContentService.updateLayout.mockRejectedValue(new Error('Layout not found'));

      await expect(
        controller.updateLayout(organizationId, 'nonexistent', updateDto as any),
      ).rejects.toThrow('Layout not found');
    });
  });

  // ==========================================================================
  // getResolvedLayout
  // ==========================================================================

  describe('getResolvedLayout', () => {
    it('should return a resolved layout with content', async () => {
      const resolvedLayout = {
        id: 'layout-123',
        name: 'Lobby Display',
        zones: [
          {
            id: 'zone-1',
            content: { id: 'content-1', name: 'Welcome Image', type: 'image' },
          },
          {
            id: 'zone-2',
            content: { id: 'content-2', name: 'News Feed', type: 'widget' },
          },
        ],
      };
      mockContentService.getResolvedLayout.mockResolvedValue(resolvedLayout as any);

      const result = await controller.getResolvedLayout(organizationId, 'layout-123');

      expect(result).toEqual(resolvedLayout);
      expect(mockContentService.getResolvedLayout).toHaveBeenCalledWith(organizationId, 'layout-123');
    });

    it('should propagate not found errors', async () => {
      mockContentService.getResolvedLayout.mockRejectedValue(new Error('Layout not found'));

      await expect(
        controller.getResolvedLayout(organizationId, 'nonexistent'),
      ).rejects.toThrow('Layout not found');
    });
  });

  // ==========================================================================
  // deleteLayout
  // ==========================================================================

  describe('deleteLayout', () => {
    it('should delete a layout successfully', async () => {
      mockContentService.remove.mockResolvedValue({ success: true } as any);

      const result = await controller.deleteLayout(organizationId, 'layout-123');

      expect(result).toEqual({ success: true });
      expect(mockContentService.remove).toHaveBeenCalledWith(organizationId, 'layout-123');
    });

    it('should propagate not found errors', async () => {
      mockContentService.remove.mockRejectedValue(new Error('Layout not found'));

      await expect(
        controller.deleteLayout(organizationId, 'nonexistent'),
      ).rejects.toThrow('Layout not found');
    });
  });
});
