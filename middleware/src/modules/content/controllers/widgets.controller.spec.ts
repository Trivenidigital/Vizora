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
      findAllWidgets: jest.fn(),
      getWidgetTypes: jest.fn(),
      createWidget: jest.fn(),
      updateWidget: jest.fn(),
      refreshWidget: jest.fn(),
      getWeatherPreview: jest.fn(),
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
  // findAll
  // ==========================================================================

  describe('findAll', () => {
    it('should return paginated widgets', async () => {
      const expectedResult = {
        data: [{ id: 'widget-1', name: 'Clock', type: 'template' }],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockContentService.findAllWidgets.mockResolvedValue(expectedResult as any);

      const pagination = { page: 1, limit: 10 } as any;
      const result = await controller.findAll(organizationId, pagination);

      expect(result).toEqual(expectedResult);
      expect(mockContentService.findAllWidgets).toHaveBeenCalledWith(organizationId, pagination);
    });

    it('should return empty results when no widgets exist', async () => {
      const expectedResult = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      mockContentService.findAllWidgets.mockResolvedValue(expectedResult as any);

      const pagination = { page: 1, limit: 10 } as any;
      const result = await controller.findAll(organizationId, pagination);

      expect(result).toEqual(expectedResult);
    });
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
  // getWeatherPreview
  // ==========================================================================

  describe('getWeatherPreview', () => {
    it('should return weather data for a location', async () => {
      const weatherData = {
        current: { temp: 22, description: 'partly cloudy' },
        location: { name: 'New York', country: 'US' },
      };
      mockContentService.getWeatherPreview.mockResolvedValue(weatherData);

      const result = await controller.getWeatherPreview('New York', 'metric');

      expect(result).toEqual(weatherData);
      expect(mockContentService.getWeatherPreview).toHaveBeenCalledWith('New York', 'metric');
    });

    it('should default to New York when no location provided', async () => {
      mockContentService.getWeatherPreview.mockResolvedValue({});

      await controller.getWeatherPreview(undefined as any, 'metric');

      expect(mockContentService.getWeatherPreview).toHaveBeenCalledWith('New York', 'metric');
    });

    it('should default to metric units', async () => {
      mockContentService.getWeatherPreview.mockResolvedValue({});

      await controller.getWeatherPreview('London', undefined as any);

      expect(mockContentService.getWeatherPreview).toHaveBeenCalledWith('London', 'metric');
    });

    it('should propagate service errors', async () => {
      mockContentService.getWeatherPreview.mockRejectedValue(new Error('Weather API failed'));

      await expect(
        controller.getWeatherPreview('Invalid', 'metric'),
      ).rejects.toThrow('Weather API failed');
    });
  });

  // ==========================================================================
  // getSheetData (sheets/preview)
  // ==========================================================================

  describe('getSheetData', () => {
    it('should reject a missing URL', async () => {
      await expect(controller.getSheetData('', 'Sheet1')).rejects.toThrow('Invalid Google Sheets URL');
    });

    it('should reject a non-Google-Sheets URL', async () => {
      await expect(
        controller.getSheetData('https://evil.com/spreadsheets/d/abc123', 'Sheet1'),
      ).rejects.toThrow('Invalid Google Sheets URL');
    });

    it('should reject a URL whose hostname is not docs.google.com', async () => {
      await expect(
        controller.getSheetData('https://notgoogle.com/docs.google.com/spreadsheets/d/abc123/edit', 'Sheet1'),
      ).rejects.toThrow('Only Google Sheets URLs are supported');
    });

    it('should reject a URL with no extractable sheet ID', async () => {
      await expect(
        controller.getSheetData('https://docs.google.com/spreadsheets/', 'Sheet1'),
      ).rejects.toThrow('Could not extract sheet ID from URL');
    });

    it('should fetch and return parsed sheet data', async () => {
      const mockGoogleResponse = `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({
        table: {
          cols: [{ id: 'A', label: 'Name' }, { id: 'B', label: 'Price' }],
          rows: [
            { c: [{ v: 'Widget' }, { v: 9.99 }] },
            { c: [{ v: 'Gadget' }, { v: 19.99 }] },
          ],
        },
      })});`;

      const originalFetch = global.fetch;
      const responseBuffer = new TextEncoder().encode(mockGoogleResponse).buffer;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-length': String(responseBuffer.byteLength) }),
        arrayBuffer: () => Promise.resolve(responseBuffer),
      }) as any;

      try {
        const result = await controller.getSheetData(
          'https://docs.google.com/spreadsheets/d/abc123xyz/edit',
          'Sheet1',
        );

        expect(result.sheetId).toBe('abc123xyz');
        expect(result.sheetName).toBe('Sheet1');
        expect(result.headers).toEqual(['Name', 'Price']);
        expect(result.rows).toEqual([['Widget', 9.99], ['Gadget', 19.99]]);
        expect(result.rowCount).toBe(2);
        expect(result.fetchedAt).toBeDefined();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should reject oversized responses via content-length header', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-length': String(3 * 1024 * 1024) }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(3 * 1024 * 1024)),
      }) as any;

      try {
        await expect(
          controller.getSheetData('https://docs.google.com/spreadsheets/d/abc123/edit', 'Sheet1'),
        ).rejects.toThrow('Sheet data too large (max 2MB)');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should reject oversized responses detected after download', async () => {
      const originalFetch = global.fetch;
      const oversized = new ArrayBuffer(2.5 * 1024 * 1024);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        // No content-length header — size discovered after download
        headers: new Headers({}),
        arrayBuffer: () => Promise.resolve(oversized),
      }) as any;

      try {
        await expect(
          controller.getSheetData('https://docs.google.com/spreadsheets/d/abc123/edit', 'Sheet1'),
        ).rejects.toThrow('Sheet data too large (max 2MB)');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should reject malformed response that does not match Google wrapper format', async () => {
      const originalFetch = global.fetch;
      const badResponse = 'this is not a google visualization response';
      const responseBuffer = new TextEncoder().encode(badResponse).buffer;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-length': String(responseBuffer.byteLength) }),
        arrayBuffer: () => Promise.resolve(responseBuffer),
      }) as any;

      try {
        await expect(
          controller.getSheetData('https://docs.google.com/spreadsheets/d/abc123/edit', 'Sheet1'),
        ).rejects.toThrow('Invalid response format');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw NotFoundException when response is not ok', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({}),
      }) as any;

      try {
        await expect(
          controller.getSheetData('https://docs.google.com/spreadsheets/d/abc123/edit', 'Sheet1'),
        ).rejects.toThrow('Could not fetch sheet data');
      } finally {
        global.fetch = originalFetch;
      }
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
