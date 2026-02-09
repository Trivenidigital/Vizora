// Mock isomorphic-dompurify before importing services
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
  },
}));

import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ContentService, TemplateMetadata } from './content.service';
import { DatabaseService } from '../database/database.service';
import { TemplateRenderingService } from './template-rendering.service';
import { DataSourceRegistryService } from './data-source-registry.service';
import { CreateTemplateDto } from './dto/create-template.dto';

describe('ContentService', () => {
  let service: ContentService;
  let mockDatabaseService: any;
  let mockTemplateRendering: jest.Mocked<TemplateRenderingService>;
  let mockDataSourceRegistry: jest.Mocked<DataSourceRegistryService>;

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

  const mockTemplateContent = {
    id: 'template-123',
    organizationId: 'org-123',
    name: 'Test Template',
    description: 'A test template',
    type: 'template',
    url: '',
    duration: 30,
    status: 'active',
    metadata: {
      templateHtml: '<h1>{{title}}</h1>',
      dataSource: {
        type: 'manual',
        manualData: { title: 'Test' },
      },
      refreshConfig: {
        enabled: true,
        intervalMinutes: 15,
      },
      sampleData: { title: 'Sample' },
      renderedHtml: '<h1>Test</h1>',
      renderedAt: new Date().toISOString(),
    } as TemplateMetadata,
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
        updateMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      playlistItem: {
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      tag: {
        count: jest.fn(),
      },
      contentTag: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((fn) => fn(mockDatabaseService)),
    };

    mockTemplateRendering = {
      renderTemplate: jest.fn(),
      fetchDataFromSource: jest.fn(),
      validateTemplate: jest.fn(),
      sanitizeHtml: jest.fn(),
      processTemplate: jest.fn(),
    } as any;

    mockDataSourceRegistry = {
      get: jest.fn().mockReturnValue({
        type: 'weather',
        fetchData: jest.fn().mockResolvedValue({ temperature: 72 }),
        getConfigSchema: jest.fn().mockReturnValue({}),
        getDefaultTemplate: jest.fn().mockReturnValue('weather'),
        getSampleData: jest.fn().mockReturnValue({ temperature: 72 }),
      }),
      getAll: jest.fn().mockReturnValue([
        ['weather', {
          type: 'weather',
          fetchData: jest.fn().mockResolvedValue({ temperature: 72 }),
          getConfigSchema: jest.fn().mockReturnValue({}),
          getDefaultTemplate: jest.fn().mockReturnValue('weather'),
          getSampleData: jest.fn().mockReturnValue({ temperature: 72 }),
        }],
      ]),
    } as any;

    service = new ContentService(
      mockDatabaseService as DatabaseService,
      mockTemplateRendering,
      mockDataSourceRegistry,
    );
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

  // ============================================================================
  // CONTENT TEMPLATES
  // ============================================================================

  describe('createTemplate', () => {
    const createTemplateDto: CreateTemplateDto = {
      name: 'Menu Board',
      description: 'Restaurant menu template',
      templateHtml: '<h1>{{title}}</h1>{{#each items}}<div>{{name}}</div>{{/each}}',
      dataSource: {
        type: 'manual',
        manualData: { title: 'Menu', items: [{ name: 'Burger' }] },
      },
      refreshConfig: {
        enabled: true,
        intervalMinutes: 15,
      },
      sampleData: { title: 'Sample Menu', items: [] },
      duration: 30,
    };

    it('should create template with valid HTML', async () => {
      mockTemplateRendering.validateTemplate.mockReturnValue({ valid: true, errors: [] });
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({ title: 'Menu', items: [] });
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Menu</h1>');
      mockDatabaseService.content.create.mockResolvedValue({
        ...mockTemplateContent,
        name: createTemplateDto.name,
      });

      const result = await service.createTemplate('org-123', createTemplateDto);

      expect(result).toBeDefined();
      expect(mockTemplateRendering.validateTemplate).toHaveBeenCalledWith(createTemplateDto.templateHtml);
      expect(mockDatabaseService.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: createTemplateDto.name,
          type: 'template',
          organizationId: 'org-123',
        }),
      });
    });

    it('should throw error for invalid template HTML', async () => {
      mockTemplateRendering.validateTemplate.mockReturnValue({
        valid: false,
        errors: ['Forbidden tag found: <script>'],
      });

      await expect(service.createTemplate('org-123', {
        ...createTemplateDto,
        templateHtml: '<script>alert(1)</script>',
      })).rejects.toThrow(BadRequestException);
    });

    it('should perform initial render with sample data', async () => {
      mockTemplateRendering.validateTemplate.mockReturnValue({ valid: true, errors: [] });
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({});
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Sample Menu</h1>');
      mockDatabaseService.content.create.mockResolvedValue(mockTemplateContent);

      await service.createTemplate('org-123', createTemplateDto);

      expect(mockTemplateRendering.processTemplate).toHaveBeenCalled();
    });

    it('should handle initial render failure gracefully', async () => {
      mockTemplateRendering.validateTemplate.mockReturnValue({ valid: true, errors: [] });
      mockTemplateRendering.fetchDataFromSource.mockRejectedValue(new Error('API Error'));
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Sample</h1>');
      mockDatabaseService.content.create.mockResolvedValue(mockTemplateContent);

      // Should not throw, should use sample data as fallback
      const result = await service.createTemplate('org-123', createTemplateDto);

      expect(result).toBeDefined();
    });

    it('should create template with REST API data source', async () => {
      const apiTemplateDto = {
        ...createTemplateDto,
        dataSource: {
          type: 'rest_api' as const,
          url: 'https://api.example.com/menu',
          method: 'GET' as const,
        },
      };

      mockTemplateRendering.validateTemplate.mockReturnValue({ valid: true, errors: [] });
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({ title: 'API Menu' });
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>API Menu</h1>');
      mockDatabaseService.content.create.mockResolvedValue(mockTemplateContent);

      await service.createTemplate('org-123', apiTemplateDto);

      expect(mockTemplateRendering.fetchDataFromSource).toHaveBeenCalledWith(apiTemplateDto.dataSource);
    });
  });

  describe('updateTemplate', () => {
    it('should update template HTML', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockTemplateContent);
      mockTemplateRendering.validateTemplate.mockReturnValue({ valid: true, errors: [] });
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({ title: 'Updated' });
      mockTemplateRendering.processTemplate.mockReturnValue('<h2>Updated</h2>');
      mockDatabaseService.content.update.mockResolvedValue({
        ...mockTemplateContent,
        metadata: {
          ...mockTemplateContent.metadata,
          templateHtml: '<h2>{{title}}</h2>',
          renderedHtml: '<h2>Updated</h2>',
        },
      });

      const result = await service.updateTemplate('org-123', 'template-123', {
        templateHtml: '<h2>{{title}}</h2>',
      });

      expect(result).toBeDefined();
      expect(mockTemplateRendering.validateTemplate).toHaveBeenCalledWith('<h2>{{title}}</h2>');
    });

    it('should throw error when content is not a template', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockContent); // Regular content, not template

      await expect(service.updateTemplate('org-123', 'content-123', {
        name: 'Updated',
      })).rejects.toThrow('Content is not a template');
    });

    it('should throw error for invalid template HTML on update', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockTemplateContent);
      mockTemplateRendering.validateTemplate.mockReturnValue({
        valid: false,
        errors: ['Forbidden tag found: <iframe>'],
      });

      await expect(service.updateTemplate('org-123', 'template-123', {
        templateHtml: '<iframe src="evil.com"></iframe>',
      })).rejects.toThrow(BadRequestException);
    });

    it('should re-render when template HTML changes', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockTemplateContent);
      mockTemplateRendering.validateTemplate.mockReturnValue({ valid: true, errors: [] });
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({});
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Re-rendered</h1>');
      mockDatabaseService.content.update.mockResolvedValue(mockTemplateContent);

      await service.updateTemplate('org-123', 'template-123', {
        templateHtml: '<h1>New Template</h1>',
      });

      expect(mockTemplateRendering.processTemplate).toHaveBeenCalled();
    });

    it('should update refresh config', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockTemplateContent);
      mockDatabaseService.content.update.mockResolvedValue(mockTemplateContent);

      await service.updateTemplate('org-123', 'template-123', {
        refreshConfig: {
          enabled: false,
          intervalMinutes: 60,
        },
      });

      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            refreshConfig: expect.objectContaining({
              enabled: false,
              intervalMinutes: 60,
            }),
          }),
        }),
      });
    });
  });

  describe('previewTemplate', () => {
    it('should preview template with sample data', async () => {
      mockTemplateRendering.validateTemplate.mockReturnValue({ valid: true, errors: [] });
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Preview</h1>');

      const result = await service.previewTemplate({
        templateHtml: '<h1>{{title}}</h1>',
        sampleData: { title: 'Preview' },
      });

      expect(result).toEqual({ html: '<h1>Preview</h1>' });
    });

    it('should preview template with data source', async () => {
      mockTemplateRendering.validateTemplate.mockReturnValue({ valid: true, errors: [] });
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({ title: 'API Data' });
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>API Data</h1>');

      const result = await service.previewTemplate({
        templateHtml: '<h1>{{title}}</h1>',
        dataSource: {
          type: 'rest_api',
          url: 'https://api.example.com/data',
        },
      });

      expect(result).toEqual({ html: '<h1>API Data</h1>' });
      expect(mockTemplateRendering.fetchDataFromSource).toHaveBeenCalled();
    });

    it('should throw error for invalid template in preview', async () => {
      mockTemplateRendering.validateTemplate.mockReturnValue({
        valid: false,
        errors: ['Forbidden tag found: <script>'],
      });

      await expect(service.previewTemplate({
        templateHtml: '<script>alert(1)</script>',
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRenderedTemplate', () => {
    it('should return rendered HTML for template', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockTemplateContent);

      const result = await service.getRenderedTemplate('org-123', 'template-123');

      expect(result).toEqual({
        html: '<h1>Test</h1>',
        renderedAt: expect.any(String),
      });
    });

    it('should throw error for non-template content', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockContent);

      await expect(service.getRenderedTemplate('org-123', 'content-123'))
        .rejects.toThrow('Content is not a template');
    });

    it('should return empty string if no rendered HTML', async () => {
      const templateWithoutRendered = {
        ...mockTemplateContent,
        metadata: {
          ...mockTemplateContent.metadata,
          renderedHtml: undefined,
          renderedAt: undefined,
        },
      };
      mockDatabaseService.content.findFirst.mockResolvedValue(templateWithoutRendered);

      const result = await service.getRenderedTemplate('org-123', 'template-123');

      expect(result).toEqual({
        html: '',
        renderedAt: null,
      });
    });
  });

  describe('triggerTemplateRefresh', () => {
    it('should refresh template and return updated content', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockTemplateContent);
      mockTemplateRendering.fetchDataFromSource.mockResolvedValue({ title: 'Refreshed' });
      mockTemplateRendering.processTemplate.mockReturnValue('<h1>Refreshed</h1>');
      mockDatabaseService.content.update.mockResolvedValue({
        ...mockTemplateContent,
        metadata: {
          ...mockTemplateContent.metadata,
          renderedHtml: '<h1>Refreshed</h1>',
        },
      });

      const result = await service.triggerTemplateRefresh('org-123', 'template-123');

      expect(result).toBeDefined();
      expect(mockDatabaseService.content.update).toHaveBeenCalled();
    });

    it('should throw error for non-template content', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(mockContent);

      await expect(service.triggerTemplateRefresh('org-123', 'content-123'))
        .rejects.toThrow('Content is not a template');
    });

    it('should throw error if template has no HTML', async () => {
      const templateWithoutHtml = {
        ...mockTemplateContent,
        metadata: {
          ...mockTemplateContent.metadata,
          templateHtml: undefined,
        },
      };
      mockDatabaseService.content.findFirst.mockResolvedValue(templateWithoutHtml);

      await expect(service.triggerTemplateRefresh('org-123', 'template-123'))
        .rejects.toThrow('Template has no HTML');
    });

    it('should update error in metadata on refresh failure', async () => {
      // Use REST API data source to trigger fetchDataFromSource
      const templateWithRestApi = {
        ...mockTemplateContent,
        metadata: {
          ...mockTemplateContent.metadata,
          dataSource: {
            type: 'rest_api',
            url: 'https://api.example.com/data',
          },
        },
      };
      mockDatabaseService.content.findFirst.mockResolvedValue(templateWithRestApi);
      mockTemplateRendering.fetchDataFromSource.mockRejectedValue(new Error('API Error'));
      mockDatabaseService.content.update.mockResolvedValue(templateWithRestApi);

      await expect(service.triggerTemplateRefresh('org-123', 'template-123'))
        .rejects.toThrow('Template refresh failed: API Error');

      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: {
          metadata: expect.objectContaining({
            refreshConfig: expect.objectContaining({
              lastError: 'API Error',
            }),
          }),
        },
      });
    });
  });

  describe('validateTemplateHtml', () => {
    it('should delegate to template rendering service', () => {
      mockTemplateRendering.validateTemplate.mockReturnValue({ valid: true, errors: [] });

      const result = service.validateTemplateHtml('<h1>{{title}}</h1>');

      expect(result).toEqual({ valid: true, errors: [] });
      expect(mockTemplateRendering.validateTemplate).toHaveBeenCalledWith('<h1>{{title}}</h1>');
    });

    it('should return validation errors', () => {
      mockTemplateRendering.validateTemplate.mockReturnValue({
        valid: false,
        errors: ['Forbidden tag found: <script>'],
      });

      const result = service.validateTemplateHtml('<script>alert(1)</script>');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Forbidden tag found: <script>');
    });
  });

  describe('findAll with template filter', () => {
    it('should filter by template type', async () => {
      mockDatabaseService.content.findMany.mockResolvedValue([mockTemplateContent]);
      mockDatabaseService.content.count.mockResolvedValue(1);

      await service.findAll('org-123', { page: 1, limit: 10 }, { type: 'template' });

      expect(mockDatabaseService.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'template' }),
        }),
      );
    });
  });

  describe('findAll with templateOrientation filter', () => {
    it('should filter by landscape orientation', async () => {
      mockDatabaseService.content.findMany.mockResolvedValue([mockContent]);
      mockDatabaseService.content.count.mockResolvedValue(1);

      await service.findAll('org-123', { page: 1, limit: 10 }, { templateOrientation: 'landscape' });

      expect(mockDatabaseService.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ templateOrientation: 'landscape' }),
        }),
      );
    });

    it('should filter by portrait orientation', async () => {
      mockDatabaseService.content.findMany.mockResolvedValue([mockContent]);
      mockDatabaseService.content.count.mockResolvedValue(1);

      await service.findAll('org-123', { page: 1, limit: 10 }, { templateOrientation: 'portrait' });

      expect(mockDatabaseService.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ templateOrientation: 'portrait' }),
        }),
      );
    });

    it('should filter by both orientation', async () => {
      mockDatabaseService.content.findMany.mockResolvedValue([mockContent]);
      mockDatabaseService.content.count.mockResolvedValue(1);

      await service.findAll('org-123', { page: 1, limit: 10 }, { templateOrientation: 'both' });

      expect(mockDatabaseService.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ templateOrientation: 'both' }),
        }),
      );
    });

    it('should ignore invalid templateOrientation values', async () => {
      mockDatabaseService.content.findMany.mockResolvedValue([mockContent]);
      mockDatabaseService.content.count.mockResolvedValue(1);

      await service.findAll('org-123', { page: 1, limit: 10 }, { templateOrientation: 'invalid' });

      expect(mockDatabaseService.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ templateOrientation: 'invalid' }),
        }),
      );
    });

    it('should combine templateOrientation with other filters', async () => {
      mockDatabaseService.content.findMany.mockResolvedValue([]);
      mockDatabaseService.content.count.mockResolvedValue(0);

      await service.findAll('org-123', { page: 1, limit: 10 }, {
        type: 'template',
        status: 'active',
        templateOrientation: 'landscape',
      });

      expect(mockDatabaseService.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'template',
            status: 'active',
            templateOrientation: 'landscape',
          }),
        }),
      );
    });
  });

  // ============================================================================
  // FILE REPLACEMENT TESTS
  // ============================================================================

  describe('replaceFile', () => {
    const existingContent = {
      ...mockContent,
      versionNumber: 1,
      previousVersionId: null,
    };

    it('should replace file without backup', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(existingContent);
      mockDatabaseService.content.update.mockResolvedValue({
        ...existingContent,
        url: 'https://example.com/new-image.jpg',
        versionNumber: 2,
      });

      const result = await service.replaceFile(
        'org-123',
        'content-123',
        'https://example.com/new-image.jpg',
      );

      expect(result.url).toBe('https://example.com/new-image.jpg');
      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: expect.objectContaining({
          url: 'https://example.com/new-image.jpg',
          versionNumber: 2,
        }),
      });
    });

    it('should replace file with backup', async () => {
      const backupContent = { ...existingContent, id: 'backup-123', status: 'archived' };
      mockDatabaseService.content.findFirst.mockResolvedValue(existingContent);
      mockDatabaseService.content.create.mockResolvedValue(backupContent);
      mockDatabaseService.content.update.mockResolvedValue({
        ...existingContent,
        url: 'https://example.com/new-image.jpg',
        versionNumber: 2,
        previousVersionId: 'backup-123',
      });

      const result = await service.replaceFile(
        'org-123',
        'content-123',
        'https://example.com/new-image.jpg',
        { keepBackup: true },
      );

      expect(result.previousVersionId).toBe('backup-123');
      expect(mockDatabaseService.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: `${existingContent.name} (v${existingContent.versionNumber})`,
          status: 'archived',
          versionNumber: existingContent.versionNumber,
        }),
      });
    });

    it('should update name when provided', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(existingContent);
      mockDatabaseService.content.update.mockResolvedValue({
        ...existingContent,
        name: 'New Name',
        url: 'https://example.com/new-image.jpg',
      });

      await service.replaceFile(
        'org-123',
        'content-123',
        'https://example.com/new-image.jpg',
        { name: 'New Name' },
      );

      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: expect.objectContaining({
          name: 'New Name',
        }),
      });
    });

    it('should update thumbnail for image files', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(existingContent);
      mockDatabaseService.content.update.mockResolvedValue({
        ...existingContent,
        thumbnail: 'https://example.com/thumb.jpg',
      });

      await service.replaceFile(
        'org-123',
        'content-123',
        'https://example.com/new-image.jpg',
        { thumbnail: 'https://example.com/thumb.jpg' },
      );

      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: expect.objectContaining({
          thumbnail: 'https://example.com/thumb.jpg',
        }),
      });
    });

    it('should throw error if content not found', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(null);

      await expect(
        service.replaceFile('org-123', 'nonexistent', 'https://example.com/new.jpg'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update file metadata', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(existingContent);
      mockDatabaseService.content.update.mockResolvedValue(existingContent);

      await service.replaceFile(
        'org-123',
        'content-123',
        'https://example.com/new-image.jpg',
        { fileSize: 2048, mimeType: 'image/png' },
      );

      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: expect.objectContaining({
          fileSize: 2048,
          mimeType: 'image/png',
        }),
      });
    });
  });

  describe('getVersionHistory', () => {
    it('should return version chain', async () => {
      const version3 = { ...mockContent, id: 'v3', versionNumber: 3, previousVersionId: 'v2' };
      const version2 = { ...mockContent, id: 'v2', versionNumber: 2, previousVersionId: 'v1' };
      const version1 = { ...mockContent, id: 'v1', versionNumber: 1, previousVersionId: null };

      mockDatabaseService.content.findFirst
        .mockResolvedValueOnce(version3) // findOne
        .mockResolvedValueOnce(version2) // first previous
        .mockResolvedValueOnce(version1); // second previous

      const result = await service.getVersionHistory('org-123', 'v3');

      expect(result).toHaveLength(3);
    });

    it('should return single item if no previous versions', async () => {
      const content = { ...mockContent, versionNumber: 1, previousVersionId: null };
      mockDatabaseService.content.findFirst.mockResolvedValue(content);

      const result = await service.getVersionHistory('org-123', 'content-123');

      expect(result).toHaveLength(1);
    });

    it('should throw error if content not found', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(null);

      await expect(
        service.getVersionHistory('org-123', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle broken version chain gracefully', async () => {
      const content = { ...mockContent, versionNumber: 2, previousVersionId: 'missing-id' };
      mockDatabaseService.content.findFirst
        .mockResolvedValueOnce(content) // findOne
        .mockResolvedValueOnce(null); // missing previous version

      const result = await service.getVersionHistory('org-123', 'content-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('restore', () => {
    it('should restore archived content to active', async () => {
      const archivedContent = { ...mockContent, status: 'archived' };
      mockDatabaseService.content.findFirst.mockResolvedValue(archivedContent);
      mockDatabaseService.content.update.mockResolvedValue({
        ...archivedContent,
        status: 'active',
      });

      const result = await service.restore('org-123', 'content-123');

      expect(result.status).toBe('active');
      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: { status: 'active' },
      });
    });

    it('should throw error if content not found', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(null);

      await expect(service.restore('org-123', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================================
  // CONTENT EXPIRATION TESTS
  // ============================================================================

  describe('setExpiration', () => {
    it('should set expiration date', async () => {
      const expiresAt = new Date('2025-12-31');
      mockDatabaseService.content.findFirst.mockResolvedValue(mockContent);
      mockDatabaseService.content.update.mockResolvedValue({
        ...mockContent,
        expiresAt,
      });

      const result = await service.setExpiration('org-123', 'content-123', expiresAt);

      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: {
          expiresAt,
          replacementContentId: undefined,
        },
      });
    });

    it('should set expiration with replacement content', async () => {
      const expiresAt = new Date('2025-12-31');
      const replacementContent = { ...mockContent, id: 'replacement-123' };
      mockDatabaseService.content.findFirst
        .mockResolvedValueOnce(mockContent) // findOne for main content
        .mockResolvedValueOnce(replacementContent); // findFirst for replacement
      mockDatabaseService.content.update.mockResolvedValue({
        ...mockContent,
        expiresAt,
        replacementContentId: 'replacement-123',
      });

      const result = await service.setExpiration(
        'org-123',
        'content-123',
        expiresAt,
        'replacement-123',
      );

      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: {
          expiresAt,
          replacementContentId: 'replacement-123',
        },
      });
    });

    it('should throw error if replacement content not found', async () => {
      const expiresAt = new Date('2025-12-31');
      mockDatabaseService.content.findFirst
        .mockResolvedValueOnce(mockContent) // findOne for main content
        .mockResolvedValueOnce(null); // replacement not found

      await expect(
        service.setExpiration('org-123', 'content-123', expiresAt, 'nonexistent'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if content not found', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(null);

      await expect(
        service.setExpiration('org-123', 'nonexistent', new Date()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearExpiration', () => {
    it('should clear expiration and replacement', async () => {
      const contentWithExpiration = {
        ...mockContent,
        expiresAt: new Date('2025-12-31'),
        replacementContentId: 'replacement-123',
      };
      mockDatabaseService.content.findFirst.mockResolvedValue(contentWithExpiration);
      mockDatabaseService.content.update.mockResolvedValue({
        ...mockContent,
        expiresAt: null,
        replacementContentId: null,
      });

      const result = await service.clearExpiration('org-123', 'content-123');

      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: {
          expiresAt: null,
          replacementContentId: null,
        },
      });
    });

    it('should throw error if content not found', async () => {
      mockDatabaseService.content.findFirst.mockResolvedValue(null);

      await expect(
        service.clearExpiration('org-123', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkExpiredContent', () => {
    it('should process expired content with replacement', async () => {
      const expiredContent = {
        ...mockContent,
        expiresAt: new Date('2020-01-01'),
        replacementContentId: 'replacement-123',
        status: 'active',
      };
      mockDatabaseService.content.findMany.mockResolvedValue([expiredContent]);
      mockDatabaseService.playlistItem.updateMany.mockResolvedValue({ count: 2 });
      mockDatabaseService.content.update.mockResolvedValue({
        ...expiredContent,
        status: 'expired',
      });

      const result = await service.checkExpiredContent();

      expect(result.processed).toBe(1);
      expect(mockDatabaseService.playlistItem.updateMany).toHaveBeenCalledWith({
        where: { contentId: 'content-123' },
        data: { contentId: 'replacement-123' },
      });
      expect(mockDatabaseService.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: { status: 'expired' },
      });
    });

    it('should delete playlist items for expired content without replacement', async () => {
      const expiredContent = {
        ...mockContent,
        expiresAt: new Date('2020-01-01'),
        replacementContentId: null,
        status: 'active',
      };
      mockDatabaseService.content.findMany.mockResolvedValue([expiredContent]);
      mockDatabaseService.playlistItem.deleteMany.mockResolvedValue({ count: 3 });
      mockDatabaseService.content.update.mockResolvedValue({
        ...expiredContent,
        status: 'expired',
      });

      const result = await service.checkExpiredContent();

      expect(result.processed).toBe(1);
      expect(mockDatabaseService.playlistItem.deleteMany).toHaveBeenCalledWith({
        where: { contentId: 'content-123' },
      });
    });

    it('should process multiple expired content items', async () => {
      const expired1 = { ...mockContent, id: 'exp-1', expiresAt: new Date('2020-01-01'), status: 'active' };
      const expired2 = { ...mockContent, id: 'exp-2', expiresAt: new Date('2020-01-01'), status: 'active' };
      mockDatabaseService.content.findMany.mockResolvedValue([expired1, expired2]);
      mockDatabaseService.playlistItem.deleteMany.mockResolvedValue({ count: 1 });
      mockDatabaseService.content.update.mockResolvedValue({ status: 'expired' });

      const result = await service.checkExpiredContent();

      expect(result.processed).toBe(2);
    });

    it('should return zero processed when no expired content', async () => {
      mockDatabaseService.content.findMany.mockResolvedValue([]);

      const result = await service.checkExpiredContent();

      expect(result.processed).toBe(0);
    });

    it('should only find active expired content', async () => {
      mockDatabaseService.content.findMany.mockResolvedValue([]);

      await service.checkExpiredContent();

      expect(mockDatabaseService.content.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lte: expect.any(Date) },
          status: 'active',
        },
      });
    });
  });

  // ============================================================================
  // BULK OPERATIONS TESTS
  // ============================================================================

  describe('bulkUpdate', () => {
    it('should update multiple content items', async () => {
      mockDatabaseService.content.count.mockResolvedValue(3);
      mockDatabaseService.content.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkUpdate('org-123', {
        ids: ['id-1', 'id-2', 'id-3'],
        duration: 30,
        description: 'Updated description',
      });

      expect(result.updated).toBe(3);
      expect(mockDatabaseService.content.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['id-1', 'id-2', 'id-3'] }, organizationId: 'org-123' },
        data: { duration: 30, description: 'Updated description' },
      });
    });

    it('should throw error if some content not found', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2); // Only 2 of 3 found

      await expect(
        service.bulkUpdate('org-123', {
          ids: ['id-1', 'id-2', 'id-3'],
          duration: 30,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update with expiration date', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2);
      mockDatabaseService.content.updateMany.mockResolvedValue({ count: 2 });

      await service.bulkUpdate('org-123', {
        ids: ['id-1', 'id-2'],
        expiresAt: '2025-12-31T00:00:00Z',
      });

      expect(mockDatabaseService.content.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['id-1', 'id-2'] }, organizationId: 'org-123' },
        data: { expiresAt: '2025-12-31T00:00:00Z' },
      });
    });

    it('should validate replacement content if provided', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2);
      mockDatabaseService.content.findFirst.mockResolvedValue({ id: 'replacement-123' });
      mockDatabaseService.content.updateMany.mockResolvedValue({ count: 2 });

      await service.bulkUpdate('org-123', {
        ids: ['id-1', 'id-2'],
        replacementContentId: 'replacement-123',
      });

      expect(mockDatabaseService.content.findFirst).toHaveBeenCalledWith({
        where: { id: 'replacement-123', organizationId: 'org-123' },
      });
    });

    it('should throw error if replacement content not found', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2);
      mockDatabaseService.content.findFirst.mockResolvedValue(null);

      await expect(
        service.bulkUpdate('org-123', {
          ids: ['id-1', 'id-2'],
          replacementContentId: 'nonexistent',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkArchive', () => {
    it('should archive multiple content items', async () => {
      mockDatabaseService.content.count.mockResolvedValue(3);
      mockDatabaseService.content.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkArchive('org-123', {
        ids: ['id-1', 'id-2', 'id-3'],
      });

      expect(result.archived).toBe(3);
      expect(mockDatabaseService.content.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['id-1', 'id-2', 'id-3'] }, organizationId: 'org-123' },
        data: { status: 'archived' },
      });
    });

    it('should throw error if some content not found', async () => {
      mockDatabaseService.content.count.mockResolvedValue(1);

      await expect(
        service.bulkArchive('org-123', { ids: ['id-1', 'id-2'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkRestore', () => {
    it('should restore multiple content items', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2);
      mockDatabaseService.content.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkRestore('org-123', {
        ids: ['id-1', 'id-2'],
      });

      expect(result.restored).toBe(2);
      expect(mockDatabaseService.content.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['id-1', 'id-2'] }, organizationId: 'org-123' },
        data: { status: 'active' },
      });
    });

    it('should throw error if some content not found', async () => {
      mockDatabaseService.content.count.mockResolvedValue(0);

      await expect(
        service.bulkRestore('org-123', { ids: ['id-1'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple content items', async () => {
      mockDatabaseService.content.count.mockResolvedValue(3);
      mockDatabaseService.content.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkDelete('org-123', {
        ids: ['id-1', 'id-2', 'id-3'],
      });

      expect(result.deleted).toBe(3);
      expect(mockDatabaseService.content.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['id-1', 'id-2', 'id-3'] }, organizationId: 'org-123' },
      });
    });

    it('should throw error if some content not found', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2);

      await expect(
        service.bulkDelete('org-123', { ids: ['id-1', 'id-2', 'id-3'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkAddTags', () => {
    it('should add tags to multiple content items', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2);
      mockDatabaseService.tag.count.mockResolvedValue(2);
      mockDatabaseService.contentTag.createMany.mockResolvedValue({ count: 4 });

      const result = await service.bulkAddTags('org-123', {
        contentIds: ['content-1', 'content-2'],
        tagIds: ['tag-1', 'tag-2'],
        operation: 'add',
      });

      expect(result.added).toBe(4);
      expect(mockDatabaseService.contentTag.createMany).toHaveBeenCalledWith({
        data: [
          { contentId: 'content-1', tagId: 'tag-1' },
          { contentId: 'content-1', tagId: 'tag-2' },
          { contentId: 'content-2', tagId: 'tag-1' },
          { contentId: 'content-2', tagId: 'tag-2' },
        ],
        skipDuplicates: true,
      });
    });

    it('should remove tags from multiple content items', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2);
      mockDatabaseService.tag.count.mockResolvedValue(2);
      mockDatabaseService.contentTag.deleteMany.mockResolvedValue({ count: 4 });

      const result = await service.bulkAddTags('org-123', {
        contentIds: ['content-1', 'content-2'],
        tagIds: ['tag-1', 'tag-2'],
        operation: 'remove',
      });

      expect(result.removed).toBe(4);
      expect(mockDatabaseService.contentTag.deleteMany).toHaveBeenCalledWith({
        where: {
          contentId: { in: ['content-1', 'content-2'] },
          tagId: { in: ['tag-1', 'tag-2'] },
        },
      });
    });

    it('should replace tags on multiple content items', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2);
      mockDatabaseService.tag.count.mockResolvedValue(2);
      mockDatabaseService.contentTag.deleteMany.mockResolvedValue({ count: 3 });
      mockDatabaseService.contentTag.createMany.mockResolvedValue({ count: 4 });

      const result = await service.bulkAddTags('org-123', {
        contentIds: ['content-1', 'content-2'],
        tagIds: ['tag-1', 'tag-2'],
        operation: 'replace',
      });

      expect(result.added).toBe(4);
      // Should delete existing tags first
      expect(mockDatabaseService.contentTag.deleteMany).toHaveBeenCalledWith({
        where: { contentId: { in: ['content-1', 'content-2'] } },
      });
    });

    it('should default to add operation', async () => {
      mockDatabaseService.content.count.mockResolvedValue(1);
      mockDatabaseService.tag.count.mockResolvedValue(1);
      mockDatabaseService.contentTag.createMany.mockResolvedValue({ count: 1 });

      const result = await service.bulkAddTags('org-123', {
        contentIds: ['content-1'],
        tagIds: ['tag-1'],
        // No operation specified - should default to 'add'
      });

      expect(result.added).toBe(1);
    });

    it('should throw error if some content not found', async () => {
      mockDatabaseService.content.count.mockResolvedValue(1); // Only 1 of 2 found

      await expect(
        service.bulkAddTags('org-123', {
          contentIds: ['content-1', 'content-2'],
          tagIds: ['tag-1'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if some tags not found', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2);
      mockDatabaseService.tag.count.mockResolvedValue(1); // Only 1 of 2 tags found

      await expect(
        service.bulkAddTags('org-123', {
          contentIds: ['content-1', 'content-2'],
          tagIds: ['tag-1', 'tag-2'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkSetDuration', () => {
    it('should set duration on multiple content items', async () => {
      mockDatabaseService.content.count.mockResolvedValue(3);
      mockDatabaseService.content.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkSetDuration('org-123', {
        ids: ['id-1', 'id-2', 'id-3'],
        duration: 60,
      });

      expect(result.updated).toBe(3);
      expect(mockDatabaseService.content.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['id-1', 'id-2', 'id-3'] }, organizationId: 'org-123' },
        data: { duration: 60 },
      });
    });

    it('should throw error if some content not found', async () => {
      mockDatabaseService.content.count.mockResolvedValue(2);

      await expect(
        service.bulkSetDuration('org-123', {
          ids: ['id-1', 'id-2', 'id-3'],
          duration: 60,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
