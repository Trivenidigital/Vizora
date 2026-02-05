// Mock isomorphic-dompurify before importing services
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
  },
}));

import { TemplateRefreshService } from './template-refresh.service';
import { TemplateRenderingService } from './template-rendering.service';
import { DatabaseService } from '../database/database.service';
import { TemplateMetadata } from './content.service';

describe('TemplateRefreshService', () => {
  let service: TemplateRefreshService;
  let mockDb: any;
  let mockTemplateRendering: jest.Mocked<TemplateRenderingService>;

  const createMockTemplate = (overrides: Partial<any> = {}) => ({
    id: 'template-123',
    name: 'Test Template',
    type: 'template',
    status: 'active',
    organizationId: 'org-123',
    metadata: {
      templateHtml: '<h1>{{title}}</h1>',
      dataSource: {
        type: 'manual',
        manualData: { title: 'Test' },
      },
      refreshConfig: {
        enabled: true,
        intervalMinutes: 15,
        lastRefresh: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 minutes ago
      },
      sampleData: { title: 'Sample' },
      renderedHtml: '<h1>Old Content</h1>',
      renderedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    } as TemplateMetadata,
    ...overrides,
  });

  beforeEach(() => {
    mockDb = {
      content: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    mockTemplateRendering = {
      renderTemplate: jest.fn(),
      fetchDataFromSource: jest.fn(),
      validateTemplate: jest.fn(),
      sanitizeHtml: jest.fn(),
      processTemplate: jest.fn(),
    } as any;

    service = new TemplateRefreshService(
      mockDb as DatabaseService,
      mockTemplateRendering,
    );
  });

  describe('processTemplateRefresh', () => {
    it('should process templates due for refresh', async () => {
      const template = createMockTemplate();
      mockDb.content.findMany.mockResolvedValue([template]);
      mockDb.content.findUnique.mockResolvedValue(template);
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>New Content</h1>');
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({ title: 'New' });
      mockDb.content.update.mockResolvedValue({ ...template });

      const result = await service.processTemplateRefresh();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockDb.content.update).toHaveBeenCalled();
    });

    it('should skip templates with refresh disabled', async () => {
      const template = createMockTemplate({
        metadata: {
          ...createMockTemplate().metadata,
          refreshConfig: {
            enabled: false,
            intervalMinutes: 15,
          },
        },
      });
      mockDb.content.findMany.mockResolvedValue([template]);

      const result = await service.processTemplateRefresh();

      expect(result.processed).toBe(0);
      expect(mockDb.content.update).not.toHaveBeenCalled();
    });

    it('should skip templates not yet due for refresh', async () => {
      const template = createMockTemplate({
        metadata: {
          ...createMockTemplate().metadata,
          refreshConfig: {
            enabled: true,
            intervalMinutes: 15,
            lastRefresh: new Date().toISOString(), // Just refreshed
          },
        },
      });
      mockDb.content.findMany.mockResolvedValue([template]);

      const result = await service.processTemplateRefresh();

      expect(result.processed).toBe(0);
    });

    it('should refresh templates that have never been refreshed', async () => {
      const template = createMockTemplate({
        metadata: {
          ...createMockTemplate().metadata,
          refreshConfig: {
            enabled: true,
            intervalMinutes: 15,
            // No lastRefresh - never refreshed
          },
        },
      });
      mockDb.content.findMany.mockResolvedValue([template]);
      mockDb.content.findUnique.mockResolvedValue(template);
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Content</h1>');
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({});
      mockDb.content.update.mockResolvedValue({ ...template });

      const result = await service.processTemplateRefresh();

      expect(result.processed).toBe(1);
    });

    it('should count errors when refresh fails', async () => {
      // Use REST API data source to trigger fetchDataFromSource
      const template = createMockTemplate({
        metadata: {
          ...createMockTemplate().metadata,
          dataSource: {
            type: 'rest_api',
            url: 'https://api.example.com/data',
          },
        },
      });
      mockDb.content.findMany.mockResolvedValue([template]);
      mockDb.content.findUnique.mockResolvedValue(template);
      mockTemplateRendering.fetchDataFromSource.mockRejectedValue(new Error('API Error'));
      mockDb.content.update.mockResolvedValue({ ...template });

      const result = await service.processTemplateRefresh();

      expect(result.errors).toBe(1);
    });

    it('should process multiple templates', async () => {
      const templates = [
        createMockTemplate({ id: 'template-1' }),
        createMockTemplate({ id: 'template-2' }),
        createMockTemplate({ id: 'template-3' }),
      ];
      mockDb.content.findMany.mockResolvedValue(templates);
      mockDb.content.findUnique.mockImplementation(({ where }) => {
        return Promise.resolve(templates.find((t) => t.id === where.id));
      });
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Content</h1>');
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({});
      mockDb.content.update.mockResolvedValue({});

      const result = await service.processTemplateRefresh();

      expect(result.processed).toBe(3);
    });

    it('should only find active templates', async () => {
      mockDb.content.findMany.mockResolvedValue([]);

      await service.processTemplateRefresh();

      expect(mockDb.content.findMany).toHaveBeenCalledWith({
        where: {
          type: 'template',
          status: 'active',
        },
      });
    });

    it('should handle empty template list', async () => {
      mockDb.content.findMany.mockResolvedValue([]);

      const result = await service.processTemplateRefresh();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should handle database error gracefully', async () => {
      mockDb.content.findMany.mockRejectedValue(new Error('Database error'));

      const result = await service.processTemplateRefresh();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(0); // Error is caught at the job level
    });

    it('should skip templates without metadata', async () => {
      const template = createMockTemplate({ metadata: null });
      mockDb.content.findMany.mockResolvedValue([template]);

      const result = await service.processTemplateRefresh();

      expect(result.processed).toBe(0);
    });
  });

  describe('refreshTemplate', () => {
    it('should refresh template with manual data source', async () => {
      const template = createMockTemplate();
      mockDb.content.findUnique.mockResolvedValue(template);
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Refreshed</h1>');
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({ title: 'Test' });
      mockDb.content.update.mockResolvedValue({});

      await service.refreshTemplate('template-123');

      expect(mockDb.content.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: {
          metadata: expect.objectContaining({
            renderedHtml: '<h1>Refreshed</h1>',
            refreshConfig: expect.objectContaining({
              lastRefresh: expect.any(String),
              lastError: undefined,
            }),
          }),
        },
      });
    });

    it('should refresh template with REST API data source', async () => {
      const template = createMockTemplate({
        metadata: {
          ...createMockTemplate().metadata,
          dataSource: {
            type: 'rest_api',
            url: 'https://api.example.com/data',
            method: 'GET',
          },
        },
      });
      mockDb.content.findUnique.mockResolvedValue(template);
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({ title: 'API Data' });
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>API Data</h1>');
      mockDb.content.update.mockResolvedValue({});

      await service.refreshTemplate('template-123');

      expect(mockTemplateRendering.fetchDataFromSource).toHaveBeenCalledWith({
        type: 'rest_api',
        url: 'https://api.example.com/data',
        method: 'GET',
      });
    });

    it('should throw error if content is not found', async () => {
      mockDb.content.findUnique.mockResolvedValue(null);

      await expect(service.refreshTemplate('nonexistent')).rejects.toThrow(
        'Content nonexistent is not a template',
      );
    });

    it('should throw error if content is not a template', async () => {
      mockDb.content.findUnique.mockResolvedValue({
        id: 'image-123',
        type: 'image',
      });

      await expect(service.refreshTemplate('image-123')).rejects.toThrow(
        'Content image-123 is not a template',
      );
    });

    it('should throw error if template has no HTML', async () => {
      const template = createMockTemplate({
        metadata: {
          ...createMockTemplate().metadata,
          templateHtml: null,
        },
      });
      mockDb.content.findUnique.mockResolvedValue(template);

      await expect(service.refreshTemplate('template-123')).rejects.toThrow(
        'Template template-123 has no HTML',
      );
    });

    it('should update metadata with error on fetch failure', async () => {
      const template = createMockTemplate({
        metadata: {
          ...createMockTemplate().metadata,
          dataSource: {
            type: 'rest_api',
            url: 'https://api.example.com/data',
          },
        },
      });
      mockDb.content.findUnique.mockResolvedValue(template);
      mockTemplateRendering.fetchDataFromSource.mockRejectedValue(
        new Error('API unavailable'),
      );
      mockDb.content.update.mockResolvedValue({});

      await expect(service.refreshTemplate('template-123')).rejects.toThrow(
        'API unavailable',
      );

      expect(mockDb.content.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: {
          metadata: expect.objectContaining({
            refreshConfig: expect.objectContaining({
              lastError: 'API unavailable',
            }),
          }),
        },
      });
    });

    it('should preserve old rendered HTML on error', async () => {
      // Use REST API data source to trigger fetchDataFromSource
      const template = createMockTemplate({
        metadata: {
          ...createMockTemplate().metadata,
          dataSource: {
            type: 'rest_api',
            url: 'https://api.example.com/data',
          },
        },
      });
      mockDb.content.findUnique.mockResolvedValue(template);
      mockTemplateRendering.fetchDataFromSource.mockRejectedValue(
        new Error('Failed'),
      );
      mockDb.content.update.mockResolvedValue({});

      await expect(service.refreshTemplate('template-123')).rejects.toThrow();

      expect(mockDb.content.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: {
          metadata: expect.objectContaining({
            renderedHtml: '<h1>Old Content</h1>', // Preserved
          }),
        },
      });
    });

    it('should use sample data as fallback', async () => {
      const template = createMockTemplate();
      mockDb.content.findUnique.mockResolvedValue(template);
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({});
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Sample</h1>');
      mockDb.content.update.mockResolvedValue({});

      await service.refreshTemplate('template-123');

      // When fetchDataFromSource returns empty, sample data should be used
      expect(mockTemplateRendering.processTemplate).toHaveBeenCalled();
    });
  });

  describe('triggerManualRefresh', () => {
    it('should call refreshTemplate', async () => {
      const template = createMockTemplate();
      mockDb.content.findUnique.mockResolvedValue(template);
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({});
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Refreshed</h1>');
      mockDb.content.update.mockResolvedValue({});

      await service.triggerManualRefresh('template-123');

      expect(mockDb.content.update).toHaveBeenCalled();
    });

    it('should propagate errors', async () => {
      mockDb.content.findUnique.mockResolvedValue(null);

      await expect(service.triggerManualRefresh('nonexistent')).rejects.toThrow();
    });
  });

  describe('refresh interval calculations', () => {
    it('should refresh template exactly at interval', async () => {
      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      const template = createMockTemplate({
        metadata: {
          ...createMockTemplate().metadata,
          refreshConfig: {
            enabled: true,
            intervalMinutes: 15,
            lastRefresh: fifteenMinutesAgo.toISOString(),
          },
        },
      });
      mockDb.content.findMany.mockResolvedValue([template]);
      mockDb.content.findUnique.mockResolvedValue(template);
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({});
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Content</h1>');
      mockDb.content.update.mockResolvedValue({});

      const result = await service.processTemplateRefresh();

      expect(result.processed).toBe(1);
    });

    it('should not refresh template before interval', async () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      const template = createMockTemplate({
        metadata: {
          ...createMockTemplate().metadata,
          refreshConfig: {
            enabled: true,
            intervalMinutes: 15,
            lastRefresh: tenMinutesAgo.toISOString(),
          },
        },
      });
      mockDb.content.findMany.mockResolvedValue([template]);

      const result = await service.processTemplateRefresh();

      expect(result.processed).toBe(0);
    });

    it('should handle various interval settings', async () => {
      const createTemplateWithInterval = (minutes: number, lastRefreshMinutesAgo: number) =>
        createMockTemplate({
          metadata: {
            ...createMockTemplate().metadata,
            refreshConfig: {
              enabled: true,
              intervalMinutes: minutes,
              lastRefresh: new Date(Date.now() - lastRefreshMinutesAgo * 60 * 1000).toISOString(),
            },
          },
        });

      // Template with 5 min interval, last refresh 6 min ago - should refresh
      const template5min = createTemplateWithInterval(5, 6);

      // Template with 60 min interval, last refresh 30 min ago - should not refresh
      const template60min = createTemplateWithInterval(60, 30);

      mockDb.content.findMany.mockResolvedValue([template5min, template60min]);
      mockDb.content.findUnique.mockResolvedValue(template5min);
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({});
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Content</h1>');
      mockDb.content.update.mockResolvedValue({});

      const result = await service.processTemplateRefresh();

      expect(result.processed).toBe(1); // Only the 5 min template
    });
  });
});
