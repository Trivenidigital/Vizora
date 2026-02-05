import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class PlaylistsService {
  private readonly logger = new Logger(PlaylistsService.name);
  private readonly realtimeUrl = process.env.REALTIME_URL || 'http://localhost:3002';

  constructor(
    private readonly db: DatabaseService,
    private readonly httpService: HttpService,
  ) {}

  async create(organizationId: string, createPlaylistDto: CreatePlaylistDto) {
    const { items, ...playlistData } = createPlaylistDto;

    // Validate all content items exist and belong to organization
    if (items && items.length > 0) {
      const contentIds = items.map(item => item.contentId);
      const contents = await this.db.content.findMany({
        where: {
          id: { in: contentIds },
          organizationId,
        },
        select: { id: true },
      });

      if (contents.length !== contentIds.length) {
        const foundIds = contents.map(c => c.id);
        const missingIds = contentIds.filter(id => !foundIds.includes(id));
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
            include: {
              content: true,
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

    if (items) {
      await this.db.playlistItem.deleteMany({
        where: { playlistId: id },
      });
    }

    const updatedPlaylist = await this.db.playlist.update({
      where: { id },
      data: {
        ...playlistData,
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

    // Notify all displays using this playlist
    this.notifyDisplaysOfPlaylistUpdate(id, updatedPlaylist).catch(error => {
      this.logger.error(`Failed to notify displays of playlist update: ${error.message}`);
    });

    return updatedPlaylist;
  }

  async addItem(organizationId: string, playlistId: string, contentId: string, duration?: number) {
    await this.findOne(organizationId, playlistId);

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

    // Notify displays about the playlist change
    this.notifyPlaylistChangeAfterItemUpdate(playlistId);

    return newItem;
  }

  async removeItem(organizationId: string, playlistId: string, itemId: string) {
    await this.findOne(organizationId, playlistId);

    const deletedItem = await this.db.playlistItem.delete({
      where: { id: itemId },
    });

    // Notify displays about the playlist change
    this.notifyPlaylistChangeAfterItemUpdate(playlistId);

    return deletedItem;
  }

  /**
   * Helper to notify displays after adding/removing playlist items
   */
  private async notifyPlaylistChangeAfterItemUpdate(playlistId: string): Promise<void> {
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
      this.notifyDisplaysOfPlaylistUpdate(playlistId, playlist).catch(error => {
        this.logger.error(`Failed to notify displays after item update: ${error.message}`);
      });
    }
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
    await this.findOne(organizationId, id);
    return this.db.playlist.delete({
      where: { id },
    });
  }

  /**
   * Notify all displays using a playlist about the update
   */
  private async notifyDisplaysOfPlaylistUpdate(playlistId: string, playlist: unknown): Promise<void> {
    // Find all displays currently using this playlist
    const displays = await this.db.display.findMany({
      where: { currentPlaylistId: playlistId },
      select: { id: true },
    });

    if (displays.length === 0) {
      return;
    }

    this.logger.log(`Notifying ${displays.length} display(s) of playlist update`);

    // Notify each display via the realtime service
    const url = `${this.realtimeUrl}/api/push/playlist`;

    await Promise.allSettled(
      displays.map(async (display) => {
        try {
          await firstValueFrom(
            this.httpService.post(url, {
              deviceId: display.id,
              playlist,
            }),
          );
          this.logger.log(`Notified display ${display.id} of playlist update`);
        } catch (error) {
          this.logger.warn(`Failed to notify display ${display.id}: ${error.message}`);
        }
      }),
    );
  }
}
