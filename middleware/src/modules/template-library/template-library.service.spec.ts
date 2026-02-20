import { NotFoundException } from '@nestjs/common';

// Mock template-rendering.service to avoid isomorphic-dompurify import issues
jest.mock('../content/template-rendering.service', () => ({
  TemplateRenderingService: jest.fn().mockImplementation(() => ({
    processTemplate: jest.fn().mockReturnValue('<h1>Rendered</h1>'),
  })),
}));

import { TemplateLibraryService } from './template-library.service';

describe('TemplateLibraryService', () => {
  let service: TemplateLibraryService;
  let mockDb: any;
  let mockTemplateRendering: any;

  const now = new Date();
  const makeTemplate = (overrides: any = {}) => ({
    id: 'tmpl-1',
    name: 'Test Template',
    description: 'A test template',
    type: 'template',
    url: '',
    duration: 30,
    templateOrientation: 'landscape',
    metadata: {
      category: 'retail',
      libraryTags: ['promo', 'sale'],
      difficulty: 'beginner',
      isFeatured: false,
      templateHtml: '<h1>{{title}}</h1>',
      isLibraryTemplate: true,
      dataSource: { type: 'manual', manualData: { title: 'Hello' } },
      refreshConfig: { enabled: false, intervalMinutes: 0 },
      sampleData: { title: 'Sample' },
    },
    isGlobal: true,
    status: 'active',
    organizationId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  beforeEach(() => {
    mockDb = {
      content: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    mockTemplateRendering = {
      processTemplate: jest.fn().mockReturnValue('<h1>Rendered</h1>'),
    };

    service = new TemplateLibraryService(mockDb, mockTemplateRendering);
  });

  describe('search', () => {
    it('should return paginated results', async () => {
      const templates = [makeTemplate()];
      mockDb.content.findMany.mockResolvedValue(templates);
      mockDb.content.count.mockResolvedValue(1);

      const result = await service.search({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should apply pagination parameters', async () => {
      mockDb.content.findMany.mockResolvedValue([]);
      mockDb.content.count.mockResolvedValue(0);

      const result = await service.search({ page: 2, limit: 10 });

      expect(mockDb.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 }),
      );
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
    });

    it('should filter by orientation', async () => {
      mockDb.content.findMany.mockResolvedValue([]);
      mockDb.content.count.mockResolvedValue(0);

      await service.search({ orientation: 'landscape' });

      expect(mockDb.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ templateOrientation: 'landscape' }),
        }),
      );
    });

    it('should filter by category', async () => {
      mockDb.content.findMany.mockResolvedValue([]);
      mockDb.content.count.mockResolvedValue(0);

      await service.search({ category: 'retail' });

      expect(mockDb.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            metadata: expect.objectContaining({ path: ['category'], equals: 'retail' }),
          }),
        }),
      );
    });

    it('should filter by search term', async () => {
      mockDb.content.findMany.mockResolvedValue([]);
      mockDb.content.count.mockResolvedValue(0);

      await service.search({ search: 'promo' });

      expect(mockDb.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'promo', mode: 'insensitive' } },
              { description: { contains: 'promo', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should post-filter by difficulty', async () => {
      const templates = [
        makeTemplate({ id: '1', metadata: { difficulty: 'beginner', category: 'retail', libraryTags: [] } }),
        makeTemplate({ id: '2', metadata: { difficulty: 'advanced', category: 'retail', libraryTags: [] } }),
      ];
      mockDb.content.findMany.mockResolvedValue(templates);
      mockDb.content.count.mockResolvedValue(2);

      const result = await service.search({ difficulty: 'beginner' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('1');
    });

    it('should post-filter by tag', async () => {
      const templates = [
        makeTemplate({ id: '1', metadata: { libraryTags: ['promo', 'sale'], category: 'retail' } }),
        makeTemplate({ id: '2', metadata: { libraryTags: ['info'], category: 'retail' } }),
      ];
      mockDb.content.findMany.mockResolvedValue(templates);
      mockDb.content.count.mockResolvedValue(2);

      const result = await service.search({ tag: 'promo' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('1');
    });

    it('should handle templates with null metadata when filtering by difficulty', async () => {
      const templates = [makeTemplate({ id: '1', metadata: null })];
      mockDb.content.findMany.mockResolvedValue(templates);
      mockDb.content.count.mockResolvedValue(1);

      const result = await service.search({ difficulty: 'beginner' });

      expect(result.data).toHaveLength(0);
    });

    it('should handle templates with null metadata when filtering by tag', async () => {
      const templates = [makeTemplate({ id: '1', metadata: null })];
      mockDb.content.findMany.mockResolvedValue(templates);
      mockDb.content.count.mockResolvedValue(1);

      const result = await service.search({ tag: 'promo' });

      expect(result.data).toHaveLength(0);
    });

    it('should handle templates with missing libraryTags when filtering by tag', async () => {
      const templates = [makeTemplate({ id: '1', metadata: { category: 'retail' } })];
      mockDb.content.findMany.mockResolvedValue(templates);
      mockDb.content.count.mockResolvedValue(1);

      const result = await service.search({ tag: 'promo' });

      expect(result.data).toHaveLength(0);
    });
  });

  describe('getCategories', () => {
    it('should return categories with counts', async () => {
      mockDb.content.findMany.mockResolvedValue([
        { metadata: { category: 'retail' } },
        { metadata: { category: 'retail' } },
        { metadata: { category: 'corporate' } },
      ]);

      const result = await service.getCategories();

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          { name: 'retail', count: 2, label: 'Retail' },
          { name: 'corporate', count: 1, label: 'Corporate' },
        ]),
      );
    });

    it('should use "general" as default category for null metadata', async () => {
      mockDb.content.findMany.mockResolvedValue([
        { metadata: null },
      ]);

      const result = await service.getCategories();

      expect(result).toEqual([
        { name: 'general', count: 1, label: 'General' },
      ]);
    });

    it('should use "general" as default category when category is missing', async () => {
      mockDb.content.findMany.mockResolvedValue([
        { metadata: { libraryTags: [] } },
      ]);

      const result = await service.getCategories();

      expect(result).toEqual([
        { name: 'general', count: 1, label: 'General' },
      ]);
    });
  });

  describe('findOne', () => {
    it('should return a template', async () => {
      const template = makeTemplate();
      mockDb.content.findFirst.mockResolvedValue(template);

      const result = await service.findOne('tmpl-1');

      expect(result.id).toBe('tmpl-1');
      expect(result.name).toBe('Test Template');
    });

    it('should throw NotFoundException when template not found', async () => {
      mockDb.content.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should map metadata fields correctly', async () => {
      const template = makeTemplate();
      mockDb.content.findFirst.mockResolvedValue(template);

      const result = await service.findOne('tmpl-1');

      expect(result.category).toBe('retail');
      expect(result.libraryTags).toEqual(['promo', 'sale']);
      expect(result.difficulty).toBe('beginner');
      expect(result.isFeatured).toBe(false);
    });

    it('should use defaults for missing metadata fields', async () => {
      const template = makeTemplate({ metadata: {} });
      mockDb.content.findFirst.mockResolvedValue(template);

      const result = await service.findOne('tmpl-1');

      expect(result.category).toBe('general');
      expect(result.libraryTags).toEqual([]);
      expect(result.difficulty).toBe('beginner');
      expect(result.isFeatured).toBe(false);
    });

    it('should handle null metadata', async () => {
      const template = makeTemplate({ metadata: null });
      mockDb.content.findFirst.mockResolvedValue(template);

      const result = await service.findOne('tmpl-1');

      expect(result.category).toBe('general');
    });
  });

  describe('getPreview', () => {
    it('should render template with sample data', async () => {
      const template = makeTemplate();
      mockDb.content.findFirst.mockResolvedValue(template);

      const result = await service.getPreview('tmpl-1');

      expect(result.html).toBe('<h1>Rendered</h1>');
      expect(mockTemplateRendering.processTemplate).toHaveBeenCalledWith(
        '<h1>{{title}}</h1>',
        { title: 'Sample' },
      );
    });

    it('should fall back to manualData when no sampleData', async () => {
      const template = makeTemplate({
        metadata: {
          templateHtml: '<h1>{{title}}</h1>',
          dataSource: { type: 'manual', manualData: { title: 'Manual' } },
          refreshConfig: { enabled: false, intervalMinutes: 0 },
          isLibraryTemplate: true,
          category: 'retail',
          libraryTags: [],
        },
      });
      mockDb.content.findFirst.mockResolvedValue(template);

      await service.getPreview('tmpl-1');

      expect(mockTemplateRendering.processTemplate).toHaveBeenCalledWith(
        '<h1>{{title}}</h1>',
        { title: 'Manual' },
      );
    });

    it('should fall back to empty object when no data source', async () => {
      const template = makeTemplate({
        metadata: {
          templateHtml: '<h1>Static</h1>',
          isLibraryTemplate: true,
          category: 'retail',
          libraryTags: [],
          dataSource: { type: 'manual' },
          refreshConfig: { enabled: false, intervalMinutes: 0 },
        },
      });
      mockDb.content.findFirst.mockResolvedValue(template);

      await service.getPreview('tmpl-1');

      expect(mockTemplateRendering.processTemplate).toHaveBeenCalledWith(
        '<h1>Static</h1>',
        {},
      );
    });

    it('should return fallback when no templateHtml', async () => {
      const template = makeTemplate({
        metadata: {
          isLibraryTemplate: true,
          category: 'retail',
          libraryTags: [],
          dataSource: { type: 'manual' },
          refreshConfig: { enabled: false, intervalMinutes: 0 },
        },
      });
      mockDb.content.findFirst.mockResolvedValue(template);

      const result = await service.getPreview('tmpl-1');

      expect(result.html).toBe('<p>No preview available</p>');
    });

    it('should return fallback when rendering fails', async () => {
      const template = makeTemplate();
      mockDb.content.findFirst.mockResolvedValue(template);
      mockTemplateRendering.processTemplate.mockImplementation(() => {
        throw new Error('Template syntax error');
      });

      const result = await service.getPreview('tmpl-1');

      expect(result.html).toBe('<p>Preview generation failed</p>');
    });
  });

  describe('clone', () => {
    it('should clone a template into user organization', async () => {
      const template = makeTemplate();
      mockDb.content.findFirst.mockResolvedValue(template);
      const cloned = makeTemplate({
        id: 'clone-1',
        isGlobal: false,
        organizationId: 'org-1',
        name: 'My Copy',
      });
      mockDb.content.create.mockResolvedValue(cloned);

      const result = await service.clone('tmpl-1', 'org-1', { name: 'My Copy' });

      expect(mockDb.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'My Copy',
          isGlobal: false,
          organizationId: 'org-1',
        }),
      });
      expect(result.id).toBe('clone-1');
    });

    it('should use default name when not provided', async () => {
      const template = makeTemplate({ name: 'Original' });
      mockDb.content.findFirst.mockResolvedValue(template);
      mockDb.content.create.mockResolvedValue(makeTemplate({ id: 'clone-1' }));

      await service.clone('tmpl-1', 'org-1', {});

      expect(mockDb.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Original (Copy)',
        }),
      });
    });

    it('should use default description when not provided', async () => {
      const template = makeTemplate({ description: 'Original desc' });
      mockDb.content.findFirst.mockResolvedValue(template);
      mockDb.content.create.mockResolvedValue(makeTemplate({ id: 'clone-1' }));

      await service.clone('tmpl-1', 'org-1', {});

      expect(mockDb.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'Original desc',
        }),
      });
    });

    it('should throw NotFoundException when template not found', async () => {
      mockDb.content.findFirst.mockResolvedValue(null);

      await expect(
        service.clone('nonexistent', 'org-1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mark cloned template as not library template', async () => {
      const template = makeTemplate();
      mockDb.content.findFirst.mockResolvedValue(template);
      mockDb.content.create.mockResolvedValue(makeTemplate({ id: 'clone-1' }));

      await service.clone('tmpl-1', 'org-1', {});

      expect(mockDb.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            isLibraryTemplate: false,
            clonedFrom: 'tmpl-1',
          }),
        }),
      });
    });
  });

  describe('getFeatured', () => {
    it('should return only featured templates', async () => {
      const templates = [
        makeTemplate({ id: '1', metadata: { isFeatured: true, category: 'retail', libraryTags: [] } }),
        makeTemplate({ id: '2', metadata: { isFeatured: false, category: 'retail', libraryTags: [] } }),
        makeTemplate({ id: '3', metadata: { category: 'retail', libraryTags: [] } }),
      ];
      mockDb.content.findMany.mockResolvedValue(templates);

      const result = await service.getFeatured();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should return empty array when no featured templates', async () => {
      mockDb.content.findMany.mockResolvedValue([]);

      const result = await service.getFeatured();

      expect(result).toEqual([]);
    });

    it('should handle null metadata', async () => {
      const templates = [makeTemplate({ id: '1', metadata: null })];
      mockDb.content.findMany.mockResolvedValue(templates);

      const result = await service.getFeatured();

      expect(result).toHaveLength(0);
    });
  });

  describe('getSeasonal', () => {
    it('should return templates in season', async () => {
      const pastDate = '2020-01-01';
      const futureDate = '2099-12-31';
      const templates = [
        makeTemplate({
          id: '1',
          metadata: { seasonalStart: pastDate, seasonalEnd: futureDate, category: 'retail', libraryTags: [] },
        }),
        makeTemplate({
          id: '2',
          metadata: { category: 'retail', libraryTags: [] },
        }),
      ];
      mockDb.content.findMany.mockResolvedValue(templates);

      const result = await service.getSeasonal();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should use default end date when seasonalEnd is missing', async () => {
      const pastDate = '2020-01-01';
      const templates = [
        makeTemplate({
          id: '1',
          metadata: { seasonalStart: pastDate, category: 'retail', libraryTags: [] },
        }),
      ];
      mockDb.content.findMany.mockResolvedValue(templates);

      const result = await service.getSeasonal();

      expect(result).toHaveLength(1);
    });

    it('should exclude templates outside their season', async () => {
      const templates = [
        makeTemplate({
          id: '1',
          metadata: { seasonalStart: '2099-01-01', seasonalEnd: '2099-12-31', category: 'retail', libraryTags: [] },
        }),
      ];
      mockDb.content.findMany.mockResolvedValue(templates);

      const result = await service.getSeasonal();

      expect(result).toHaveLength(0);
    });

    it('should handle null metadata', async () => {
      const templates = [makeTemplate({ id: '1', metadata: null })];
      mockDb.content.findMany.mockResolvedValue(templates);

      const result = await service.getSeasonal();

      expect(result).toHaveLength(0);
    });
  });

  describe('setFeatured', () => {
    it('should set featured flag to true', async () => {
      const template = makeTemplate();
      mockDb.content.findFirst.mockResolvedValue(template);
      mockDb.content.update.mockResolvedValue({ ...template, metadata: { ...template.metadata, isFeatured: true } });

      const result = await service.setFeatured('tmpl-1', true);

      expect(mockDb.content.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: { metadata: expect.objectContaining({ isFeatured: true }) },
      });
      expect(result.isFeatured).toBe(true);
    });

    it('should set featured flag to false', async () => {
      const template = makeTemplate();
      mockDb.content.findFirst.mockResolvedValue(template);
      mockDb.content.update.mockResolvedValue({ ...template, metadata: { ...template.metadata, isFeatured: false } });

      await service.setFeatured('tmpl-1', false);

      expect(mockDb.content.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: { metadata: expect.objectContaining({ isFeatured: false }) },
      });
    });

    it('should throw NotFoundException when template not found', async () => {
      mockDb.content.findFirst.mockResolvedValue(null);

      await expect(
        service.setFeatured('nonexistent', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle null metadata by creating new object', async () => {
      const template = makeTemplate({ metadata: null });
      mockDb.content.findFirst.mockResolvedValue(template);
      mockDb.content.update.mockResolvedValue(
        makeTemplate({ metadata: { isFeatured: true } }),
      );

      await service.setFeatured('tmpl-1', true);

      expect(mockDb.content.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: { metadata: expect.objectContaining({ isFeatured: true }) },
      });
    });
  });

  describe('createTemplateForOrg', () => {
    const createDto = {
      name: 'New Template',
      description: 'A new template',
      templateHtml: '<h1>{{title}}</h1>',
      category: 'retail',
      difficulty: 'beginner',
      orientation: 'landscape',
      tags: ['promo', 'sale'],
      sampleData: { title: 'Sample' },
      thumbnailUrl: 'https://example.com/thumb.png',
      duration: 30,
    };

    it('should create a global template with correct metadata', async () => {
      const created = makeTemplate({ organizationId: 'org-1' });
      mockDb.content.create.mockResolvedValue(created);

      const result = await service.createTemplateForOrg(createDto, 'org-1');

      expect(mockDb.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isGlobal: true,
          type: 'template',
          status: 'active',
          organizationId: 'org-1',
          url: '',
          name: 'New Template',
          metadata: expect.objectContaining({
            isLibraryTemplate: true,
            isFeatured: false,
            category: 'retail',
            templateHtml: '<h1>{{title}}</h1>',
            libraryTags: ['promo', 'sale'],
          }),
        }),
      });
      expect(result.id).toBe('tmpl-1');
    });

    it('should render HTML with sample data on create', async () => {
      const created = makeTemplate({ organizationId: 'org-1' });
      mockDb.content.create.mockResolvedValue(created);

      await service.createTemplateForOrg(createDto, 'org-1');

      expect(mockTemplateRendering.processTemplate).toHaveBeenCalledWith(
        '<h1>{{title}}</h1>',
        { title: 'Sample' },
      );
      expect(mockDb.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            renderedHtml: '<h1>Rendered</h1>',
            renderedAt: expect.any(String),
          }),
        }),
      });
    });

    it('should handle render failure gracefully', async () => {
      mockTemplateRendering.processTemplate.mockImplementation(() => {
        throw new Error('Template syntax error');
      });
      const created = makeTemplate({ organizationId: 'org-1' });
      mockDb.content.create.mockResolvedValue(created);

      // Should not throw
      const result = await service.createTemplateForOrg(createDto, 'org-1');

      expect(result.id).toBe('tmpl-1');
      // Metadata should NOT have renderedHtml since rendering failed
      expect(mockDb.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.not.objectContaining({
            renderedHtml: expect.anything(),
          }),
        }),
      });
    });
  });

  describe('updateTemplate', () => {
    it('should update template name and metadata fields', async () => {
      const template = makeTemplate();
      mockDb.content.findFirst.mockResolvedValue(template);
      const updated = makeTemplate({ name: 'Updated Name' });
      mockDb.content.update.mockResolvedValue(updated);

      const result = await service.updateTemplate('tmpl-1', {
        name: 'Updated Name',
        category: 'corporate',
        tags: ['info'],
      });

      expect(mockDb.content.findFirst).toHaveBeenCalledWith({
        where: { id: 'tmpl-1', isGlobal: true, type: 'template' },
      });
      expect(mockDb.content.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: expect.objectContaining({
          name: 'Updated Name',
          metadata: expect.objectContaining({
            category: 'corporate',
            libraryTags: ['info'],
          }),
        }),
      });
      expect(result.id).toBe('tmpl-1');
    });

    it('should re-render when HTML changes', async () => {
      const template = makeTemplate();
      mockDb.content.findFirst.mockResolvedValue(template);
      const updated = makeTemplate();
      mockDb.content.update.mockResolvedValue(updated);

      await service.updateTemplate('tmpl-1', {
        templateHtml: '<h2>{{subtitle}}</h2>',
      });

      expect(mockTemplateRendering.processTemplate).toHaveBeenCalledWith(
        '<h2>{{subtitle}}</h2>',
        { title: 'Sample' },
      );
      expect(mockDb.content.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            renderedHtml: '<h1>Rendered</h1>',
            renderedAt: expect.any(String),
          }),
        }),
      });
    });

    it('should throw NotFoundException for missing template', async () => {
      mockDb.content.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTemplate('nonexistent', { name: 'Foo' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTemplate', () => {
    it('should soft-delete by setting status to archived', async () => {
      const template = makeTemplate();
      mockDb.content.findFirst.mockResolvedValue(template);
      mockDb.content.update.mockResolvedValue({ ...template, status: 'archived' });

      await service.deleteTemplate('tmpl-1');

      expect(mockDb.content.findFirst).toHaveBeenCalledWith({
        where: { id: 'tmpl-1', isGlobal: true, type: 'template' },
      });
      expect(mockDb.content.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: { status: 'archived' },
      });
    });

    it('should throw NotFoundException for missing template', async () => {
      mockDb.content.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteTemplate('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
