import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@vizora/database';
import { DatabaseService } from '../database/database.service';
import { TemplateRenderingService } from '../content/template-rendering.service';
import { SearchTemplatesDto } from './dto/search-templates.dto';
import { CloneTemplateDto } from './dto/clone-template.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PublishTemplateDto } from './dto/publish-template.dto';
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
  useCount?: number;
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
        orderBy: { createdAt: 'desc' },
        take: 500, // Bounded fetch to prevent OOM
      }),
      this.db.content.count({ where }),
    ]);

    // Post-filter by difficulty and tag (JSONB fields)
    let filtered = data;
    if (difficulty) {
      filtered = filtered.filter((item) => {
        const meta = item.metadata as Record<string, unknown> | null;
        return meta?.difficulty === difficulty;
      });
    }
    if (tag) {
      filtered = filtered.filter((item) => {
        const meta = item.metadata as Record<string, unknown> | null;
        return (meta?.libraryTags as string[] | undefined)?.includes(tag);
      });
    }

    // Apply pagination to filtered results
    const paginatedData = filtered.slice(skip, skip + limit);
    const mappedData = paginatedData.map((item) => this.mapTemplateResponse(item));
    return new PaginatedResponse(mappedData, filtered.length, page, limit);
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
      const meta = template.metadata as Record<string, unknown> | null;
      const category = (meta?.category as string) || 'general';
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

    const metadata = template.metadata as Record<string, unknown> | null;

    // Increment useCount on the source template
    const currentUseCount = ((metadata?.useCount as number) || 0) + 1;
    await this.db.content.update({
      where: { id },
      data: {
        metadata: { ...metadata, useCount: currentUseCount } as Prisma.InputJsonValue,
      },
    });

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
          isLibraryTemplate: false,
          clonedFrom: id,
          useCount: 0,
        },
        templateOrientation: template.templateOrientation,
        organizationId,
        isGlobal: false,
      },
    });

    return this.mapTemplateResponse(cloned);
  }

  /**
   * Publish rendered template HTML to one or more displays.
   *
   * Creates a Content record with the rendered HTML, then for each display:
   * finds or creates a "Quick Publish" playlist, adds the content as an item,
   * and assigns the playlist to the display.
   */
  async publishTemplate(
    templateId: string,
    dto: PublishTemplateDto,
    organizationId: string,
    userId: string,
  ) {
    // 1. Verify the source template exists
    const template = await this.db.content.findFirst({
      where: { id: templateId, type: 'template' },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // 2. Execute all writes in a transaction for atomicity
    return this.db.$transaction(async (tx) => {
      // Create the published content record (draft if displayIds is empty)
      const content = await tx.content.create({
        data: {
          name: dto.name,
          type: 'html',
          url: '', // Inline HTML content — no external URL
          duration: dto.duration || 30,
          metadata: {
            htmlContent: dto.renderedHtml,
            sourceTemplateId: templateId,
            publishedBy: userId,
            publishedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
          status: 'active',
          organizationId,
          isGlobal: false,
        },
      });

      // 3. Assign content to each display via playlists
      let displayCount = 0;

      for (const displayId of dto.displayIds) {
        // Verify display belongs to this organization
        const display = await tx.display.findFirst({
          where: { id: displayId, organizationId },
        });

        if (!display) {
          this.logger.warn(
            `Skipping display ${displayId}: not found or not in org ${organizationId}`,
          );
          continue;
        }

        // Find or create a "Quick Publish" playlist for this display
        let playlist = await tx.playlist.findFirst({
          where: {
            organizationId,
            name: `Quick Publish - ${display.nickname || display.deviceIdentifier}`,
          },
        });

        if (!playlist) {
          playlist = await tx.playlist.create({
            data: {
              name: `Quick Publish - ${display.nickname || display.deviceIdentifier}`,
              description: 'Auto-created playlist for quick-published template content',
              organizationId,
            },
          });
        }

        // Determine next order value for the playlist item
        const lastItem = await tx.playlistItem.findFirst({
          where: { playlistId: playlist.id },
          orderBy: { order: 'desc' },
        });
        const nextOrder = lastItem ? lastItem.order + 1 : 0;

        // Add the content as a playlist item
        await tx.playlistItem.create({
          data: {
            playlistId: playlist.id,
            contentId: content.id,
            order: nextOrder,
            duration: dto.duration || null,
          },
        });

        // Assign this playlist to the display
        await tx.display.update({
          where: { id: displayId },
          data: { currentPlaylistId: playlist.id },
        });

        displayCount++;
      }

      // 4. Increment useCount on the source template
      const templateMetadata = (template.metadata as Record<string, unknown>) || {};
      const currentUseCount = ((templateMetadata.useCount as number) || 0) + 1;
      await tx.content.update({
        where: { id: templateId },
        data: {
          metadata: {
            ...templateMetadata,
            useCount: currentUseCount,
          } as Prisma.InputJsonValue,
        },
      });

      return { contentId: content.id, displayCount };
    });
  }

  /**
   * Get popular templates sorted by useCount
   */
  async getPopular(limit = 20) {
    const templates = await this.db.content.findMany({
      where: {
        isGlobal: true,
        type: 'template',
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Sort by useCount (stored in metadata)
    const sorted = templates.sort((a, b) => {
      const metaA = a.metadata as Record<string, unknown> | null;
      const metaB = b.metadata as Record<string, unknown> | null;
      return ((metaB?.useCount as number) || 0) - ((metaA?.useCount as number) || 0);
    });

    return sorted.slice(0, limit).map((item) => this.mapTemplateResponse(item));
  }

  /**
   * Get user's own templates (cloned + created, non-global, org-scoped)
   */
  async getUserTemplates(organizationId: string, dto: SearchTemplatesDto) {
    const { page = 1, limit = 20, search } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
      type: 'template',
      isGlobal: false,
      status: 'active',
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.db.content.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.content.count({ where }),
    ]);

    const mapped = data.map((item) => this.mapTemplateResponse(item));
    return new PaginatedResponse(mapped, total, page, limit);
  }

  /**
   * Create a blank org-scoped design for the user to customize
   */
  async createBlank(organizationId: string, orientation: 'landscape' | 'portrait' = 'landscape') {
    const templateHtml = `<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #ffffff; font-family: system-ui, sans-serif; }
  .placeholder { text-align: center; color: #999; }
  .placeholder h2 { font-size: 24px; font-weight: 300; margin: 0 0 8px; }
  .placeholder p { font-size: 14px; margin: 0; }
</style>
</head>
<body>
  <div class="placeholder">
    <h2>Your Design</h2>
    <p>Click elements to edit in the visual editor</p>
  </div>
</body>
</html>`;

    const content = await this.db.content.create({
      data: {
        name: 'Untitled Design',
        description: null,
        type: 'template',
        url: '',
        duration: 30,
        templateOrientation: orientation,
        metadata: {
          templateHtml,
          isLibraryTemplate: false,
          category: 'general',
          libraryTags: [],
          dataSource: { type: 'manual' },
          refreshConfig: { enabled: false, intervalMinutes: 0 },
        },
        organizationId,
        isGlobal: false,
        status: 'active',
      },
    });

    return this.mapTemplateResponse(content);
  }

  /**
   * AI template generation (placeholder)
   */
  async aiGenerate(_prompt: string, _options?: { category?: string; orientation?: string; style?: string }) {
    return {
      available: false,
      message: 'AI Designer is launching soon. We\'re training our AI to create stunning display templates.',
    };
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
      take: 200,
    });

    // Filter featured via metadata
    const featured = templates.filter((t) => {
      const meta = t.metadata as Record<string, unknown> | null;
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
      take: 200,
    });
    const seasonal = templates.filter((t) => {
      const meta = t.metadata as Record<string, unknown> | null;
      const start = meta?.seasonalStart as string;
      const end = (meta?.seasonalEnd as string) || '2099-12-31';
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

    const metadata = (template.metadata as Record<string, unknown>) || {};
    metadata.isFeatured = isFeatured;

    const updated = await this.db.content.update({
      where: { id },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });

    return this.mapTemplateResponse(updated);
  }

  /**
   * Create a new global library template for an organization
   */
  async createTemplateForOrg(dto: CreateTemplateDto, organizationId: string) {
    const metadata: LibraryTemplateMetadata = {
      templateHtml: dto.templateHtml,
      isLibraryTemplate: true,
      isFeatured: false,
      category: dto.category,
      libraryTags: dto.tags || [],
      previewImageUrl: dto.thumbnailUrl,
      difficulty: (dto.difficulty as LibraryTemplateMetadata['difficulty']) || 'beginner',
      dataSource: {
        type: 'manual',
        manualData: dto.sampleData,
      },
      refreshConfig: {
        enabled: false,
        intervalMinutes: 0,
      },
      sampleData: dto.sampleData,
    };

    // Try to render with sample data
    try {
      const data = dto.sampleData || {};
      const renderedHtml = this.templateRendering.processTemplate(dto.templateHtml, data);
      metadata.renderedHtml = renderedHtml;
      metadata.renderedAt = new Date().toISOString();
    } catch (error) {
      this.logger.warn(`Template render failed during create: ${error}`);
    }

    const content = await this.db.content.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        type: 'template',
        url: '',
        duration: dto.duration || 30,
        templateOrientation: dto.orientation || null,
        metadata: metadata as unknown as Prisma.InputJsonValue,
        organizationId,
        isGlobal: true,
        status: 'active',
      },
    });

    return this.mapTemplateResponse(content);
  }

  /**
   * Update an existing library template
   */
  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    const template = await this.db.content.findFirst({
      where: { id, isGlobal: true, type: 'template' },
    });

    if (!template) {
      throw new NotFoundException('Template not found in library');
    }

    const existingMetadata = (template.metadata as Record<string, unknown>) || {};

    // Merge DTO fields into existing metadata
    const updatedMetadata = { ...existingMetadata };
    if (dto.templateHtml !== undefined) {
      updatedMetadata.templateHtml = dto.templateHtml;
    }
    if (dto.category !== undefined) {
      updatedMetadata.category = dto.category;
    }
    if (dto.tags !== undefined) {
      updatedMetadata.libraryTags = dto.tags;
    }
    if (dto.difficulty !== undefined) {
      updatedMetadata.difficulty = dto.difficulty;
    }
    if (dto.sampleData !== undefined) {
      updatedMetadata.sampleData = dto.sampleData;
    }
    if (dto.thumbnailUrl !== undefined) {
      updatedMetadata.previewImageUrl = dto.thumbnailUrl;
    }

    // Re-render if templateHtml or sampleData changed
    if (dto.templateHtml !== undefined || dto.sampleData !== undefined) {
      try {
        const html = (updatedMetadata.templateHtml as string) || '';
        const sampleData = (updatedMetadata.sampleData as Record<string, any>) || {};
        const renderedHtml = this.templateRendering.processTemplate(html, sampleData);
        updatedMetadata.renderedHtml = renderedHtml;
        updatedMetadata.renderedAt = new Date().toISOString();
      } catch (error) {
        this.logger.warn(`Template render failed during update: ${error}`);
      }
    }

    // Build update data
    const updateData: any = {
      metadata: updatedMetadata as Prisma.InputJsonValue,
    };
    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.duration !== undefined) {
      updateData.duration = dto.duration;
    }
    if (dto.orientation !== undefined) {
      updateData.templateOrientation = dto.orientation;
    }

    const updated = await this.db.content.update({
      where: { id },
      data: updateData,
    });

    return this.mapTemplateResponse(updated);
  }

  /**
   * Soft-delete a library template by setting status to 'archived'
   */
  async deleteTemplate(id: string) {
    const template = await this.db.content.findFirst({
      where: { id, isGlobal: true, type: 'template' },
    });

    if (!template) {
      throw new NotFoundException('Template not found in library');
    }

    await this.db.content.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  /**
   * Map database record to API response
   */
  private mapTemplateResponse(content: { id: string; name: string; description: string | null; type: string; duration: number; templateOrientation: string | null; metadata: Prisma.JsonValue; createdAt: Date; updatedAt: Date }) {
    const metadata = content.metadata as Record<string, unknown> | null;
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
      useCount: (metadata?.useCount as number) || 0,
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
