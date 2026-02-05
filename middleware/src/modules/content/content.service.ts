import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { BulkUpdateDto, BulkArchiveDto, BulkRestoreDto, BulkDeleteDto, BulkTagDto, BulkDurationDto } from './dto/bulk-operations.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TemplateRenderingService } from './template-rendering.service';

/**
 * Interface for template metadata stored in Content.metadata
 */
export interface TemplateMetadata {
  templateHtml: string;
  dataSource: {
    type: 'rest_api' | 'json_url' | 'manual';
    url?: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    jsonPath?: string;
    manualData?: Record<string, any>;
  };
  refreshConfig: {
    enabled: boolean;
    intervalMinutes: number;
    lastRefresh?: string;
    lastError?: string;
  };
  sampleData?: Record<string, any>;
  renderedHtml?: string;
  renderedAt?: string;
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly templateRendering: TemplateRenderingService,
  ) {}

  // Map database content to API response format
  private mapContentResponse(content: any) {
    if (!content) return content;
    return {
      ...content,
      title: content.name, // Map name to title for frontend compatibility
      thumbnailUrl: content.thumbnail, // Map thumbnail to thumbnailUrl for frontend
    };
  }

  async create(organizationId: string, createContentDto: CreateContentDto) {
    const content = await this.db.content.create({
      data: {
        ...createContentDto,
        organizationId,
      },
    });
    return this.mapContentResponse(content);
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters?: { type?: string; status?: string },
  ) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Validate filter values - only allow whitelisted values
    const validTypes = ['image', 'video', 'url', 'html', 'pdf', 'template'];
    const validStatuses = ['active', 'archived', 'draft'];

    const where: any = { organizationId };
    if (filters?.type && validTypes.includes(filters.type)) {
      where.type = filters.type;
    }
    if (filters?.status && validStatuses.includes(filters.status)) {
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      this.db.content.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      }),
      this.db.content.count({ where }),
    ]);

    // Map each content item to include thumbnailUrl
    const mappedData = data.map(item => this.mapContentResponse(item));
    return new PaginatedResponse(mappedData, total, page, limit);
  }

  async findOne(organizationId: string, id: string) {
    const content = await this.db.content.findFirst({
      where: { id, organizationId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        playlistItems: {
          include: {
            playlist: true,
          },
        },
      },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    return this.mapContentResponse(content);
  }

  async update(organizationId: string, id: string, updateContentDto: UpdateContentDto) {
    await this.findOne(organizationId, id);

    const content = await this.db.content.update({
      where: { id },
      data: updateContentDto,
    });
    return this.mapContentResponse(content);
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.db.content.delete({
      where: { id },
    });
  }

  async archive(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.db.content.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  async restore(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.db.content.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  // ============================================================================
  // FILE REPLACEMENT
  // ============================================================================

  async replaceFile(
    organizationId: string,
    id: string,
    newUrl: string,
    options: { name?: string; keepBackup?: boolean; thumbnail?: string; fileSize?: number; mimeType?: string } = {},
  ) {
    const existingContent = await this.findOne(organizationId, id);

    if (options.keepBackup) {
      // Create a backup version before replacing
      const backupContent = await this.db.content.create({
        data: {
          name: `${existingContent.name} (v${existingContent.versionNumber})`,
          description: existingContent.description,
          type: existingContent.type,
          url: existingContent.url,
          thumbnail: existingContent.thumbnail,
          duration: existingContent.duration,
          fileSize: existingContent.fileSize,
          mimeType: existingContent.mimeType,
          metadata: existingContent.metadata,
          status: 'archived',
          organizationId,
          versionNumber: existingContent.versionNumber,
          previousVersionId: existingContent.previousVersionId,
        },
      });

      // Update the current content with new file and link to backup
      const updatedContent = await this.db.content.update({
        where: { id },
        data: {
          url: newUrl,
          name: options.name || existingContent.name,
          thumbnail: options.thumbnail,
          fileSize: options.fileSize,
          mimeType: options.mimeType,
          versionNumber: existingContent.versionNumber + 1,
          previousVersionId: backupContent.id,
          updatedAt: new Date(),
        },
      });

      return this.mapContentResponse(updatedContent);
    }

    // Simple replacement without backup
    const updatedContent = await this.db.content.update({
      where: { id },
      data: {
        url: newUrl,
        name: options.name || existingContent.name,
        thumbnail: options.thumbnail,
        fileSize: options.fileSize,
        mimeType: options.mimeType,
        versionNumber: existingContent.versionNumber + 1,
        updatedAt: new Date(),
      },
    });

    return this.mapContentResponse(updatedContent);
  }

  async getVersionHistory(organizationId: string, id: string) {
    const content = await this.findOne(organizationId, id);
    const versions: any[] = [content];

    let currentVersion = content;
    while (currentVersion.previousVersionId) {
      const previousVersion = await this.db.content.findFirst({
        where: { id: currentVersion.previousVersionId, organizationId },
      });
      if (previousVersion) {
        versions.push(this.mapContentResponse(previousVersion));
        currentVersion = previousVersion;
      } else {
        break;
      }
    }

    return versions;
  }

  // ============================================================================
  // CONTENT EXPIRATION
  // ============================================================================

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredContent() {
    const now = new Date();

    // Find all expired content that is still active
    const expiredContent = await this.db.content.findMany({
      where: {
        expiresAt: { lte: now },
        status: 'active',
      },
    });

    for (const content of expiredContent) {
      if (content.replacementContentId) {
        // Replace with replacement content in playlists
        await this.db.playlistItem.updateMany({
          where: { contentId: content.id },
          data: { contentId: content.replacementContentId },
        });
      } else {
        // Remove from playlists
        await this.db.playlistItem.deleteMany({
          where: { contentId: content.id },
        });
      }

      // Mark content as expired
      await this.db.content.update({
        where: { id: content.id },
        data: { status: 'expired' },
      });
    }

    return { processed: expiredContent.length };
  }

  async setExpiration(
    organizationId: string,
    id: string,
    expiresAt: Date,
    replacementContentId?: string,
  ) {
    await this.findOne(organizationId, id);

    // Validate replacement content if provided
    if (replacementContentId) {
      const replacement = await this.db.content.findFirst({
        where: { id: replacementContentId, organizationId },
      });
      if (!replacement) {
        throw new BadRequestException('Replacement content not found');
      }
    }

    const content = await this.db.content.update({
      where: { id },
      data: {
        expiresAt,
        replacementContentId,
      },
    });

    return this.mapContentResponse(content);
  }

  async clearExpiration(organizationId: string, id: string) {
    await this.findOne(organizationId, id);

    const content = await this.db.content.update({
      where: { id },
      data: {
        expiresAt: null,
        replacementContentId: null,
      },
    });

    return this.mapContentResponse(content);
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async bulkUpdate(organizationId: string, dto: BulkUpdateDto) {
    const { ids, ...updateData } = dto;

    // Verify all content belongs to organization
    const contentCount = await this.db.content.count({
      where: { id: { in: ids }, organizationId },
    });

    if (contentCount !== ids.length) {
      throw new BadRequestException('Some content items not found or not accessible');
    }

    // Validate replacement content if provided
    if (updateData.replacementContentId) {
      const replacement = await this.db.content.findFirst({
        where: { id: updateData.replacementContentId, organizationId },
      });
      if (!replacement) {
        throw new BadRequestException('Replacement content not found');
      }
    }

    const result = await this.db.content.updateMany({
      where: { id: { in: ids }, organizationId },
      data: updateData,
    });

    return { updated: result.count };
  }

  async bulkArchive(organizationId: string, dto: BulkArchiveDto) {
    const { ids } = dto;

    // Verify all content belongs to organization
    const contentCount = await this.db.content.count({
      where: { id: { in: ids }, organizationId },
    });

    if (contentCount !== ids.length) {
      throw new BadRequestException('Some content items not found or not accessible');
    }

    const result = await this.db.content.updateMany({
      where: { id: { in: ids }, organizationId },
      data: { status: 'archived' },
    });

    return { archived: result.count };
  }

  async bulkRestore(organizationId: string, dto: BulkRestoreDto) {
    const { ids } = dto;

    // Verify all content belongs to organization
    const contentCount = await this.db.content.count({
      where: { id: { in: ids }, organizationId },
    });

    if (contentCount !== ids.length) {
      throw new BadRequestException('Some content items not found or not accessible');
    }

    const result = await this.db.content.updateMany({
      where: { id: { in: ids }, organizationId },
      data: { status: 'active' },
    });

    return { restored: result.count };
  }

  async bulkDelete(organizationId: string, dto: BulkDeleteDto) {
    const { ids } = dto;

    // Verify all content belongs to organization
    const contentCount = await this.db.content.count({
      where: { id: { in: ids }, organizationId },
    });

    if (contentCount !== ids.length) {
      throw new BadRequestException('Some content items not found or not accessible');
    }

    const result = await this.db.content.deleteMany({
      where: { id: { in: ids }, organizationId },
    });

    return { deleted: result.count };
  }

  async bulkAddTags(organizationId: string, dto: BulkTagDto) {
    const { contentIds, tagIds, operation = 'add' } = dto;

    // Verify all content belongs to organization
    const contentCount = await this.db.content.count({
      where: { id: { in: contentIds }, organizationId },
    });

    if (contentCount !== contentIds.length) {
      throw new BadRequestException('Some content items not found or not accessible');
    }

    // Verify all tags belong to organization
    const tagCount = await this.db.tag.count({
      where: { id: { in: tagIds }, organizationId },
    });

    if (tagCount !== tagIds.length) {
      throw new BadRequestException('Some tags not found or not accessible');
    }

    if (operation === 'replace') {
      // Remove all existing tags for these content items
      await this.db.contentTag.deleteMany({
        where: { contentId: { in: contentIds } },
      });
    }

    if (operation === 'remove') {
      // Remove specified tags from content items
      const result = await this.db.contentTag.deleteMany({
        where: {
          contentId: { in: contentIds },
          tagId: { in: tagIds },
        },
      });
      return { removed: result.count };
    }

    // Add tags (for 'add' and 'replace' operations)
    const tagRelations: { contentId: string; tagId: string }[] = [];
    for (const contentId of contentIds) {
      for (const tagId of tagIds) {
        tagRelations.push({ contentId, tagId });
      }
    }

    // Use createMany with skipDuplicates to handle existing relations
    const result = await this.db.contentTag.createMany({
      data: tagRelations,
      skipDuplicates: true,
    });

    return { added: result.count };
  }

  async bulkSetDuration(organizationId: string, dto: BulkDurationDto) {
    const { ids, duration } = dto;

    // Verify all content belongs to organization
    const contentCount = await this.db.content.count({
      where: { id: { in: ids }, organizationId },
    });

    if (contentCount !== ids.length) {
      throw new BadRequestException('Some content items not found or not accessible');
    }

    const result = await this.db.content.updateMany({
      where: { id: { in: ids }, organizationId },
      data: { duration },
    });

    return { updated: result.count };
  }

  // ============================================================================
  // CONTENT TEMPLATES
  // ============================================================================

  /**
   * Create a new template content
   */
  async createTemplate(organizationId: string, dto: CreateTemplateDto) {
    // Validate template HTML
    const validation = this.templateRendering.validateTemplate(dto.templateHtml);
    if (!validation.valid) {
      throw new BadRequestException(
        `Template validation failed: ${validation.errors.join('; ')}`,
      );
    }

    // Build template metadata
    const metadata: TemplateMetadata = {
      templateHtml: dto.templateHtml,
      dataSource: dto.dataSource,
      refreshConfig: {
        enabled: dto.refreshConfig.enabled,
        intervalMinutes: dto.refreshConfig.intervalMinutes,
      },
      sampleData: dto.sampleData,
    };

    // Perform initial render with sample data or fetched data
    let renderedHtml = '';
    try {
      let data = dto.sampleData || {};
      if (dto.dataSource.type !== 'manual' && dto.dataSource.url) {
        data = await this.templateRendering.fetchDataFromSource(dto.dataSource);
      } else if (dto.dataSource.type === 'manual' && dto.dataSource.manualData) {
        data = dto.dataSource.manualData;
      }

      renderedHtml = this.templateRendering.processTemplate(dto.templateHtml, data);
      metadata.renderedHtml = renderedHtml;
      metadata.renderedAt = new Date().toISOString();
      metadata.refreshConfig.lastRefresh = new Date().toISOString();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Initial template render failed: ${message}`);
      metadata.refreshConfig.lastError = message;
      // Use sample data as fallback for initial render
      if (dto.sampleData) {
        try {
          renderedHtml = this.templateRendering.processTemplate(dto.templateHtml, dto.sampleData);
          metadata.renderedHtml = renderedHtml;
          metadata.renderedAt = new Date().toISOString();
        } catch {
          // Keep renderedHtml empty if sample data also fails
        }
      }
    }

    // Create the content record
    const content = await this.db.content.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: 'template',
        url: '', // Templates don't have a URL
        duration: dto.duration || 30,
        metadata: metadata as any,
        organizationId,
      },
    });

    return this.mapContentResponse(content);
  }

  /**
   * Update an existing template
   */
  async updateTemplate(organizationId: string, id: string, dto: UpdateTemplateDto) {
    const existing = await this.findOne(organizationId, id);

    if (existing.type !== 'template') {
      throw new BadRequestException('Content is not a template');
    }

    const existingMetadata = (existing.metadata || {}) as TemplateMetadata;

    // Validate new template HTML if provided
    if (dto.templateHtml) {
      const validation = this.templateRendering.validateTemplate(dto.templateHtml);
      if (!validation.valid) {
        throw new BadRequestException(
          `Template validation failed: ${validation.errors.join('; ')}`,
        );
      }
    }

    // Build updated metadata
    const metadata: TemplateMetadata = {
      templateHtml: dto.templateHtml ?? existingMetadata.templateHtml,
      dataSource: dto.dataSource ?? existingMetadata.dataSource,
      refreshConfig: {
        enabled: dto.refreshConfig?.enabled ?? existingMetadata.refreshConfig?.enabled ?? false,
        intervalMinutes: dto.refreshConfig?.intervalMinutes ?? existingMetadata.refreshConfig?.intervalMinutes ?? 60,
        lastRefresh: existingMetadata.refreshConfig?.lastRefresh,
        lastError: existingMetadata.refreshConfig?.lastError,
      },
      sampleData: dto.sampleData ?? existingMetadata.sampleData,
      renderedHtml: existingMetadata.renderedHtml,
      renderedAt: existingMetadata.renderedAt,
    };

    // Re-render if template or data source changed
    if (dto.templateHtml || dto.dataSource || dto.sampleData) {
      try {
        let data = metadata.sampleData || {};
        const dataSource = metadata.dataSource;

        if (dataSource.type !== 'manual' && dataSource.url) {
          data = await this.templateRendering.fetchDataFromSource(dataSource);
        } else if (dataSource.type === 'manual' && dataSource.manualData) {
          data = dataSource.manualData;
        }

        metadata.renderedHtml = this.templateRendering.processTemplate(
          metadata.templateHtml,
          data,
        );
        metadata.renderedAt = new Date().toISOString();
        metadata.refreshConfig.lastRefresh = new Date().toISOString();
        metadata.refreshConfig.lastError = undefined;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Template re-render failed: ${message}`);
        metadata.refreshConfig.lastError = message;
      }
    }

    const content = await this.db.content.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        duration: dto.duration,
        metadata: metadata as any,
      },
    });

    return this.mapContentResponse(content);
  }

  /**
   * Preview a template with data without saving
   */
  async previewTemplate(dto: PreviewTemplateDto): Promise<{ html: string }> {
    // Validate template
    const validation = this.templateRendering.validateTemplate(dto.templateHtml);
    if (!validation.valid) {
      throw new BadRequestException(
        `Template validation failed: ${validation.errors.join('; ')}`,
      );
    }

    let data = dto.sampleData || {};

    // Fetch data from source if provided and not manual
    if (dto.dataSource) {
      if (dto.dataSource.type !== 'manual' && dto.dataSource.url) {
        data = await this.templateRendering.fetchDataFromSource(dto.dataSource);
      } else if (dto.dataSource.type === 'manual' && dto.dataSource.manualData) {
        data = dto.dataSource.manualData;
      }
    }

    const html = this.templateRendering.processTemplate(dto.templateHtml, data);
    return { html };
  }

  /**
   * Get rendered HTML for a template
   */
  async getRenderedTemplate(organizationId: string, id: string): Promise<{ html: string; renderedAt: string | null }> {
    const content = await this.findOne(organizationId, id);

    if (content.type !== 'template') {
      throw new BadRequestException('Content is not a template');
    }

    const metadata = content.metadata as TemplateMetadata;

    return {
      html: metadata?.renderedHtml || '',
      renderedAt: metadata?.renderedAt || null,
    };
  }

  /**
   * Manually trigger a template refresh
   */
  async triggerTemplateRefresh(organizationId: string, id: string) {
    const content = await this.findOne(organizationId, id);

    if (content.type !== 'template') {
      throw new BadRequestException('Content is not a template');
    }

    const metadata = content.metadata as TemplateMetadata;

    if (!metadata?.templateHtml) {
      throw new BadRequestException('Template has no HTML');
    }

    // Fetch fresh data and re-render
    let data = metadata.sampleData || {};

    try {
      if (metadata.dataSource.type !== 'manual' && metadata.dataSource.url) {
        data = await this.templateRendering.fetchDataFromSource(metadata.dataSource);
      } else if (metadata.dataSource.type === 'manual' && metadata.dataSource.manualData) {
        data = metadata.dataSource.manualData;
      }

      const renderedHtml = this.templateRendering.processTemplate(metadata.templateHtml, data);

      // Update the content with new rendered HTML
      const updatedMetadata: TemplateMetadata = {
        ...metadata,
        renderedHtml,
        renderedAt: new Date().toISOString(),
        refreshConfig: {
          ...metadata.refreshConfig,
          lastRefresh: new Date().toISOString(),
          lastError: undefined,
        },
      };

      const updated = await this.db.content.update({
        where: { id },
        data: {
          metadata: updatedMetadata as any,
        },
      });

      return this.mapContentResponse(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Update error in metadata
      const updatedMetadata: TemplateMetadata = {
        ...metadata,
        refreshConfig: {
          ...metadata.refreshConfig,
          lastError: message,
        },
      };

      await this.db.content.update({
        where: { id },
        data: {
          metadata: updatedMetadata as any,
        },
      });

      throw new BadRequestException(`Template refresh failed: ${message}`);
    }
  }

  /**
   * Validate template HTML without saving
   */
  validateTemplateHtml(templateHtml: string) {
    return this.templateRendering.validateTemplate(templateHtml);
  }
}
