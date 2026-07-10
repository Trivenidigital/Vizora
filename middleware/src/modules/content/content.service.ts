import { Injectable, NotFoundException, BadRequestException, Logger, ServiceUnavailableException, BadGatewayException, HttpException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@vizora/database';
import { DatabaseService } from '../database/database.service';
import { CronLeaderService } from '../common/services/cron-leader.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { BulkUpdateDto, BulkArchiveDto, BulkRestoreDto, BulkDeleteDto, BulkTagDto, BulkDurationDto } from './dto/bulk-operations.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TemplateRenderingService } from './template-rendering.service';
import { CreateLayoutDto, LayoutZoneDto } from './dto/create-layout.dto';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { LAYOUT_PRESETS } from './layout-presets';
import { DataSourceRegistryService } from './data-source-registry.service';
import { StorageQuotaService } from '../storage/storage-quota.service';
import { StorageService } from '../storage/storage.service';
import type { WidgetDataSource } from './widget-data-sources';
import { buildContentListWhere, type ContentListFilters } from './content-list-query';
import { CONTENT_LIST_SELECT, mapContentListResponse } from './content-list-select';
import {
  assertOrgOwnedMinioObjectKey,
  getCleanupSafeMinioObjectKey,
  getOwnedMinioObjectKey,
  isMinioUrl,
  MINIO_URL_PREFIX,
} from '../storage/minio-object-key';
import * as fs from 'fs';
import * as path from 'path';

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
    manualData?: Record<string, unknown>;
  };
  refreshConfig: {
    enabled: boolean;
    intervalMinutes: number;
    lastRefresh?: string;
    lastError?: string;
  };
  sampleData?: Record<string, unknown>;
  renderedHtml?: string;
  renderedAt?: string;
}

/**
 * Interface for widget metadata stored in Content.metadata
 */
export interface WidgetMetadata {
  isWidget: true;
  widgetType: string;
  widgetConfig: Record<string, unknown>;
  templateName: string;
  templateHtml: string;
  renderedHtml?: string;
  renderedAt?: string;
  lastError?: string;
}

