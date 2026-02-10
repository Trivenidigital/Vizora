// Mock template-rendering.service to avoid isomorphic-dompurify import issues
jest.mock('../content/template-rendering.service', () => ({
  TemplateRenderingService: jest.fn(),
}));

import { TemplateLibraryController } from './template-library.controller';
import { TemplateLibraryService } from './template-library.service';

describe('TemplateLibraryController', () => {
  let controller: TemplateLibraryController;
  let mockService: Partial<TemplateLibraryService>;

  beforeEach(() => {
    mockService = {
      search: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
      getCategories: jest.fn().mockResolvedValue([]),
      getFeatured: jest.fn().mockResolvedValue([]),
      getSeasonal: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: '1', name: 'Template' }),
      getPreview: jest.fn().mockResolvedValue({ html: '<h1>Preview</h1>' }),
      clone: jest.fn().mockResolvedValue({ id: '2', name: 'Cloned' }),
      setFeatured: jest.fn().mockResolvedValue({ id: '1', isFeatured: true }),
    };

    controller = new TemplateLibraryController(mockService as TemplateLibraryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('search', () => {
    it('should call service.search with dto', async () => {
      const dto = { search: 'test', page: 1 };
      await controller.search(dto);
      expect(mockService.search).toHaveBeenCalledWith(dto);
    });
  });

  describe('getCategories', () => {
    it('should call service.getCategories', async () => {
      await controller.getCategories();
      expect(mockService.getCategories).toHaveBeenCalled();
    });
  });

  describe('getFeatured', () => {
    it('should call service.getFeatured', async () => {
      await controller.getFeatured();
      expect(mockService.getFeatured).toHaveBeenCalled();
    });
  });

  describe('getSeasonal', () => {
    it('should call service.getSeasonal', async () => {
      await controller.getSeasonal();
      expect(mockService.getSeasonal).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id', async () => {
      await controller.findOne('tmpl-1');
      expect(mockService.findOne).toHaveBeenCalledWith('tmpl-1');
    });
  });

  describe('getPreview', () => {
    it('should call service.getPreview with id', async () => {
      await controller.getPreview('tmpl-1');
      expect(mockService.getPreview).toHaveBeenCalledWith('tmpl-1');
    });
  });

  describe('clone', () => {
    it('should call service.clone with id, organizationId, and dto', async () => {
      const dto = { name: 'My Copy' };
      await controller.clone('tmpl-1', 'org-1', dto);
      expect(mockService.clone).toHaveBeenCalledWith('tmpl-1', 'org-1', dto);
    });
  });

  describe('setFeatured', () => {
    it('should call service.setFeatured with id and flag', async () => {
      await controller.setFeatured('tmpl-1', true);
      expect(mockService.setFeatured).toHaveBeenCalledWith('tmpl-1', true);
    });
  });
});
