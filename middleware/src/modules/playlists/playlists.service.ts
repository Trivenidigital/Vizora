import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

/** Circuit breaker configuration for realtime service — shared with displays.service */
const REALTIME_CIRCUIT_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  successThreshold: 2,
  failureWindow: 60000, // 1 minute
};
const PLAYLIST_UPDATE_NOTIFY_CONCURRENCY = 20;

@Injectable()
export class PlaylistsService {
  private readonly logger = new Logger(PlaylistsService.name);
  private readonly realtimeUrl = process.env.REALTIME_URL || 'http://localhost:3002';

  constructor(
    private readonly db: DatabaseService,
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  /** Returns internal API secret headers, or null if secret is not configured */
  private getInternalApiHeaders(): Record<string, string> | null {
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) {
      this.logger.warn('INTERNAL_API_SECRET is not set — skipping realtime service notification');
      return null;
    }
    return { 'x-internal-api-key': secret };
  }

  async create(organizationId: string, createPlaylistDto: CreatePlaylistDto) {
    const { items, ...playlistData } = createPlaylistDto;

    // Validate all content items exist and belong to organization.
    // Dedupe contentIds before the cardinality check — a playlist that
    // reuses the same content multiple times is valid, but findMany
    // returns each match once, so comparing lengths against the raw
    // contentIds array would falsely reject legitimate playlists with
    // a misleading "missing: " (empty) error message.
    if (items && items.length > 0) {
      const contentIds = items.map(item => item.contentId);
      const uniqueContentIds = Array.from(new Set(contentIds));
      const contents = await this.db.content.findMany({
        where: {
          id: { in: uniqueContentIds },
          organizationId,
        },
        select: { id: true },
      });

      if (contents.length !== uniqueContentIds.length) {
        const foundIds = new Set(contents.map(c => c.id));
        const missingIds = uniqueContentIds.filter(id => !foundIds.has(id));
        throw new NotFoundException(
          `Content item(s) not found or do not belong to your organization: ${missingIds.join(', ')}`
        );
      }
    }

    try {
      const playlist = await this.db.playlist.create({
        data: {
          ...playlistData,
          organizationId,
          items: items
            ? {
                create: items.map((item, index) => ({
                  contentId: item.contentId,
                  order: item.order ?? index,
                  duration: item.duration,
                })),
              }
            : undefined,
        },
        include: {
          items: {
            include: {
              content: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      });

      this.eventEmitter.emit('playlist.created', { entityId: playlist.id, organizationId });
      return playlist;
    } catch (error) {
      // Handle database constraint violations
      if (error.code === 'P2002') {
        throw new ConflictException('A playlist with duplicate items exists');
      }
      if (error.code === 'P2003') {
        throw new NotFoundException('Referenced content item does not exist');
      }
      throw error;
    }
  }

  async findAll(organizationId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.playlist.findMany({
        where: { organizationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            select: {
              id: true,
              playlistId: true,
              contentId: true,
              order: true,
              duration: true,
              content: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  thumbnail: true,
                  duration: true,
                  fileSize: true,
                  status: true,
                },
              },
            },
            orderBy: {
              order: 'asc',
            },
          },
          _count: {
            select: {
              schedules: true,
            },
          },
        },
      }),
      this.db.playlist.count({ where: { organizationId } }),
    ]);

    // Map content items to include title and thumbnailUrl
    const mappedData = data.map(playlist => {
      const items = playlist.items.map(item => ({
        ...item,
        content: item.content ? {
          ...item.content,
          title: item.content.name,
          thumbnailUrl: item.content.thumbnail,
        } : null,
      }));

      return {
        ...playlist,
        items,
        itemCount: items.length,
        totalDuration: items.reduce((sum, item) => sum + (item.duration || item.content?.duration || 10), 0),
        totalSize: items.reduce((sum, item) => sum + (item.content?.fileSize || 0), 0),
      };
    });

    return new PaginatedResponse(mappedData, total, page, limit);
  }

  async findOne(organizationId: string, id: string) {
    const playlist = await this.db.playlist.findFirst({
      where: { id, organizationId },
      include: {
        items: {
          include: {
            content: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        schedules: {
          where: { isActive: true },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Map content items to include title and thumbnailUrl
    const items = playlist.items.map(item => ({
      ...item,
      content: item.content ? {
        ...item.content,
        title: item.content.name,
        thumbnailUrl: item.content.thumbnail,
      } : null,
    }));

    return {
      ...playlist,
      items,
      itemCount: items.length,
      totalDuration: items.reduce((sum, item) => sum + (item.duration || item.content?.duration || 10), 0),
      totalSize: items.reduce((sum, item) => sum + (item.content?.fileSize || 0), 0),
    };
  }

  async update(organizationId: string, id: string, updatePlaylistDto: UpdatePlaylistDto) {
    await this.findOne(organizationId, id);

    const { items, ...playlistData } = updatePlaylistDto;

    // Validate all content IDs belong to the organization
    if (items && items.length > 0) {
      const contentIds = items.map(item => item.contentId);
      const validCount = await this.db.content.count({
        where: { id: { in: contentIds }, organizationId },
      });
      if (validCount !== contentIds.length) {
        throw new NotFoundException('One or more content items not found');
      }
    }

    const includeItems = {
      items: { include: { content: true }, orderBy: { order: 'asc' as const } },
    };

    const updatedPlaylist = await this.db.$transaction(async (tx) => {
      // Org-scoped write: updateMany requires id AND organizationId, so a
      // cross-tenant id affects zero rows — the isolation is enforced in the
      // statement, not by relying on the preceding findOne's ordering (B9).
      const scoped = await tx.playlist.updateMany({
        where: { id, organizationId },
        data: playlistData,
      });
      if (scoped.count === 0) {
        throw new NotFoundException('Playlist not found');
      }

      if (items) {
        await tx.playlistItem.deleteMany({ where: { playlistId: id } });
        await tx.playlistItem.createMany({
          data: items.map((item, index) => ({
            playlistId: id,
            contentId: item.contentId,
            order: item.order ?? index,
            duration: item.duration,
          })),
        });
      }

      // Re-fetch org-scoped so a concurrent cross-tenant race can't return foreign rows.
      return tx.playlist.findFirst({ where: { id, organizationId }, include: includeItems });
    });

    this.eventEmitter.emit('playlist.updated', { entityId: id, organizationId });

    // Notify all displays using this playlist
    this.notifyDisplaysOfPlaylistUpdate(organizationId, id, updatedPlaylist).catch(error => {
      this.logger.error(`Failed to notify displays of playlist update: ${error.message}`);
    });

    return updatedPlaylist;
  }

  async addItem(organizationId: string, playlistId: string, contentId: string, duration?: number) {
    await this.findOne(organizationId, playlistId);

    // Verify the content belongs to the same organization
    const content = await this.db.content.findFirst({
      where: { id: contentId, organizationId },
    });
    if (!content) {
      throw new NotFoundException('Content not found');
    }

    const maxOrder = await this.db.playlistItem.findFirst({
      where: { playlistId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const newItem = await this.db.playlistItem.create({
      data: {
        playlistId,
        contentId,
        order: (maxOrder?.order ?? -1) + 1,
        duration: duration ?? 30, // Default to 30 seconds if not specified
      },
      include: {
        content: true,
      },
    });

    // Touch the parent Playlist row so the device content `version` stays
    // monotonic on in-place item edits — contentVersion reads playlist.updatedAt,
    // and PlaylistItem has no updatedAt of its own.
    await this.db.playlist.updateMany({
      where: { id: playlistId, organizationId },
      data: { updatedAt: new Date() },
    });

    // Notify displays about the playlist change
    this.notifyPlaylistChangeAfterItemUpdate(organizationId, playlistId);

    return newItem;
  }

  async updateItem(organizationId: string, playlistId: string, itemId: string, data: { duration?: number }) {
    await this.findOne(organizationId, playlistId);

    const result = await this.db.playlistItem.updateMany({
      where: { id: itemId, playlistId },
      data,
    });

    if (result.count === 0) {
      throw new NotFoundException('Playlist item not found');
    }

    // Touch the parent Playlist row so the device content `version` stays
    // monotonic on in-place item edits — contentVersion reads playlist.updatedAt,
    // and PlaylistItem has no updatedAt of its own.
    await this.db.playlist.updateMany({
      where: { id: playlistId, organizationId },
      data: { updatedAt: new Date() },
    });

    const updatedItem = await this.db.playlistItem.findFirst({
      where: { id: itemId, playlistId },
      include: { content: true },
    });

    this.notifyPlaylistChangeAfterItemUpdate(organizationId, playlistId);

    return updatedItem;
  }

  async removeItem(organizationId: string, playlistId: string, itemId: string) {
    await this.findOne(organizationId, playlistId);

    // Scope deletion to the specific playlist to prevent cross-playlist item removal
    const result = await this.db.playlistItem.deleteMany({
      where: { id: itemId, playlistId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Playlist item not found');
    }

    // Touch the parent Playlist row so the device content `version` stays
    // monotonic — a deleted item can't refresh itself, so this parent bump is the
    // ONLY thing that moves the version on removal (contentVersion reads
    // playlist.updatedAt).
    await this.db.playlist.updateMany({
      where: { id: playlistId, organizationId },
      data: { updatedAt: new Date() },
    });

    const deletedItem = { id: itemId, playlistId };

    // Notify displays about the playlist change
    this.notifyPlaylistChangeAfterItemUpdate(organizationId, playlistId);

    return deletedItem;
  }

  /**
   * Helper to notify displays after adding/removing playlist items
   */
  private async notifyPlaylistChangeAfterItemUpdate(
    organizationId: string,
    playlistId: string,
  ): Promise<void> {
    // Fetch the full playlist with items
    const playlist = await this.db.playlist.findUnique({
      where: { id: playlistId },
      include: {
        items: {
          include: { content: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (playlist) {
      this.notifyDisplaysOfPlaylistUpdate(organizationId, playlistId, playlist).catch(error => {
        this.logger.error(`Failed to notify displays after item update: ${error.message}`);
      });
    }
  }

  async reorder(organizationId: string, playlistId: string, itemIds: string[]) {
    const playlist = await this.findOne(organizationId, playlistId);

    // Validate all item IDs belong to this playlist
    const playlistItemIds = playlist.items.map(item => item.id);
    const invalidIds = itemIds.filter(id => !playlistItemIds.includes(id));
    if (invalidIds.length > 0) {
      throw new NotFoundException(`Playlist items not found: ${invalidIds.join(', ')}`);
    }

    if (itemIds.length !== playlistItemIds.length) {
      throw new NotFoundException('All playlist items must be included in reorder');
    }

    // Use transaction with two-pass approach to avoid unique constraint violations
    // (@@unique([playlistId, order]))
    await this.db.$transaction(async (tx) => {
      // Pass 1: Set all orders to negative values to avoid conflicts.
      // updateMany scoped to {id, playlistId} enforces that each item belongs to
      // this (org-owned) playlist in the write, not just the prior validation.
      for (let i = 0; i < itemIds.length; i++) {
        await tx.playlistItem.updateMany({
          where: { id: itemIds[i], playlistId },
          data: { order: -(i + 1) },
        });
      }

      // Pass 2: Set final order values
      for (let i = 0; i < itemIds.length; i++) {
        await tx.playlistItem.updateMany({
          where: { id: itemIds[i], playlistId },
          data: { order: i },
        });
      }

      // Touch the parent Playlist row so the device content `version` stays
      // monotonic on reorder (contentVersion reads playlist.updatedAt). Kept
      // inside the transaction with the item writes so the version and the new
      // order commit atomically.
      await tx.playlist.updateMany({
        where: { id: playlistId, organizationId },
        data: { updatedAt: new Date() },
      });
    });

    // Return updated playlist
    const updatedPlaylist = await this.findOne(organizationId, playlistId);

    // Notify displays
    this.notifyDisplaysOfPlaylistUpdate(organizationId, playlistId, updatedPlaylist).catch(error => {
      this.logger.error(`Failed to notify displays of playlist reorder: ${error.message}`);
    });

    return updatedPlaylist;
  }

  async duplicate(organizationId: string, id: string) {
    const original = await this.findOne(organizationId, id);

    // Create the playlist copy with items
    return this.db.playlist.create({
      data: {
        name: `${original.name} (Copy)`,
        description: original.description,
        organizationId,
        items: {
          create: original.items.map((item, index) => ({
            contentId: item.contentId,
            order: item.order ?? index,
            duration: item.duration,
          })),
        },
      },
      include: {
        items: {
          include: { content: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async remove(organizationId: string, id: string) {
    // Org-scoped in the write itself (not a prior findOne): a cross-tenant id has
    // zero row effect, so the isolation holds regardless of call order (B9).
    const result = await this.db.playlist.deleteMany({
      where: { id, organizationId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Playlist not found');
    }
    this.eventEmitter.emit('playlist.deleted', { entityId: id, organizationId });
    return { id };
  }

  /**
   * @OnEvent listener: any time a `playlist.updated` event is emitted
   * (CRUD edit, addItem, removeItem, OR content-expiration-driven swap
   * from ContentService.checkExpiredContent), refresh the affected
   * device fleet.
   *
   * The CRUD methods on this service already call
   * notifyDisplaysOfPlaylistUpdate directly with the freshly-loaded
   * playlist, so this listener only acts on events from OTHER services
   * (where the emitter doesn't have the playlist in hand). It re-loads
   * the playlist by id from the DB to make sure the realtime push
   * carries the latest item set, not stale in-memory state.
   *
   * Filtering: only handle events with `action='expired_content_replaced'`
   * to avoid double-pushing CRUD edits (where the direct call already
   * fired). The action tag was introduced in the content-expiration
   * PR specifically to make this discrimination cheap.
   */
  @OnEvent('playlist.updated', { async: true })
  async handlePlaylistUpdatedEvent(payload: {
    entityId: string;
    organizationId: string;
    action?: string;
  }): Promise<void> {
    if (payload.action !== 'expired_content_replaced') return;
    try {
      const playlist = await this.db.playlist.findFirst({
        where: { id: payload.entityId, organizationId: payload.organizationId },
        include: {
          items: {
            include: { content: true },
            orderBy: { order: 'asc' },
          },
        },
      });
      if (!playlist) {
        this.logger.warn(
          `playlist.updated event for missing playlist ${payload.entityId} (org ${payload.organizationId}) — skipping push`,
        );
        return;
      }
      await this.notifyDisplaysOfPlaylistUpdate(payload.organizationId, payload.entityId, playlist);
    } catch (err) {
      this.logger.error(
        `Failed to notify displays of expired-content playlist refresh for ${payload.entityId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  /**
   * Notify all displays using a playlist about the update
   */
  private async notifyDisplaysOfPlaylistUpdate(
    organizationId: string,
    playlistId: string,
    playlist: unknown,
  ): Promise<void> {
    const headers = this.getInternalApiHeaders();
    if (!headers) return;

    // Find all displays currently using this playlist
    const displays = await this.db.display.findMany({
      where: { currentPlaylistId: playlistId, organizationId },
      select: { id: true },
    });

    if (displays.length === 0) {
      return;
    }

    this.logger.log(`Notifying ${displays.length} display(s) of playlist update`);

    const url = `${this.realtimeUrl}/api/push/playlist`;

    await this.runBounded(
      displays,
      PLAYLIST_UPDATE_NOTIFY_CONCURRENCY,
      async (display) => {
        await this.circuitBreaker.executeWithFallback(
          'realtime-service',
          async () => {
            await firstValueFrom(
              this.httpService.post(url, {
                deviceId: display.id,
                playlist,
              }, { headers, timeout: 5000 }),
            );
            this.logger.log(`Notified display ${display.id} of playlist update`);
          },
          (error) => {
            if (error) {
              this.logger.warn(
                `Failed to notify realtime service for display ${display.id}: ${error.message}`,
              );
            } else {
              this.logger.warn(
                `Realtime service circuit is open, skipping notification for display ${display.id}`,
              );
            }
          },
          REALTIME_CIRCUIT_CONFIG,
        );
      },
    );
  }

  private async runBounded<T>(
    items: readonly T[],
    concurrency: number,
    task: (item: T) => Promise<void>,
  ): Promise<void> {
    if (items.length === 0) return;

    const workerCount = Math.min(Math.max(1, concurrency), items.length);
    let nextIndex = 0;

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const item = items[nextIndex];
          nextIndex += 1;
          try {
            await task(item);
          } catch {
            // Preserve the previous Promise.allSettled behavior: attempt every display.
          }
        }
      }),
    );
  }
}