const REDACTED_WIDGET_SECRET = '********';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly templateRendering: TemplateRenderingService,
    private readonly dataSourceRegistry: DataSourceRegistryService,
    private readonly storageQuotaService: StorageQuotaService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsService: NotificationsService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  // Map database content to API response format
  private mapContentResponse(content: Record<string, unknown> | null) {
    if (!content) return content;
    return {
      ...content,
      metadata: this.redactWidgetMetadataForResponse(content.metadata),
      title: content.name, // Map name to title for frontend compatibility
      thumbnailUrl: content.thumbnail, // Map thumbnail to thumbnailUrl for frontend
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private redactWidgetMetadataForResponse(metadata: unknown): unknown {
    if (!this.isRecord(metadata) || metadata.isWidget !== true) return metadata;

    return {
      ...metadata,
      widgetConfig: this.redactWidgetConfigForResponse(
        typeof metadata.widgetType === 'string' ? metadata.widgetType : '',
        metadata.widgetConfig,
      ),
    };
  }

  private redactWidgetConfigForResponse(widgetType: string, config: unknown): unknown {
    if (widgetType !== 'generic-api' || !this.isRecord(config) || !this.isRecord(config.headers)) {
      return config;
    }

    return {
      ...config,
      headers: Object.fromEntries(
        Object.keys(config.headers).map((key) => [key, REDACTED_WIDGET_SECRET]),
      ),
    };
  }

  private restoreRedactedWidgetConfig(
    widgetType: string,
    nextConfig: Record<string, unknown>,
    previousConfig: unknown,
  ): Record<string, unknown> {
    if (
      widgetType !== 'generic-api'
      || !this.isRecord(nextConfig.headers)
      || !this.isRecord(previousConfig)
      || !this.isRecord(previousConfig.headers)
    ) {
      return nextConfig;
    }

    return {
      ...nextConfig,
      headers: Object.fromEntries(
        Object.entries(nextConfig.headers).map(([key, value]) => [
          key,
          value === REDACTED_WIDGET_SECRET
            ? previousConfig.headers[key]
            : value,
        ]),
      ),
    };
  }

  async create(organizationId: string, createContentDto: CreateContentDto) {
    getOwnedMinioObjectKey(organizationId, createContentDto.url);
    getOwnedMinioObjectKey(organizationId, createContentDto.thumbnail);

    const content = await this.db.content.create({
      data: {
        ...createContentDto,
        organizationId,
      },
    });
    this.eventEmitter.emit('content.created', { action: 'created', entityType: 'content', entityId: content.id, organizationId });
    return this.mapContentResponse(content);
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters?: ContentListFilters,
  ) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where = buildContentListWhere(organizationId, filters);

    const [data, total] = await Promise.all([
      this.db.content.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: CONTENT_LIST_SELECT,
      }),
      this.db.content.count({ where }),
    ]);

    // Map each content item to include thumbnailUrl
    const mappedData = data.map(mapContentListResponse);
    return new PaginatedResponse(mappedData, total, page, limit);
  }

  async listContentTags(organizationId: string) {
    const tags = await this.db.tag.findMany({
      where: {
        organizationId,
        content: {
          some: {
            content: {
              organizationId,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        color: true,
        _count: {
          select: {
            content: {
              where: {
                content: {
                  organizationId,
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      contentCount: tag._count.content,
    }));
  }

  /**
   * Find all widgets (content with type 'template' and metadata.isWidget = true)
   */
  async findAllWidgets(organizationId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ContentWhereInput = {
      organizationId,
      type: 'template',
      metadata: { path: ['isWidget'], equals: true },
    };

    const [data, total] = await Promise.all([
      this.db.content.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.content.count({ where }),
    ]);

    const mappedData = data.map(item => this.mapContentResponse(item));
    return new PaginatedResponse(mappedData, total, page, limit);
  }

  /**
   * Find all layouts (content with type 'layout')
   */
  async findAllLayouts(organizationId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ContentWhereInput = {
      organizationId,
      type: 'layout',
    };

    const [data, total] = await Promise.all([
      this.db.content.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.content.count({ where }),
    ]);

    const mappedData = data.map(item => this.mapContentResponse(item));
    return new PaginatedResponse(mappedData, total, page, limit);
  }

  /**
   * Find content for device serving. The org filter is applied in the
   * query (not after the fetch) so an attacker who guesses a content
   * ID from another org gets a uniform NotFoundException without the
   * service ever having loaded that org's record into memory.
   *
   * Callers MUST verify the device JWT before calling this and pass
   * the device's organizationId from the verified payload.
   */
  async findByIdForDevice(id: string, organizationId: string) {
    const content = await this.db.content.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        organizationId: true,
        url: true,
        mimeType: true,
      },
    });
    return content;
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
    getOwnedMinioObjectKey(organizationId, updateContentDto.url);
    getOwnedMinioObjectKey(organizationId, updateContentDto.thumbnail);

    // Defense-in-depth: include organizationId in where clause to prevent TOCTOU races
    const result = await this.db.content.updateMany({
      where: { id, organizationId },
      data: updateContentDto,
    });
    if (result.count === 0) {
      throw new NotFoundException('Content not found');
    }
    const content = await this.db.content.findUnique({ where: { id } });
    this.eventEmitter.emit('content.updated', { action: 'updated', entityType: 'content', entityId: id, organizationId });
    return this.mapContentResponse(content!);
  }

  async remove(organizationId: string, id: string) {
    const content = await this.findOne(organizationId, id);

    // Delete file from MinIO storage if it exists
    if (content.fileKey) {
      assertOrgOwnedMinioObjectKey(organizationId, content.fileKey);
      try {
        await this.storageService.deleteFile(content.fileKey);
      } catch (error) {
        this.logger.error(`Failed to delete file ${content.fileKey} from storage: ${error}`);
        throw new ServiceUnavailableException('Content file could not be deleted from storage; DB row retained for retry');
      }
    } else {
      const objectKey = getOwnedMinioObjectKey(organizationId, content.url);
      if (objectKey) {
        try {
          await this.storageService.deleteFile(objectKey);
        } catch (error) {
          this.logger.error(`Failed to delete file ${objectKey} from storage: ${error}`);
          throw new ServiceUnavailableException('Content file could not be deleted from storage; DB row retained for retry');
        }
      }
    }

    // Defense-in-depth: include organizationId in where clause to prevent TOCTOU races
    const deleted = await this.db.content.deleteMany({
      where: { id, organizationId },
    });

    // Decrement storage usage only if this request actually removed the row.
    // Concurrent deletes can both read the row before one delete wins.
    if (deleted.count > 0 && content.fileSize && content.fileSize > 0) {
      await this.storageQuotaService.decrementUsage(organizationId, content.fileSize);
    }

    if (deleted.count > 0) {
      this.eventEmitter.emit('content.deleted', { action: 'deleted', entityType: 'content', entityId: id, organizationId });
    }
    return deleted;
  }

  async archive(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    // Defense-in-depth: include organizationId in where clause to prevent TOCTOU races
    const result = await this.db.content.updateMany({
      where: { id, organizationId },
      data: { status: 'archived' },
    });
    if (result.count === 0) {
      throw new NotFoundException('Content not found');
    }
    return this.db.content.findUnique({ where: { id } });
  }

  async restore(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    // Defense-in-depth: include organizationId in where clause to prevent TOCTOU races
    const result = await this.db.content.updateMany({
      where: { id, organizationId },
      data: { status: 'active' },
    });
    if (result.count === 0) {
      throw new NotFoundException('Content not found');
    }
    return this.db.content.findUnique({ where: { id } });
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
    getOwnedMinioObjectKey(organizationId, newUrl);
    getOwnedMinioObjectKey(organizationId, options.thumbnail);

    const existingContent = await this.findOne(organizationId, id);
    const previousObjectKey = getCleanupSafeMinioObjectKey(organizationId, existingContent.url);
    const backupThumbnail = this.getBackupSafeThumbnail(organizationId, existingContent.thumbnail);
    const thumbnailUpdate = this.getReplacementThumbnailUpdate(
      organizationId,
      existingContent.thumbnail,
      options.thumbnail,
    );

    if (options.keepBackup) {
      if (isMinioUrl(existingContent.url) && !previousObjectKey) {
        throw new BadRequestException('Cannot keep backup for content file outside organization scope');
      }

      // Create backup and update original in a transaction to prevent data loss
      const updatedContent = await this.db.$transaction(async (tx) => {
        const backupContent = await tx.content.create({
          data: {
            name: `${existingContent.name} (v${existingContent.versionNumber})`,
            description: existingContent.description,
            type: existingContent.type,
            url: existingContent.url,
            thumbnail: backupThumbnail,
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

        // Defense-in-depth: verify org ownership inside transaction
        const verified = await tx.content.findFirst({ where: { id, organizationId } });
        if (!verified) throw new NotFoundException('Content not found');

        return tx.content.update({
          where: { id },
          data: {
            url: newUrl,
            name: options.name || existingContent.name,
            ...thumbnailUpdate,
            fileSize: options.fileSize,
            mimeType: options.mimeType,
            versionNumber: existingContent.versionNumber + 1,
            previousVersionId: backupContent.id,
            updatedAt: new Date(),
          },
        });
      });

      return this.mapContentResponse(updatedContent);
    }

    // Simple replacement without backup — defense-in-depth org scoping
    const result = await this.db.content.updateMany({
      where: { id, organizationId },
      data: {
        url: newUrl,
        name: options.name || existingContent.name,
        ...thumbnailUpdate,
        fileSize: options.fileSize,
        mimeType: options.mimeType,
        versionNumber: existingContent.versionNumber + 1,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) {
      throw new NotFoundException('Content not found');
    }
    const updatedContent = await this.db.content.findUnique({ where: { id } });

    if (previousObjectKey && newUrl !== `${MINIO_URL_PREFIX}${previousObjectKey}`) {
      await this.cleanupPreviousReplacementObject(
        organizationId,
        id,
        previousObjectKey,
        existingContent.fileSize,
        existingContent.metadata,
      );
    }

    return this.mapContentResponse(updatedContent);
  }

  private getBackupSafeThumbnail(
    organizationId: string,
    existingThumbnail: unknown,
  ): string | null | undefined {
    if (
      isMinioUrl(existingThumbnail) &&
      !getCleanupSafeMinioObjectKey(organizationId, existingThumbnail)
    ) {
      return null;
    }

    return existingThumbnail as string | null | undefined;
  }

  private getReplacementThumbnailUpdate(
    organizationId: string,
    existingThumbnail: unknown,
    replacementThumbnail?: string,
  ): { thumbnail?: string | null } {
    if (replacementThumbnail !== undefined) {
      return { thumbnail: replacementThumbnail };
    }

    if (
      isMinioUrl(existingThumbnail) &&
      !getCleanupSafeMinioObjectKey(organizationId, existingThumbnail)
    ) {
      return { thumbnail: null };
    }

    return {};
  }

  private async cleanupPreviousReplacementObject(
    organizationId: string,
    contentId: string,
    previousObjectKey: string,
    previousFileSize?: number | null,
    metadata?: unknown,
  ): Promise<void> {
    try {
      await this.storageService.deleteFile(previousObjectKey);
      return;
    } catch (error) {
      this.logger.warn(
        `Replacement kept previous storage object ${previousObjectKey} after delete failure: ${error}`,
      );
    }

    // The DB row already points at the replacement object by this point. Any
    // accounting/audit cleanup below must not make the controller delete that
    // replacement object as if the whole replace failed.
    try {
      if (previousFileSize && previousFileSize > 0) {
        await this.storageQuotaService.incrementUsage(organizationId, previousFileSize);
      }
    } catch (error) {
      this.logger.error(`Failed to account retained previous object ${previousObjectKey}: ${error}`);
    }

    try {
      const previousMetadata =
        metadata &&
        typeof metadata === 'object' &&
        !Array.isArray(metadata)
          ? (metadata as Record<string, unknown>)
          : {};
      await this.db.content.updateMany({
        where: { id: contentId, organizationId },
        data: {
          metadata: {
            ...previousMetadata,
            orphanedPreviousFileKey: previousObjectKey,
            orphanedPreviousFileDeleteFailedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to mark retained previous object ${previousObjectKey}: ${error}`);
    }
  }

  async getVersionHistory(organizationId: string, id: string) {
    const content = await this.findOne(organizationId, id);
    const versions: Record<string, unknown>[] = [content];

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
    let result: { processed: number; playlistsRefreshed: number } = {
      processed: 0,
      playlistsRefreshed: 0,
    };

    await this.cronLeader.runExclusive('content-expiration', async () => {
      const now = new Date();

      // Find all expired content that is still active
      const expiredContent = await this.db.content.findMany({
        where: {
          expiresAt: { lte: now },
          status: 'active',
        },
      });

      // Collect (playlistId, organizationId) pairs that need a device-fleet
      // push after the transaction commits — without this, device clients
      // continue serving the expired content (or the now-deleted playlist
      // slot) until they reconnect, sometimes hours later.
      const affectedPlaylists: Array<{ playlistId: string; organizationId: string }> = [];

      for (const content of expiredContent) {
        await this.db.$transaction(async (tx) => {
          // Snapshot playlistIds BEFORE the updateMany / deleteMany — we
          // can't read them after the contentId rewrite or row deletion.
          const items = await tx.playlistItem.findMany({
            where: { contentId: content.id },
            select: { playlistId: true },
          });
          const distinctPlaylistIds = Array.from(new Set(items.map((i) => i.playlistId)));

          if (content.replacementContentId) {
            // Validate the replacement is (a) same-organization AND (b) itself
            // still servable — status 'active' and not itself expired. Without the
            // status/expiry guard, an expired or archived replacement would be
            // repointed onto devices, defeating the expiration entirely (a
            // replacement chain could push already-dead content). A non-servable
            // replacement falls through to the delete-items branch, exactly as if
            // no replacement had been configured.
            const replacement = await tx.content.findFirst({
              where: {
                id: content.replacementContentId,
                organizationId: content.organizationId,
                status: 'active',
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
            });

            if (replacement) {
              await tx.playlistItem.updateMany({
                where: { contentId: content.id },
                data: { contentId: content.replacementContentId },
              });
            } else {
              // Cross-org, missing, or not-itself-active replacement -- remove
              // playlist items rather than serve stale content.
              this.logger.warn(
                `Expired content ${content.id} has unusable replacementContentId ${content.replacementContentId} (org mismatch, not found, or itself expired/archived). Removing playlist items.`,
              );
              await tx.playlistItem.deleteMany({
                where: { contentId: content.id },
              });
            }
          } else {
            await tx.playlistItem.deleteMany({
              where: { contentId: content.id },
            });
          }

          await tx.content.update({
            where: { id: content.id },
            data: { status: 'expired' },
          });

          for (const playlistId of distinctPlaylistIds) {
            affectedPlaylists.push({
              playlistId,
              organizationId: content.organizationId,
            });
          }
        });
      }

      // Notify device fleet AFTER the transactions commit so the realtime
      // gateway pushes the up-to-date playlist (with replacement content
      // swapped in OR with the expired slot removed). De-dup by playlistId
      // — a single playlist with N expired items only needs one push.
      const distinctAffected = new Map<string, string>();
      for (const a of affectedPlaylists) {
        distinctAffected.set(a.playlistId, a.organizationId);
      }
      for (const [playlistId, organizationId] of distinctAffected) {
        // playlist.updated is already listened-to by PlaylistsService's
        // notifyDisplaysOfPlaylistUpdate plumbing (via the @OnEvent
        // handler that triggers off this event), so the device push
        // pipeline is reused exactly. action='expired_content_replaced'
        // tags the event so downstream consumers (audit log, ops
        // dashboards) can distinguish a system-driven push from an
        // operator-driven edit.
        this.eventEmitter.emit('playlist.updated', {
          entityId: playlistId,
          organizationId,
          action: 'expired_content_replaced',
        });
      }

      result = { processed: expiredContent.length, playlistsRefreshed: distinctAffected.size };
    });

    return result;
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

    // Defense-in-depth: include organizationId in where clause to prevent TOCTOU races
    const result = await this.db.content.updateMany({
      where: { id, organizationId },
      data: {
        expiresAt,
        replacementContentId,
      },
    });
    if (result.count === 0) {
      throw new NotFoundException('Content not found');
    }
    const content = await this.db.content.findUnique({ where: { id } });

    return this.mapContentResponse(content);
  }

  async clearExpiration(organizationId: string, id: string) {
    await this.findOne(organizationId, id);

    // Defense-in-depth: include organizationId in where clause to prevent TOCTOU races
    const result = await this.db.content.updateMany({
      where: { id, organizationId },
      data: {
        expiresAt: null,
        replacementContentId: null,
      },
    });
    if (result.count === 0) {
      throw new NotFoundException('Content not found');
    }
    const content = await this.db.content.findUnique({ where: { id } });

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
    const uniqueIds = Array.from(new Set(ids));

    // Fetch items with file info for storage cleanup
    const items = await this.db.content.findMany({
      where: { id: { in: uniqueIds }, organizationId },
      select: { id: true, fileSize: true, url: true, metadata: true },
    });

    if (items.length !== uniqueIds.length) {
      throw new BadRequestException('Some content items not found or not accessible');
    }

    // Delete files from storage, tracking which items succeeded.
    //
    // Previously the function ran Promise.allSettled, logged failures,
    // then deleteMany'd ALL DB rows — leaving the failed-MinIO files
    // ORPHANED forever (consuming quota with no DB row pointing to
    // them, no operator visibility). The new shape only deletes the DB
    // rows whose storage file actually went away; failures stay in the
    // DB so the operator (or a retry cron) can re-attempt the delete
    // later. Quota decrement matches the same successful-only set.
    const deletableIds: string[] = [];
    const failedIds: string[] = [];
    await Promise.all(
      items.map(async (item) => {
        let objectKey: string | null = null;
        try {
          objectKey = getOwnedMinioObjectKey(organizationId, item.url);
        } catch (err) {
          failedIds.push(item.id);
          this.logger.warn(
            `Bulk delete: content ${item.id} points at a MinIO object outside organization scope: ${
              err instanceof Error ? err.message : err
            }. DB row retained for operator review.`,
          );
          return;
        }
        if (!objectKey) {
          // No file to delete (e.g., url-type content) — safe to drop DB row.
          deletableIds.push(item.id);
          return;
        }
        try {
          await this.storageService.deleteFile(objectKey);
          deletableIds.push(item.id);
        } catch (err) {
          failedIds.push(item.id);
          this.logger.warn(
            `Bulk delete: storage delete failed for content ${item.id} (key=${objectKey}): ${
              err instanceof Error ? err.message : err
            }. DB row retained for retry.`,
          );
        }
      }),
    );

    let deleted = 0;
    if (deletableIds.length > 0) {
      for (const item of items.filter((i) => deletableIds.includes(i.id))) {
        const bytes = item.fileSize || 0;
        try {
          const result = await this.db.content.deleteMany({
            where: { id: item.id, organizationId },
          });
          if (result.count > 0) {
            deleted += result.count;
            if (bytes > 0) {
              await this.storageQuotaService.decrementUsage(organizationId, bytes);
            }
          }
        } catch (err) {
          failedIds.push(item.id);
          this.logger.warn(
            `Bulk delete: DB delete failed for content ${item.id} after storage cleanup: ${
              err instanceof Error ? err.message : err
            }. Row retained but storage quota is adjusted to match removed object.`,
          );
          try {
            const previousMetadata =
              item.metadata &&
              typeof item.metadata === 'object' &&
              !Array.isArray(item.metadata)
                ? (item.metadata as Record<string, unknown>)
                : {};
            await this.db.content.updateMany({
              where: { id: item.id, organizationId },
              data: {
                status: 'archived',
                metadata: {
                  ...previousMetadata,
                  bulkDeleteDbDeleteFailedAt: new Date().toISOString(),
                  storageObjectRemovedDuringBulkDelete: true,
                } as Prisma.InputJsonValue,
              },
            });
            await this.db.playlistItem.deleteMany({
              where: { contentId: item.id },
            });
          } catch (markError) {
            this.logger.error(
              `Bulk delete: failed to mark retained row or remove playlist assignments for ${item.id} after storage cleanup: ${markError}`,
            );
          }
          if (bytes > 0) {
            await this.storageQuotaService.decrementUsage(organizationId, bytes);
          }
        }
      }
    }

    return { deleted, failed: failedIds.length, failedIds };
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

    // Dedupe both arrays before the org-scope checks. Prisma's
    // `id: { in: [...] }` collapses duplicates internally, so
    // comparing the count against the RAW length would falsely
    // reject a request where the client posted the same tag id
    // twice (same false-positive that PR #73 fixed for playlists).
    const uniqueContentIds = Array.from(new Set(contentIds));
    const uniqueTagIds = Array.from(new Set(tagIds));

    if (uniqueContentIds.length !== contentIds.length) {
      // Re-check the org-scope count against the unique set so the
      // cardinality comparison is apples-to-apples.
      const recheck = await this.db.content.count({
        where: { id: { in: uniqueContentIds }, organizationId },
      });
      if (recheck !== uniqueContentIds.length) {
        throw new BadRequestException('Some content items not found or not accessible');
      }
    }

    // Verify all tags belong to organization
    const tagCount = await this.db.tag.count({
      where: { id: { in: uniqueTagIds }, organizationId },
    });

    if (tagCount !== uniqueTagIds.length) {
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
  // CONTENT MODERATION
  // ============================================================================

  /**
   * Flag content for review. Any authenticated user in the org can flag content.
   * Stores moderation metadata in the JSON metadata field and sets status to 'flagged'.
   */
  async flagContent(
    organizationId: string,
    id: string,
    flaggedBy: string,
    reason?: string,
  ) {
    const content = await this.findOne(organizationId, id);

    if (content.status === 'flagged') {
      throw new BadRequestException('Content is already flagged for review');
    }
    if (content.status === 'archived' || content.status === 'rejected') {
      throw new BadRequestException('Cannot flag archived or rejected content');
    }

    const existingMetadata = (content.metadata || {}) as Record<string, unknown>;
    const moderationMetadata = {
      ...existingMetadata,
      moderation: {
        flagged: true,
        flaggedBy,
        flaggedAt: new Date().toISOString(),
        flagReason: reason || null,
        previousStatus: content.status,
      },
    };

    const result = await this.db.content.updateMany({
      where: { id, organizationId },
      data: {
        status: 'flagged',
        metadata: moderationMetadata as Prisma.InputJsonValue,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Content not found');
    }

    const updated = await this.db.content.findUnique({ where: { id } });

    // Notify org admins about flagged content
    try {
      await this.notificationsService.create({
        title: 'Content flagged for review',
        message: `Content "${content.name}" has been flagged for review${reason ? `: ${reason}` : ''}`,
        type: 'system',
        severity: 'warning',
        organizationId,
        metadata: { contentId: id, flaggedBy, reason },
      });
    } catch (error) {
      this.logger.warn(`Failed to create flag notification: ${error}`);
    }

    this.eventEmitter.emit('content.flagged', {
      action: 'flagged',
      entityType: 'content',
      entityId: id,
      organizationId,
    });

    return this.mapContentResponse(updated);
  }

  /**
   * Review flagged content: approve (restore to previous status) or reject (archive + remove from playlists).
   * Only admins and managers can review content.
   */
  async reviewContent(
    organizationId: string,
    id: string,
    reviewedBy: string,
    action: 'approve' | 'reject',
    reason?: string,
  ) {
    const content = await this.findOne(organizationId, id);

    if (content.status !== 'flagged') {
      throw new BadRequestException('Only flagged content can be reviewed');
    }

    const existingMetadata = (content.metadata || {}) as Record<string, unknown>;
    const moderation = (existingMetadata.moderation || {}) as Record<string, unknown>;

    if (action === 'approve') {
      // Restore to the status the content had before it was flagged
      const previousStatus = (moderation.previousStatus as string) || 'active';

      const approvedMetadata = {
        ...existingMetadata,
        moderation: {
          ...moderation,
          flagged: false,
          reviewedBy,
          reviewedAt: new Date().toISOString(),
          reviewAction: 'approved',
          reviewReason: reason || null,
        },
      };

      const result = await this.db.content.updateMany({
        where: { id, organizationId },
        data: {
          status: previousStatus,
          metadata: approvedMetadata as Prisma.InputJsonValue,
        },
      });

      if (result.count === 0) {
        throw new NotFoundException('Content not found');
      }

      const updated = await this.db.content.findUnique({ where: { id } });

      this.eventEmitter.emit('content.approved', {
        action: 'approved',
        entityType: 'content',
        entityId: id,
        organizationId,
      });

      return this.mapContentResponse(updated);
    }

    // action === 'reject'
    // Reject the content and remove from org playlists
    const rejectedMetadata = {
      ...existingMetadata,
      moderation: {
        ...moderation,
        flagged: false,
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        reviewAction: 'rejected',
        reviewReason: reason || null,
      },
    };

    await this.db.$transaction(async (tx) => {
      // Remove from playlists within the same organization only
      await tx.playlistItem.deleteMany({
        where: {
          contentId: id,
          playlist: { organizationId },
        },
      });

      // Set status to rejected
      await tx.content.updateMany({
        where: { id, organizationId },
        data: {
          status: 'rejected',
          metadata: rejectedMetadata as Prisma.InputJsonValue,
        },
      });
    });

    const updated = await this.db.content.findUnique({ where: { id } });

    // Notify that content was rejected
    try {
      await this.notificationsService.create({
        title: 'Content rejected',
        message: `Content "${content.name}" has been rejected and removed from playlists${reason ? `: ${reason}` : ''}`,
        type: 'system',
        severity: 'info',
        organizationId,
        metadata: { contentId: id, reviewedBy, reason },
      });
    } catch (error) {
      this.logger.warn(`Failed to create rejection notification: ${error}`);
    }

    this.eventEmitter.emit('content.rejected', {
      action: 'rejected',
      entityType: 'content',
      entityId: id,
      organizationId,
    });

    return this.mapContentResponse(updated);
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
        metadata: metadata as Prisma.InputJsonValue,
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
        metadata: metadata as Prisma.InputJsonValue,
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
          metadata: updatedMetadata as Prisma.InputJsonValue,
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
          metadata: updatedMetadata as Prisma.InputJsonValue,
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

  // ============================================================================
  // MULTI-ZONE LAYOUTS
  // ============================================================================

  /**
   * Get all available layout presets
   */
  getLayoutPresets() {
    return LAYOUT_PRESETS;
  }

  /**
   * Create a new multi-zone layout
   */
  async createLayout(organizationId: string, dto: CreateLayoutDto) {
    const zones = dto.zones ?? this.getPresetZonesForType(dto.layoutType);
    if (!zones || zones.length === 0) {
      throw new BadRequestException(
        dto.layoutType === 'custom'
          ? 'Layout zones are required for custom layouts'
          : `Unknown layout preset: ${dto.layoutType}`,
      );
    }

    const metadata = {
      layoutType: dto.layoutType,
      zones,
      gridTemplate: dto.gridTemplate || this.getGridTemplateForType(dto.layoutType),
      gap: dto.gap ?? 0,
      backgroundColor: dto.backgroundColor || '#000000',
    };

    const content = await this.db.content.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: 'layout',
        url: '',
        metadata: metadata as Prisma.InputJsonValue,
        organizationId,
      },
    });

    return this.mapContentResponse(content);
  }

  /**
   * Update an existing layout
   */
  async updateLayout(organizationId: string, id: string, dto: Partial<CreateLayoutDto>) {
    const existing = await this.findOne(organizationId, id);

    if (existing.type !== 'layout') {
      throw new BadRequestException('Content is not a layout');
    }

    const existingMetadata = (existing.metadata as Record<string, unknown>) || {};

    const metadata = {
      layoutType: dto.layoutType || existingMetadata.layoutType,
      zones: dto.zones || existingMetadata.zones,
      gridTemplate: dto.gridTemplate || existingMetadata.gridTemplate,
      gap: dto.gap ?? existingMetadata.gap ?? 0,
      backgroundColor: dto.backgroundColor || existingMetadata.backgroundColor || '#000000',
    };

    const content = await this.db.content.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return this.mapContentResponse(content);
  }

  /**
   * Get a layout with all zone content fully resolved
   * Fetches playlist items and content for each zone
   */
  async getResolvedLayout(organizationId: string, id: string) {
    const layout = await this.findOne(organizationId, id);

    if (layout.type !== 'layout') {
      throw new BadRequestException('Content is not a layout');
    }

    const metadata = (layout.metadata as Record<string, unknown>) || {};
    const zones = (Array.isArray(metadata.zones) ? metadata.zones : []) as Record<string, unknown>[];

    // Batch-fetch all playlist and content IDs to avoid N+1 queries
    const playlistIds = zones.filter((z) => z.playlistId).map((z) => z.playlistId as string);
    const contentIds = zones.filter((z) => z.contentId).map((z) => z.contentId as string);

    const [playlists, contents] = await Promise.all([
      playlistIds.length > 0
        ? this.db.playlist.findMany({
            where: { id: { in: playlistIds }, organizationId },
            include: {
              items: {
                include: { content: true },
                orderBy: { order: 'asc' },
              },
            },
          })
        : Promise.resolve([]),
      contentIds.length > 0
        ? this.db.content.findMany({
            where: { id: { in: contentIds }, organizationId },
          })
        : Promise.resolve([]),
    ]);

    const playlistMap = new Map(playlists.map((p) => [p.id, p]));
    const contentMap = new Map(contents.map((c) => [c.id, c]));

    // Resolve content for each zone using pre-fetched data
    const resolvedZones = zones.map((zone) => {
      const resolved: Record<string, unknown> = { ...zone };

      if (zone.playlistId) {
        const playlist = playlistMap.get(zone.playlistId as string);
        if (playlist) {
          resolved.resolvedPlaylist = {
            id: playlist.id,
            name: playlist.name,
            items: playlist.items.map((item) => ({
              id: item.id,
              contentId: item.contentId,
              duration: item.duration || 10,
              order: item.order,
              content: item.content ? this.mapContentResponse(item.content as unknown as Record<string, unknown>) : null,
            })),
          };
        }
      }

      if (zone.contentId) {
        const content = contentMap.get(zone.contentId as string);
        if (content) {
          resolved.resolvedContent = this.mapContentResponse(content as unknown as Record<string, unknown>);
        }
      }

      return resolved;
    });

    return {
      ...this.mapContentResponse(layout),
      metadata: {
        ...metadata,
        zones: resolvedZones,
      },
    };
  }

  /**
   * Get default grid template for a layout type
   */
  private getGridTemplateForType(layoutType: string): { columns: string; rows: string } {
    const preset = LAYOUT_PRESETS.find(p => p.layoutType === layoutType);
    if (preset) {
      return preset.gridTemplate;
    }
    // Default for custom layouts
    return { columns: '1fr', rows: '1fr' };
  }

  private getPresetZonesForType(layoutType: string): LayoutZoneDto[] | undefined {
    const preset = LAYOUT_PRESETS.find(p => p.layoutType === layoutType);
    return preset?.zones.map((zone) => ({ ...zone }));
  }

  // ============================================================================
  // WIDGETS
  // ============================================================================

  /**
   * Return all available widget types with their config schemas and sample data.
   */
  getWidgetTypes() {
    const types: Array<{
      type: string;
      configSchema: Record<string, unknown>;
      sampleData: Record<string, unknown>;
      defaultTemplate: string;
    }> = [];

    for (const [, source] of this.dataSourceRegistry.getAll()) {
      types.push({
        type: source.type,
        configSchema: source.getConfigSchema(),
        sampleData: source.getSampleData(),
        defaultTemplate: source.getDefaultTemplate(),
      });
    }

    return types;
  }

  private toWidgetPersistenceException(error: unknown, fallbackMessage: string): Error {
    if (error instanceof HttpException) {
      return error;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new BadGatewayException(`${fallbackMessage}: ${message}`);
  }

  private async findWidgetForMutation(organizationId: string, id: string) {
    const content = await this.db.content.findFirst({
      where: { id, organizationId },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    const metadata = (content.metadata || {}) as Record<string, unknown>;
    if (metadata.isWidget !== true) {
      throw new BadRequestException('Content is not a widget');
    }

    return content;
  }

  /**
   * Fetch live weather data for preview purposes.
   * Uses the weather data source to get current conditions without creating a widget.
   */
  async getWeatherPreview(location: string, units: string = 'metric') {
    let source: WidgetDataSource;
    try {
      source = this.dataSourceRegistry.get('weather');
    } catch {
      throw new BadRequestException('Weather widget type not available');
    }

    return source.fetchData({ location, units, showForecast: true, forecastDays: 5 });
  }

  /**
   * Create a widget as a Content record with type='template' and widget metadata.
   */
  async createWidget(organizationId: string, dto: CreateWidgetDto) {
    let source: WidgetDataSource;
    try {
      source = this.dataSourceRegistry.get(dto.widgetType);
    } catch {
      throw new BadRequestException(`Unknown widget type: ${dto.widgetType}`);
    }

    // Load the default Handlebars template from disk
    const templateName = source.getDefaultTemplate();
    const templateHtml = this.loadWidgetTemplate(templateName);

    // Fetch initial data from the data source. Persisted widgets are strict:
    // sample fallback data is allowed for previews only, never for saved screens.
    let data: Record<string, unknown>;
    try {
      data = await source.fetchData(dto.widgetConfig, { strict: true });
    } catch (error) {
      throw this.toWidgetPersistenceException(error, 'Widget initial data fetch failed');
    }

    // Render the template with data
    let renderedHtml: string;
    try {
      renderedHtml = this.templateRendering.renderTemplate(templateHtml, data);
    } catch (error) {
      throw this.toWidgetPersistenceException(error, 'Widget initial render failed');
    }

    const widgetMeta: WidgetMetadata = {
      isWidget: true,
      widgetType: dto.widgetType,
      widgetConfig: dto.widgetConfig,
      templateName,
      templateHtml,
      renderedHtml,
      renderedAt: new Date().toISOString(),
    };

    const content = await this.db.content.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: 'template',
        url: '',
        duration: dto.duration || 30,
        metadata: widgetMeta as Prisma.InputJsonValue,
        organizationId,
      },
    });

    return this.mapContentResponse(content);
  }

  /**
   * Update widget configuration and re-render.
   */
  async updateWidget(organizationId: string, id: string, dto: Partial<CreateWidgetDto>) {
    const existing = await this.findWidgetForMutation(organizationId, id);

    const existingMeta = (existing.metadata || {}) as Record<string, unknown>;

    const widgetType = (dto.widgetType || existingMeta.widgetType) as string;
    const widgetConfig = this.restoreRedactedWidgetConfig(
      widgetType,
      (dto.widgetConfig || existingMeta.widgetConfig || {}) as Record<string, unknown>,
      existingMeta.widgetConfig,
    );

    let source: WidgetDataSource;
    try {
      source = this.dataSourceRegistry.get(widgetType);
    } catch {
      throw new BadRequestException(`Unknown widget type: ${widgetType}`);
    }

    // If the widget type changed, load the new default template
    let templateName = existingMeta.templateName as string;
    let templateHtml = existingMeta.templateHtml as string;
    if (dto.widgetType && dto.widgetType !== existingMeta.widgetType) {
      templateName = source.getDefaultTemplate();
      templateHtml = this.loadWidgetTemplate(templateName);
    }

    // Re-fetch data and re-render. Configuration changes are only persisted
    // after live data and template rendering both succeed.
    let data: Record<string, unknown>;
    let renderedHtml: string;
    try {
      data = await source.fetchData(widgetConfig, { strict: true });
    } catch (error) {
      throw this.toWidgetPersistenceException(error, 'Widget data fetch failed');
    }

    try {
      renderedHtml = this.templateRendering.renderTemplate(templateHtml, data);
    } catch (error) {
      throw this.toWidgetPersistenceException(error, 'Widget render failed');
    }

    const widgetMeta: WidgetMetadata = {
      isWidget: true,
      widgetType,
      widgetConfig,
      templateName,
      templateHtml,
      renderedHtml,
      renderedAt: new Date().toISOString(),
      lastError: undefined,
    };

    const updated = await this.db.content.updateMany({
      where: { id, organizationId },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        duration: dto.duration ?? existing.duration,
        metadata: widgetMeta as Prisma.InputJsonValue,
      },
    });

    if (updated.count === 0) {
      throw new NotFoundException('Content not found');
    }

    const content = await this.db.content.findFirst({ where: { id, organizationId } });
    return this.mapContentResponse(content);
  }

  /**
   * Force refresh a widget: re-fetch data from the data source and re-render.
   */
  async refreshWidget(organizationId: string, id: string) {
    const existing = await this.findWidgetForMutation(organizationId, id);

    const existingMeta = (existing.metadata || {}) as Record<string, unknown>;

    let source: WidgetDataSource;
    try {
      source = this.dataSourceRegistry.get(existingMeta.widgetType);
    } catch {
      throw new BadRequestException(`Unknown widget type: ${existingMeta.widgetType}`);
    }

    const templateHtml = existingMeta.templateHtml as string;
    const widgetConfig = (existingMeta.widgetConfig || {}) as Record<string, unknown>;

    try {
      const data = await source.fetchData(widgetConfig, { strict: true });
      const renderedHtml = this.templateRendering.renderTemplate(templateHtml, data);

      const widgetMeta: WidgetMetadata = {
        ...existingMeta as WidgetMetadata,
        renderedHtml,
        renderedAt: new Date().toISOString(),
        lastError: undefined,
      };

      const updated = await this.db.content.updateMany({
        where: { id, organizationId },
        data: {
          metadata: widgetMeta as Prisma.InputJsonValue,
        },
      });

      if (updated.count === 0) {
        throw new NotFoundException('Content not found');
      }

      const content = await this.db.content.findFirst({ where: { id, organizationId } });
      return this.mapContentResponse(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      const widgetMeta = {
        ...existingMeta,
        lastError: message,
      };

      await this.db.content.updateMany({
        where: { id, organizationId },
        data: {
          metadata: widgetMeta as Prisma.InputJsonValue,
        },
      });

      throw this.toWidgetPersistenceException(error, 'Widget refresh failed');
    }
  }

  /**
   * Load a Handlebars template file from the widget-templates directory.
   */
  private loadWidgetTemplate(templateName: string): string {
    // Sanitize template name to prevent path traversal
    const safeName = templateName.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeName) {
      throw new BadRequestException('Invalid widget template name');
    }

    const templatePath = path.join(
      __dirname,
      'widget-templates',
      `${safeName}.hbs`,
    );

    try {
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      this.logger.error(`Failed to load widget template "${templateName}": ${error}`);
      throw new BadRequestException(`Widget template "${templateName}" not found`);
    }
  }

  // ===========================================================================
  // O10 — Content approval pipeline
  //
  // Distinct from the existing moderation/flag flow (flagContent /
  // reviewContent). The flag flow is "any user can flag suspect content for
  // admin review." The approval pipeline is "proposer → approver" — any user
  // can submit content for approval; admins/managers gate publication.
  //
  // States:
  //   draft → submitForApproval() → pending_approval → approve() → active
  //                                                  → reject(reason) → rejected
  //
  // The two flows share the Content.status field and the metadata JSON;
  // they don't interact (moderation flags a previously-active piece; the
  // approval pipeline gates the initial publication).
  // ===========================================================================

  /**
   * Proposer step. Move content from `draft` to `pending_approval`. Any
   * authenticated user in the org can submit; cross-org guard via findOne.
   */
  async submitForApproval(
    organizationId: string,
    id: string,
    submittedBy: string,
    note?: string,
  ) {
    const content = await this.findOne(organizationId, id);

    if (content.status !== 'draft') {
      throw new BadRequestException(
        `Only draft content can be submitted for approval (current status: ${content.status})`,
      );
    }

    const existingMetadata = (content.metadata || {}) as Record<string, unknown>;
    const approvalMetadata = {
      ...existingMetadata,
      approval: {
        ...((existingMetadata.approval as Record<string, unknown>) || {}),
        submittedBy,
        submittedAt: new Date().toISOString(),
        submissionNote: note || null,
      },
    };

    const result = await this.db.content.updateMany({
      where: { id, organizationId, status: 'draft' },              // optimistic predicate
      data: {
        status: 'pending_approval',
        metadata: approvalMetadata as Prisma.InputJsonValue,
      },
    });

    if (result.count === 0) {
      // Either gone OR status changed (e.g. concurrent submission). Re-fetch
      // and surface the actual reason instead of pretending it's still draft.
      throw new BadRequestException(
        'Content could not be submitted — status may have changed concurrently',
      );
    }

    this.eventEmitter.emit('content.approval.submitted', {
      organizationId,
      contentId: id,
      submittedBy,
    });

    return this.mapContentResponse(await this.db.content.findUnique({ where: { id } }));
  }

  /**
   * Approver step. Move content from `pending_approval` to `active`.
   * RBAC enforced at the controller (@Roles('admin', 'manager')).
   * Self-approval guard: the approver MUST NOT be the same user who submitted —
   * matches enterprise approval norms.
   */
  async approveContent(
    organizationId: string,
    id: string,
    approvedBy: string,
    note?: string,
  ) {
    const content = await this.findOne(organizationId, id);

    if (content.status !== 'pending_approval') {
      throw new BadRequestException(
        `Only pending_approval content can be approved (current status: ${content.status})`,
      );
    }

    const existingMetadata = (content.metadata || {}) as Record<string, unknown>;
    const existingApproval = (existingMetadata.approval as Record<string, unknown>) || {};

    if (existingApproval.submittedBy === approvedBy) {
      throw new BadRequestException(
        'Self-approval is not allowed — content must be reviewed by a different user',
      );
    }

    const approvalMetadata = {
      ...existingMetadata,
      approval: {
        ...existingApproval,
        approvedBy,
        approvedAt: new Date().toISOString(),
        approvalNote: note || null,
        decision: 'approved',
      },
    };

    const result = await this.db.content.updateMany({
      where: { id, organizationId, status: 'pending_approval' },
      data: {
        status: 'active',
        metadata: approvalMetadata as Prisma.InputJsonValue,
      },
    });

    if (result.count === 0) {
      throw new BadRequestException(
        'Content could not be approved — status may have changed concurrently',
      );
    }

    this.eventEmitter.emit('content.approval.approved', {
      organizationId,
      contentId: id,
      approvedBy,
    });

    return this.mapContentResponse(await this.db.content.findUnique({ where: { id } }));
  }

  /**
   * Approver step. Reject `pending_approval` content; sets status to
   * `rejected` and records the reason. Self-rejection IS allowed (the
   * submitter can withdraw their own pending content). RBAC at controller.
   */
  async rejectFromApproval(
    organizationId: string,
    id: string,
    rejectedBy: string,
    reason: string,
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    const content = await this.findOne(organizationId, id);

    if (content.status !== 'pending_approval') {
      throw new BadRequestException(
        `Only pending_approval content can be rejected (current status: ${content.status})`,
      );
    }

    const existingMetadata = (content.metadata || {}) as Record<string, unknown>;
    const existingApproval = (existingMetadata.approval as Record<string, unknown>) || {};

    const approvalMetadata = {
      ...existingMetadata,
      approval: {
        ...existingApproval,
        rejectedBy,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason,
        decision: 'rejected',
      },
    };

    const result = await this.db.content.updateMany({
      where: { id, organizationId, status: 'pending_approval' },
      data: {
        status: 'rejected',
        metadata: approvalMetadata as Prisma.InputJsonValue,
      },
    });

    if (result.count === 0) {
      throw new BadRequestException(
        'Content could not be rejected — status may have changed concurrently',
      );
    }

    this.eventEmitter.emit('content.approval.rejected', {
      organizationId,
      contentId: id,
      rejectedBy,
    });

    return this.mapContentResponse(await this.db.content.findUnique({ where: { id } }));
  }
}
