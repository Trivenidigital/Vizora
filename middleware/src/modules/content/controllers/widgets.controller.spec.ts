jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { WidgetsController } from './widgets.controller';
import { ContentService } from '../content.service';

describe('WidgetsController', () => {
  let controller: WidgetsController;
  let mockContentService: jest.Mocked<ContentService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockContentService = {
      getWidgetTypes: jest.fn(),
      createWidget: jest.fn(),
      updateWidget: jest.fn(),
      refreshWidget: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WidgetsController],
      providers: [
        { provide: ContentService, useValue: mockContentService },
      ],
    }).compile();

    controller = module.get<WidgetsController>(WidgetsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================================================================
  // getWidgetTypes
  // ==========================================================================

  describe('getWidgetTypes', () => {
    it('should return available widget types', () => {
      const widgetTypes = [
        { type: 'clock', name: 'Clock', description: 'Displays current time' },
        { type: 'weather', name: 'Weather', description: 'Shows weather info' },
      ];
      mockContentService.getWidgetTypes.mockReturnValue(widgetTypes as any);

      const result = controller.getWidgetTypes();

      expect(result).toEqual(widgetTypes);
      expect(mockContentService.getWidgetTypes).toHaveBeenCalled();
    });

    it('should return empty array when no widget types exist', () => {
      mockContentService.getWidgetTypes.mockReturnValue([] as any);

      const result = controller.getWidgetTypes();

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // createWidget
  // ==========================================================================

  describe('createWidget', () => {
    const createWidgetDto = {
      name: 'Office Clock',
      widgetType: 'clock',
      config: { timezone: 'UTC', format: '24h' },
    };

    it('should create a widget successfully', async () => {
      const expectedWidget = { id: 'widget-123', ...createWidgetDto };
      mockContentService.createWidget.mockResolvedValue(expectedWidget as any);

      const result = await controller.createWidget(organizationId, createWidgetDto as any);

      expect(result).toEqual(expectedWidget);
      expect(mockContentService.createWidget).toHaveBeenCalledWith(organizationId, createWidgetDto);
    });

    it('should pass organization id to service', async () => {
      mockContentService.createWidget.mockResolvedValue({ id: 'widget-123' } as any);

      await controller.createWidget('org-456', createWidgetDto as any);

      expect(mockContentService.createWidget).toHaveBeenCalledWith('org-456', createWidgetDto);
    });

    it('should propagate service errors', async () => {
      mockContentService.createWidget.mockRejectedValue(new Error('Creation failed'));

      await expect(
        controller.createWidget(organizationId, createWidgetDto as any),
      ).rejects.toThrow('Creation failed');
    });
  });

  // ==========================================================================
  // updateWidget
  // ==========================================================================

  describe('updateWidget', () => {
    const updateDto = { name: 'Updated Clock', config: { timezone: 'EST' } };

    it('should update a widget successfully', async () => {
      const expectedWidget = { id: 'widget-123', ...updateDto };
      mockContentService.updateWidget.mockResolvedValue(expectedWidget as any);

      const result = await controller.updateWidget(organizationId, 'widget-123', updateDto as any);

      expect(result).toEqual(expectedWidget);
      expect(mockContentService.updateWidget).toHaveBeenCalledWith(
        organizationId,
        'widget-123',
        updateDto,
      );
    });

    it('should pass partial update dto', async () => {
      const partialDto = { name: 'Renamed Widget' };
      mockContentService.updateWidget.mockResolvedValue({ id: 'widget-123', ...partialDto } as any);

      await controller.updateWidget(organizationId, 'widget-123', partialDto as any);

      expect(mockContentService.updateWidget).toHaveBeenCalledWith(
        organizationId,
        'widget-123',
        partialDto,
      );
    });

    it('should propagate not found errors', async () => {
      mockContentService.updateWidget.mockRejectedValue(new Error('Widget not found'));

      await expect(
        controller.updateWidget(organizationId, 'nonexistent', updateDto as any),
      ).rejects.toThrow('Widget not found');
    });
  });

  // ==========================================================================
  // refreshWidget
  // ==========================================================================

  describe('refreshWidget', () => {
    it('should refresh a widget successfully', async () => {
      const expectedResult = { id: 'widget-123', refreshed: true };
      mockContentService.refreshWidget.mockResolvedValue(expectedResult as any);

      const result = await controller.refreshWidget(organizationId, 'widget-123');

      expect(result).toEqual(expectedResult);
      expect(mockContentService.refreshWidget).toHaveBeenCalledWith(organizationId, 'widget-123');
    });

    it('should propagate service errors on refresh', async () => {
      mockContentService.refreshWidget.mockRejectedValue(new Error('Refresh failed'));

      await expect(
        controller.refreshWidget(organizationId, 'widget-123'),
      ).rejects.toThrow('Refresh failed');
    });
  });
});
