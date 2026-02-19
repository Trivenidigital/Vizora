jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesController } from './templates.controller';
import { ContentService } from '../content.service';

describe('TemplatesController', () => {
  let controller: TemplatesController;
  let mockContentService: jest.Mocked<ContentService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockContentService = {
      createTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      previewTemplate: jest.fn(),
      validateTemplateHtml: jest.fn(),
      getRenderedTemplate: jest.fn(),
      triggerTemplateRefresh: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        { provide: ContentService, useValue: mockContentService },
      ],
    }).compile();

    controller = module.get<TemplatesController>(TemplatesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================================================================
  // createTemplate
  // ==========================================================================

  describe('createTemplate', () => {
    const createTemplateDto = {
      name: 'Welcome Screen',
      templateHtml: '<h1>{{title}}</h1><p>{{message}}</p>',
      templateData: { title: 'Welcome', message: 'Hello World' },
    };

    it('should create a template successfully', async () => {
      const expectedTemplate = { id: 'template-123', ...createTemplateDto };
      mockContentService.createTemplate.mockResolvedValue(expectedTemplate as any);

      const result = await controller.createTemplate(organizationId, createTemplateDto as any);

      expect(result).toEqual(expectedTemplate);
      expect(mockContentService.createTemplate).toHaveBeenCalledWith(
        organizationId,
        createTemplateDto,
      );
    });

    it('should pass organization id to service', async () => {
      mockContentService.createTemplate.mockResolvedValue({ id: 'template-123' } as any);

      await controller.createTemplate('org-456', createTemplateDto as any);

      expect(mockContentService.createTemplate).toHaveBeenCalledWith('org-456', createTemplateDto);
    });

    it('should propagate service errors', async () => {
      mockContentService.createTemplate.mockRejectedValue(new Error('Invalid template HTML'));

      await expect(
        controller.createTemplate(organizationId, createTemplateDto as any),
      ).rejects.toThrow('Invalid template HTML');
    });
  });

  // ==========================================================================
  // updateTemplate
  // ==========================================================================

  describe('updateTemplate', () => {
    const updateTemplateDto = {
      name: 'Updated Welcome Screen',
      templateData: { title: 'Updated', message: 'New message' },
    };

    it('should update a template successfully', async () => {
      const expectedTemplate = { id: 'template-123', ...updateTemplateDto };
      mockContentService.updateTemplate.mockResolvedValue(expectedTemplate as any);

      const result = await controller.updateTemplate(
        organizationId,
        'template-123',
        updateTemplateDto as any,
      );

      expect(result).toEqual(expectedTemplate);
      expect(mockContentService.updateTemplate).toHaveBeenCalledWith(
        organizationId,
        'template-123',
        updateTemplateDto,
      );
    });

    it('should allow updating just the HTML', async () => {
      const htmlOnlyDto = { templateHtml: '<h1>New HTML</h1>' };
      mockContentService.updateTemplate.mockResolvedValue({ id: 'template-123' } as any);

      await controller.updateTemplate(organizationId, 'template-123', htmlOnlyDto as any);

      expect(mockContentService.updateTemplate).toHaveBeenCalledWith(
        organizationId,
        'template-123',
        htmlOnlyDto,
      );
    });

    it('should propagate not found errors', async () => {
      mockContentService.updateTemplate.mockRejectedValue(new Error('Template not found'));

      await expect(
        controller.updateTemplate(organizationId, 'nonexistent', updateTemplateDto as any),
      ).rejects.toThrow('Template not found');
    });
  });

  // ==========================================================================
  // previewTemplate
  // ==========================================================================

  describe('previewTemplate', () => {
    const previewDto = {
      templateHtml: '<h1>{{title}}</h1>',
      templateData: { title: 'Preview Title' },
    };

    it('should return rendered preview HTML', async () => {
      const expectedHtml = { html: '<h1>Preview Title</h1>' };
      mockContentService.previewTemplate.mockResolvedValue(expectedHtml as any);

      const result = await controller.previewTemplate(previewDto as any);

      expect(result).toEqual(expectedHtml);
      expect(mockContentService.previewTemplate).toHaveBeenCalledWith(previewDto);
    });

    it('should not pass organization id (preview is stateless)', async () => {
      mockContentService.previewTemplate.mockResolvedValue({ html: '' } as any);

      await controller.previewTemplate(previewDto as any);

      expect(mockContentService.previewTemplate).toHaveBeenCalledWith(previewDto);
      expect(mockContentService.previewTemplate).toHaveBeenCalledTimes(1);
    });

    it('should propagate template rendering errors', async () => {
      mockContentService.previewTemplate.mockRejectedValue(
        new Error('Invalid Handlebars syntax'),
      );

      await expect(controller.previewTemplate(previewDto as any)).rejects.toThrow(
        'Invalid Handlebars syntax',
      );
    });
  });

  // ==========================================================================
  // validateTemplate
  // ==========================================================================

  describe('validateTemplate', () => {
    it('should return valid result for correct HTML', async () => {
      const validationResult = { valid: true, errors: [] };
      mockContentService.validateTemplateHtml.mockResolvedValue(validationResult as any);

      const result = await controller.validateTemplate('<h1>{{title}}</h1>');

      expect(result).toEqual(validationResult);
      expect(mockContentService.validateTemplateHtml).toHaveBeenCalledWith('<h1>{{title}}</h1>');
    });

    it('should return errors for invalid HTML', async () => {
      const validationResult = {
        valid: false,
        errors: ['Unclosed tag: <div>'],
      };
      mockContentService.validateTemplateHtml.mockResolvedValue(validationResult as any);

      const result = await controller.validateTemplate('<div>{{unclosed}');

      expect(result).toEqual(validationResult);
    });

    it('should propagate validation service errors', async () => {
      mockContentService.validateTemplateHtml.mockRejectedValue(
        new Error('Validation service unavailable'),
      );

      await expect(
        controller.validateTemplate('<div></div>'),
      ).rejects.toThrow('Validation service unavailable');
    });
  });

  // ==========================================================================
  // getRenderedTemplate
  // ==========================================================================

  describe('getRenderedTemplate', () => {
    it('should return rendered template HTML', async () => {
      const renderedResult = {
        html: '<h1>Welcome</h1><p>Hello from org</p>',
        contentId: 'template-123',
      };
      mockContentService.getRenderedTemplate.mockResolvedValue(renderedResult as any);

      const result = await controller.getRenderedTemplate(organizationId, 'template-123');

      expect(result).toEqual(renderedResult);
      expect(mockContentService.getRenderedTemplate).toHaveBeenCalledWith(
        organizationId,
        'template-123',
      );
    });

    it('should propagate not found errors', async () => {
      mockContentService.getRenderedTemplate.mockRejectedValue(
        new Error('Template not found'),
      );

      await expect(
        controller.getRenderedTemplate(organizationId, 'nonexistent'),
      ).rejects.toThrow('Template not found');
    });
  });

  // ==========================================================================
  // refreshTemplate
  // ==========================================================================

  describe('refreshTemplate', () => {
    it('should trigger template refresh successfully', async () => {
      const expectedResult = { id: 'template-123', refreshed: true };
      mockContentService.triggerTemplateRefresh.mockResolvedValue(expectedResult as any);

      const result = await controller.refreshTemplate(organizationId, 'template-123');

      expect(result).toEqual(expectedResult);
      expect(mockContentService.triggerTemplateRefresh).toHaveBeenCalledWith(
        organizationId,
        'template-123',
      );
    });

    it('should propagate service errors on refresh', async () => {
      mockContentService.triggerTemplateRefresh.mockRejectedValue(
        new Error('Refresh failed'),
      );

      await expect(
        controller.refreshTemplate(organizationId, 'template-123'),
      ).rejects.toThrow('Refresh failed');
    });
  });
});
