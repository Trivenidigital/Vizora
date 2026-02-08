import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TemplateRenderingService } from '../content/template-rendering.service';
import { SearchTemplatesDto } from './dto/search-templates.dto';
import { CloneTemplateDto } from './dto/clone-template.dto';
import { PaginatedResponse } from '../common/dto/pagination.dto';

/**
 * Library template metadata (extends base template metadata)
 */
export interface LibraryTemplateMetadata {
  templateHtml: string;
  isLibraryTemplate: true;
  category: string;
  libraryTags: string[];
  previewImageUrl?: string;
  isFeatured?: boolean;
  seasonalStart?: string;
  seasonalEnd?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  dataSource: {
    type: 'manual';
    manualData?: Record<string, any>;
  };
  refreshConfig: {
    enabled: boolean;
    intervalMinutes: number;
  };
  sampleData?: Record<string, any>;
  renderedHtml?: string;
  renderedAt?: string;
}

@Injectable()
export class TemplateLibraryService {
  private readonly logger = new Logger(TemplateLibraryService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly templateRendering: TemplateRenderingService,
  ) {}

  /**
   * Search/browse template library with filters
   */
  async search(dto: SearchTemplatesDto) {
    const { page = 1, limit = 20, search, category, tag, orientation, difficulty } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      isGlobal: true,
      type: 'template',
      status: 'active',
    };

    if (orientation) {
      where.templateOrientation = orientation;
    }

    // For category, tag, and difficulty we filter via metadata JSONB
    // Prisma supports JSON filtering with path
    if (category) {
      where.metadata = {
        ...where.metadata,
        path: ['category'],
        equals: category,
      };
    }

    // Build search conditions
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.db.content.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.content.count({ where }),
    ]);

    // Post-filter by difficulty and tag (JSONB fields not easily filtered via Prisma)
    let filtered = data;
    if (difficulty) {
      filtered = filtered.filter((item) => {
        const meta = item.metadata as any;
        return meta?.difficulty === difficulty;
      });
    }
    if (tag) {
      filtered = filtered.filter((item) => {
        const meta = item.metadata as any;
        return meta?.libraryTags?.includes(tag);
      });
    }

    // Map response
    const mappedData = filtered.map((item) => this.mapTemplateResponse(item));
    return new PaginatedResponse(mappedData, total, page, limit);
  }

  /**
   * Get category list with counts
   */
  async getCategories() {
    const templates = await this.db.content.findMany({
      where: { isGlobal: true, type: 'template', status: 'active' },
      select: { metadata: true },
    });

    const categoryCounts: Record<string, number> = {};
    for (const template of templates) {
      const meta = template.metadata as any;
      const category = meta?.category || 'general';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }

    return Object.entries(categoryCounts).map(([name, count]) => ({
      name,
      count,
      label: name.charAt(0).toUpperCase() + name.slice(1),
    }));
  }

  /**
   * Get single template detail
   */
  async findOne(id: string) {
    const template = await this.db.content.findFirst({
      where: { id, isGlobal: true, type: 'template' },
    });

    if (!template) {
      throw new NotFoundException('Template not found in library');
    }

    return this.mapTemplateResponse(template);
  }

  /**
   * Get rendered preview HTML for a template
   */
  async getPreview(id: string) {
    const template = await this.findOne(id);
    const metadata = template.metadata as LibraryTemplateMetadata;

    if (!metadata?.templateHtml) {
      return { html: '<p>No preview available</p>' };
    }

    try {
      const data = metadata.sampleData || metadata.dataSource?.manualData || {};
      const html = this.templateRendering.processTemplate(metadata.templateHtml, data);
      return { html };
    } catch (error) {
      this.logger.warn(`Preview render failed for template ${id}: ${error}`);
      return { html: '<p>Preview generation failed</p>' };
    }
  }

  /**
   * Clone a library template into user's organization
   */
  async clone(id: string, organizationId: string, dto: CloneTemplateDto) {
    const template = await this.db.content.findFirst({
      where: { id, isGlobal: true, type: 'template' },
    });

    if (!template) {
      throw new NotFoundException('Template not found in library');
    }

    const metadata = template.metadata as any;

    // Create a copy in the user's org (not global)
    const cloned = await this.db.content.create({
      data: {
        name: dto.name || `${template.name} (Copy)`,
        description: dto.description || template.description,
        type: 'template',
        url: '',
        duration: template.duration,
        metadata: {
          ...metadata,
          isLibraryTemplate: false, // Mark as user's own template
          clonedFrom: id,
        },
        templateOrientation: template.templateOrientation,
        organizationId,
        isGlobal: false,
      },
    });

    return this.mapTemplateResponse(cloned);
  }

  /**
   * Get featured templates
   */
  async getFeatured() {
    const templates = await this.db.content.findMany({
      where: {
        isGlobal: true,
        type: 'template',
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Filter featured via metadata
    const featured = templates.filter((t) => {
      const meta = t.metadata as any;
      return meta?.isFeatured === true;
    });

    return featured.map((item) => this.mapTemplateResponse(item));
  }

  /**
   * Get seasonally relevant templates
   */
  async getSeasonal() {
    const now = new Date().toISOString();

    const templates = await this.db.content.findMany({
      where: {
        isGlobal: true,
        type: 'template',
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter by seasonal date range
    const seasonal = templates.filter((t) => {
      const meta = t.metadata as any;
      if (!meta?.seasonalStart) return false;
      const start = meta.seasonalStart;
      const end = meta.seasonalEnd || '2099-12-31';
      return now >= start && now <= end;
    });

    return seasonal.map((item) => this.mapTemplateResponse(item));
  }

  /**
   * Set featured status (admin only)
   */
  async setFeatured(id: string, isFeatured: boolean) {
    const template = await this.db.content.findFirst({
      where: { id, isGlobal: true, type: 'template' },
    });

    if (!template) {
      throw new NotFoundException('Template not found in library');
    }

    const metadata = (template.metadata as any) || {};
    metadata.isFeatured = isFeatured;

    const updated = await this.db.content.update({
      where: { id },
      data: { metadata: metadata as any },
    });

    return this.mapTemplateResponse(updated);
  }

  /**
   * Map database record to API response
   */
  private mapTemplateResponse(content: any) {
    const metadata = content.metadata as any;
    return {
      id: content.id,
      name: content.name,
      description: content.description,
      type: content.type,
      duration: content.duration,
      templateOrientation: content.templateOrientation,
      category: metadata?.category || 'general',
      libraryTags: metadata?.libraryTags || [],
      difficulty: metadata?.difficulty || 'beginner',
      isFeatured: metadata?.isFeatured || false,
      previewImageUrl: metadata?.previewImageUrl,
      seasonalStart: metadata?.seasonalStart,
      seasonalEnd: metadata?.seasonalEnd,
      hasDataSource: metadata?.dataSource?.type !== 'manual',
      metadata,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };
  }
}
