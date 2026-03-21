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

  // ==========================================================================
  // getRssFeed
  // ==========================================================================

  describe('getRssFeed', () => {
    const mockFetchOriginal = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = mockFetchOriginal;
    });

    it('should throw BadRequestException when url is missing', async () => {
      await expect(
        controller.getRssFeed(undefined as any, '10'),
      ).rejects.toThrow('url parameter is required');
    });

    it('should throw BadRequestException for invalid URL', async () => {
      await expect(
        controller.getRssFeed('not-a-url', '10'),
      ).rejects.toThrow('Invalid URL format');
    });

    it('should throw BadRequestException for non-http protocols', async () => {
      await expect(
        controller.getRssFeed('ftp://example.com/feed', '10'),
      ).rejects.toThrow('Only http/https URLs are supported');
    });

    it('should fetch and parse an RSS feed successfully', async () => {
      const rssXml = `<rss><channel>
        <title>Test Feed</title>
        <item><title>Article 1</title><description>Desc</description><link>https://example.com/1</link></item>
      </channel></rss>`;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Map([['content-length', '0']]),
        text: async () => rssXml,
      });

      const result = await controller.getRssFeed('https://example.com/rss', '10');

      expect(result.feedTitle).toBe('Test Feed');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Article 1');
      expect(result.fetchedAt).toBeDefined();
    });

    it('should respect the limit parameter', async () => {
      const rssXml = `<rss><channel><title>Feed</title>
        <item><title>A1</title><description>D1</description></item>
        <item><title>A2</title><description>D2</description></item>
        <item><title>A3</title><description>D3</description></item>
      </channel></rss>`;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Map([['content-length', '0']]),
        text: async () => rssXml,
      });

      const result = await controller.getRssFeed('https://example.com/rss', '2');
      expect(result.items).toHaveLength(2);
    });

    it('should throw NotFoundException when fetch fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(
        controller.getRssFeed('https://example.com/rss', '10'),
      ).rejects.toThrow('Failed to fetch RSS feed: HTTP 404');
    });

    it('should throw NotFoundException on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      await expect(
        controller.getRssFeed('https://example.com/rss', '10'),
      ).rejects.toThrow('Failed to fetch RSS feed: Network timeout');
    });
  });
});
